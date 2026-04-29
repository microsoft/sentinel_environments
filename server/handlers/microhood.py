# handler for the microhood (stock trading) environment.
# reads immutable stock/news data from catalogs.py, mutable state from session.py.
# provides functions for listing stocks, portfolio, watchlist, news, and placing orders.
#
# prices are event-driven: each symbol has a list of (time, price) waypoints in
# session state. between waypoints the server linearly interpolates, so prices
# feel continuous while staying fully authoritative (no frontend math). at t=0
# price = catalog starting_price; scenarios add later waypoints via
# preload_stocks.payload.price_waypoints (bulk) or set_price events (discrete).
# symbols without waypoints stay flat at their starting_price.
#
# flow: server.py route -> microhood handler -> reads MICROHOOD_*_CATALOG + session -> returns data
# example: POST /microhood/stocks/AAPL/order -> place_order() -> fills at server-computed current price

from __future__ import annotations

import bisect
import json
import sqlite3
from typing import TYPE_CHECKING

from server.catalogs import (
    MICROHOOD_NEWS_CATALOG,
    MICROHOOD_STOCK_CATALOG,
    MICROHOOD_WATCHLIST_CATALOG,
)

if TYPE_CHECKING:
    from server.session import Session


# ---------------------------------------------------------------------------
# Price interpolation (event-driven waypoints)
# ---------------------------------------------------------------------------

def _interpolate(waypoints: list[list[float]], sim_time: float) -> float:
    """Linearly interpolate price at sim_time given sorted waypoints."""
    if sim_time <= waypoints[0][0]:
        return waypoints[0][1]
    if sim_time >= waypoints[-1][0]:
        return waypoints[-1][1]
    times = [w[0] for w in waypoints]
    idx = bisect.bisect_right(times, sim_time) - 1
    t0, p0 = waypoints[idx]
    t1, p1 = waypoints[idx + 1]
    return p0 + (p1 - p0) * (sim_time - t0) / (t1 - t0)


def get_current_prices(session: Session) -> dict[str, float]:
    """Return current price for every loaded stock based on session waypoints."""
    prices: dict[str, float] = {}
    for symbol, starting_price in session.microhood_starting_prices.items():
        waypoints = session.microhood_price_waypoints.get(symbol)
        if not waypoints:
            prices[symbol] = starting_price
            continue
        prices[symbol] = _interpolate(waypoints, session.simulation_time)
    return prices


def _add_waypoint(session: Session, symbol: str, time: float, price: float) -> None:
    """Insert (time, price) into the symbol's waypoint list, kept sorted by time."""
    waypoints = session.microhood_price_waypoints.setdefault(symbol, [])
    # Seed with (0, starting_price) if this is the first explicit waypoint and t>0.
    if not waypoints and time > 0 and symbol in session.microhood_starting_prices:
        waypoints.append([0.0, session.microhood_starting_prices[symbol]])
    entry = [float(time), float(price)]
    idx = bisect.bisect_right([w[0] for w in waypoints], entry[0])
    waypoints.insert(idx, entry)


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
        "news_count": len(session.microhood_news),
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
        price_waypoints = payload.get("price_waypoints", {})

        # Load stocks -- "*" means all
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
            session.microhood_starting_prices[symbol] = float(raw.get("current_price", 0))

        # Load watchlist -- "*" means all
        if watchlist_symbols == ["*"]:
            watchlist_symbols = list(MICROHOOD_WATCHLIST_CATALOG.keys())
        for symbol in watchlist_symbols:
            raw = MICROHOOD_WATCHLIST_CATALOG.get(symbol)
            if raw is None:
                continue
            session.microhood_watchlist.append(dict(raw))
            session.microhood_watchlist_states[symbol] = {"inWatchlist": True}

        # Load news -- "*" means all
        if news_ids == ["*"]:
            news_ids = list(MICROHOOD_NEWS_CATALOG.keys())
        for nid in news_ids:
            raw = MICROHOOD_NEWS_CATALOG.get(nid)
            if raw is None:
                continue
            session.microhood_news.append(dict(raw))

        session.microhood_buying_power = buying_power

        # Install bulk price waypoints from the scenario. Each entry is a list
        # of [time, price] pairs. We seed (0, starting_price) via _add_waypoint
        # if the scenario's first declared time is > 0.
        for symbol, points in price_waypoints.items():
            for time, price in points:
                _add_waypoint(session, symbol, float(time), float(price))

        # Capture baseline after preload
        session.baseline_metrics = compute_current_metrics(session)

    elif etype == "new_news":
        news_id = event.get("payload", {}).get("news_id")
        raw = MICROHOOD_NEWS_CATALOG.get(news_id)
        if raw:
            session.microhood_news.append(dict(raw))

    elif etype == "set_price":
        payload = event.get("payload", {})
        symbol = payload.get("symbol")
        price = payload.get("price")
        if symbol is None or price is None:
            return
        _add_waypoint(session, symbol, float(event["time"]), float(price))


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

    conn.execute("CREATE TABLE orders (id TEXT, symbol TEXT, action TEXT, quantity INT, price REAL, type TEXT)")
    conn.executemany(
        "INSERT INTO orders VALUES (?,?,?,?,?,?)",
        [
            (o.get("id"), o.get("symbol"), o.get("action"),
             int(o.get("quantity", 0)), float(o.get("price", 0)), o.get("type"))
            for o in session.microhood_orders
        ],
    )

    # Current prices from waypoint interpolation
    prices = get_current_prices(session)
    conn.execute("CREATE TABLE current_prices (symbol TEXT, price REAL)")
    conn.executemany(
        "INSERT INTO current_prices VALUES (?,?)",
        list(prices.items()),
    )

    # buying_power into session_meta (table created by /evaluate before materialize)
    conn.execute("INSERT INTO session_meta VALUES (?, ?)", ("buying_power", str(session.microhood_buying_power)))
