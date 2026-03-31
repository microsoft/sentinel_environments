# handler for the microhood (stock trading) environment.
# reads immutable stock/news data from catalogs.py, mutable state from session.py.
# provides functions for listing stocks, portfolio, watchlist, news, and placing orders.
#
# flow: server.py route -> microhood handler -> reads MICROHOOD_*_CATALOG + session -> returns data
# example: POST /microhood/stocks/AAPL/order -> place_order() -> updates session buying_power + stock_states

from __future__ import annotations

import json
import sqlite3
from typing import TYPE_CHECKING

from sentinel_api.catalogs import (
    MICROHOOD_NEWS_CATALOG,
    MICROHOOD_STOCK_CATALOG,
    MICROHOOD_TRACE_CATALOG,
    MICROHOOD_WATCHLIST_CATALOG,
)

if TYPE_CHECKING:
    from sentinel_api.session import Session


# ---------------------------------------------------------------------------
# Price interpolation
# ---------------------------------------------------------------------------

def get_current_prices(session: Session) -> dict[str, float]:
    """Interpolate stock prices from traces based on simulation_time / duration.

    Each stock has 11 price points (indices 0-10) representing 0%-100% progress
    through the simulation duration.  We linearly interpolate between adjacent
    points based on the current progress.
    """
    progress = min(session.simulation_time / max(session.duration, 1), 1.0)
    prices: dict[str, float] = {}

    for symbol, trace in MICROHOOD_TRACE_CATALOG.items():
        if not trace:
            continue
        if len(trace) == 1:
            prices[symbol] = trace[0]
            continue

        trace_progress = progress * (len(trace) - 1)
        lower_index = int(trace_progress)
        upper_index = min(lower_index + 1, len(trace) - 1)
        fraction = trace_progress - lower_index
        prices[symbol] = trace[lower_index] + (trace[upper_index] - trace[lower_index]) * fraction

    return prices


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_current_metrics(session: Session) -> dict:
    prices = get_current_prices(session)
    states = session.microhood_stock_states

    positions_value = 0.0
    for stock in session.microhood_stocks:
        symbol = stock["symbol"]
        shares = states.get(symbol, {}).get("shares", 0)
        price = prices.get(symbol, 0)
        positions_value += shares * price

    portfolio_value = session.microhood_buying_power + positions_value

    watchlist_count = sum(
        1 for s in session.microhood_watchlist_states.values()
        if s.get("inWatchlist", True)
    )

    return {
        "portfolio_value": round(portfolio_value, 2),
        "buying_power": round(session.microhood_buying_power, 2),
        "positions_value": round(positions_value, 2),
        "order_count": len(session.microhood_orders),
        "watchlist_count": watchlist_count,
        "mcro_price": round(prices.get("MCRO", 0), 2),
    }


# ---------------------------------------------------------------------------
# Event processing
# ---------------------------------------------------------------------------

def process_event(session: Session, event: dict) -> None:
    etype = event["type"]

    if etype == "preload_stocks":
        payload = event.get("payload", {})
        stock_symbols = payload.get("stock_symbols", [])
        watchlist_symbols = payload.get("watchlist_symbols", [])
        news_ids = payload.get("news_ids", [])
        buying_power = payload.get("buying_power", 10000.0)

        # Load stocks — "*" means all
        if stock_symbols == ["*"]:
            stock_symbols = list(MICROHOOD_STOCK_CATALOG.keys())
        for symbol in stock_symbols:
            raw = MICROHOOD_STOCK_CATALOG.get(symbol)
            if raw is None:
                continue
            stock_row = {
                "symbol": raw["symbol"],
                "name": raw["name"],
                "color": raw.get("color", "#333"),
                "orgId": raw.get("org_id", ""),
                "avgCost": raw.get("avg_cost", 0),
            }
            session.microhood_stocks.append(stock_row)
            session.microhood_stock_states[symbol] = {
                "shares": raw.get("shares", 0),
                "avgCost": raw.get("avg_cost", 0),
            }

        # Load watchlist — "*" means all
        if watchlist_symbols == ["*"]:
            watchlist_symbols = list(MICROHOOD_WATCHLIST_CATALOG.keys())
        for symbol in watchlist_symbols:
            raw = MICROHOOD_WATCHLIST_CATALOG.get(symbol)
            if raw is None:
                continue
            session.microhood_watchlist.append(dict(raw))
            session.microhood_watchlist_states[symbol] = {"inWatchlist": True}

        # Load news — "*" means all
        if news_ids == ["*"]:
            news_ids = list(MICROHOOD_NEWS_CATALOG.keys())
        for nid in news_ids:
            raw = MICROHOOD_NEWS_CATALOG.get(nid)
            if raw is None:
                continue
            session.microhood_news.append(dict(raw))

        session.microhood_buying_power = buying_power

        # Capture baseline after preload
        session.baseline_metrics = compute_current_metrics(session)

    elif etype == "new_news":
        news_id = event.get("payload", {}).get("news_id")
        raw = MICROHOOD_NEWS_CATALOG.get(news_id)
        if raw:
            session.microhood_news.append(dict(raw))


# ---------------------------------------------------------------------------
# Bulk actions
# ---------------------------------------------------------------------------

def handle_action(session: Session, action_name: str) -> dict:
    if action_name == "sell_all":
        prices = get_current_prices(session)
        for symbol, state in session.microhood_stock_states.items():
            shares = state.get("shares", 0)
            if shares > 0:
                price = prices.get(symbol, 0)
                session.microhood_buying_power += shares * price
                state["shares"] = 0

    elif action_name == "clear_watchlist":
        for symbol, state in session.microhood_watchlist_states.items():
            state["inWatchlist"] = False

    elif action_name == "place_order":
        # Generic "place order" action — no-op, the actual order was already
        # placed via the /data/stocks/{symbol}/order endpoint.
        pass

    else:
        return {"success": False, "error": f"Unknown action: {action_name}"}

    return {"success": True}


# ---------------------------------------------------------------------------
# Materialization for SQL-based evaluation
# ---------------------------------------------------------------------------

def materialize_to_sqlite(session: Session, conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE stocks (symbol TEXT, name TEXT, color TEXT, avgCost REAL)"
    )
    conn.executemany(
        "INSERT INTO stocks VALUES (?,?,?,?)",
        [(s.get("symbol"), s.get("name"), s.get("color"), float(s.get("avgCost", 0))) for s in session.microhood_stocks],
    )

    conn.execute("CREATE TABLE stock_states (symbol TEXT, shares INT, avgCost REAL)")
    conn.executemany(
        "INSERT INTO stock_states VALUES (?,?,?)",
        [(sym, int(s.get("shares", 0)), float(s.get("avgCost", 0))) for sym, s in session.microhood_stock_states.items()],
    )

    conn.execute("CREATE TABLE watchlist (symbol TEXT, data TEXT)")
    conn.executemany(
        "INSERT INTO watchlist VALUES (?,?)",
        [(w.get("symbol"), json.dumps(w)) for w in session.microhood_watchlist],
    )

    conn.execute("CREATE TABLE watchlist_states (symbol TEXT, inWatchlist INT)")
    conn.executemany(
        "INSERT INTO watchlist_states VALUES (?,?)",
        [(sym, int(s.get("inWatchlist", True))) for sym, s in session.microhood_watchlist_states.items()],
    )

    conn.execute("CREATE TABLE news (id TEXT, data TEXT)")
    conn.executemany(
        "INSERT INTO news VALUES (?,?)",
        [(n.get("id"), json.dumps(n)) for n in session.microhood_news],
    )

    conn.execute("CREATE TABLE orders (id TEXT, symbol TEXT, action TEXT, quantity INT, price REAL)")
    conn.executemany(
        "INSERT INTO orders VALUES (?,?,?,?,?)",
        [
            (o.get("id"), o.get("symbol"), o.get("action"),
             int(o.get("quantity", 0)), float(o.get("price", 0)))
            for o in session.microhood_orders
        ],
    )

    # Current prices from trace interpolation
    prices = get_current_prices(session)
    conn.execute("CREATE TABLE current_prices (symbol TEXT, price REAL)")
    conn.executemany(
        "INSERT INTO current_prices VALUES (?,?)",
        list(prices.items()),
    )

    # buying_power into session_meta (table created by /evaluate before materialize)
    conn.execute("INSERT INTO session_meta VALUES (?, ?)", ("buying_power", str(session.microhood_buying_power)))
