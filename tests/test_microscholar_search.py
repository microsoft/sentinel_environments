"""Tests for MicroScholar basic-search shingle-containment scoring."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.server import SCHOLAR_SEARCH_MIN_SCORE, _query_containment, _shingles


# ---------------------------------------------------------------------------
# _shingles
# ---------------------------------------------------------------------------

def test_shingles_basic():
    # "abc" → padded " abc " (length 5) → 3-shingles: " ab", "abc", "bc "
    assert _shingles("abc") == {" ab", "abc", "bc "}


def test_shingles_lowercases():
    assert _shingles("ABC") == _shingles("abc")


def test_shingles_single_char():
    # "x" → " x " (length 3) → one 3-shingle
    assert _shingles("x") == {" x "}


def test_shingles_empty_returns_empty_set():
    assert _shingles("") == set()


def test_shingles_with_spaces_treats_them_as_padding():
    # Internal spaces become real shingle characters too.
    assert " ja" in _shingles("D Jackson")
    assert "jac" in _shingles("D Jackson")
    assert "on " in _shingles("D Jackson")


# ---------------------------------------------------------------------------
# _query_containment
# ---------------------------------------------------------------------------

def test_containment_exact_match_is_one():
    qs = _shingles("jackson")
    assert _query_containment(qs, "jackson") == 1.0


def test_containment_substring_in_doc_is_one():
    # Every query shingle is also in the doc → 1.0.
    qs = _shingles("jackson")
    score = _query_containment(qs, "papers by D Jackson on graphs")
    assert score == 1.0


def test_containment_partial_overlap_deborah_in_d_jackson():
    # Deborah Jackson partially covered by "D Jackson" — must be > 0.
    qs = _shingles("Deborah Jackson")
    score = _query_containment(qs, "I Martinez, X Morales, D Jackson")
    assert 0 < score < 1


def test_containment_unrelated_is_zero():
    qs = _shingles("kubernetes")
    score = _query_containment(qs, "Differentiable Variational Inference for Scheduling")
    assert score == 0.0


def test_containment_empty_query_is_zero():
    assert _query_containment(set(), "anything") == 0.0


def test_containment_ranks_closer_match_higher():
    # Title hit covers more shingles than a single-author last-name hit.
    qs = _shingles("graph generation")
    title_hit = _query_containment(qs, "Parameterized Transfer Learning for Graph Generation")
    author_hit = _query_containment(qs, "Some Title About Cats; D Jackson, Y Ahmed")
    assert title_hit > author_hit


# ---------------------------------------------------------------------------
# Endpoint integration: /data/microscholar-papers?search=...
# ---------------------------------------------------------------------------

def _init_microscholar(client):
    """Bring the server to a microscholar session with all catalog papers loaded."""
    if client.get("/status").json()["status"] != "preinit":
        client.get("/close")
    resp = client.post(
        "/init",
        json={
            "environment": "microscholar",
            "event_timeline_end": 720.0,
            "eval_sql": "",
            "condition_at": 600.0,
            "events": [
                {
                    "time": 0.0,
                    "type": "preload_papers",
                    "payload": {"paper_ids": ["*"], "alert_ids": []},
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    # Advance past t=0 so the preload event fires.
    client.get("/advance", params={"time": 1})


def _papers_for(client, query):
    r = client.get("/data/microscholar-papers", params={"search": query})
    assert r.status_code == 200
    return r.json()["papers"]


def test_search_deborah_jackson_finds_d_jackson_papers():
    from fastapi.testclient import TestClient
    from server import server as srv

    with TestClient(srv.app) as client:
        _init_microscholar(client)

        full_name_hits = _papers_for(client, "Deborah Jackson")
        last_name_hits = _papers_for(client, "Jackson")

        # Both should return at least the 7 D-Jackson-authored papers in the catalog.
        assert len(full_name_hits) >= 7
        assert len(last_name_hits) >= 7

        # Every D-Jackson paper from "Jackson" should be present in the
        # "Deborah Jackson" results (the looser query is a superset of the
        # stricter one's intent).
        last_ids = {p["id"] for p in last_name_hits}
        full_ids = {p["id"] for p in full_name_hits}
        d_jackson_ids = {
            p["id"] for p in last_name_hits if "Jackson" in (p.get("authors") or "")
        }
        assert d_jackson_ids.issubset(full_ids)
        assert d_jackson_ids.issubset(last_ids)

        client.get("/close")


def test_search_unrelated_query_returns_empty():
    from fastapi.testclient import TestClient
    from server import server as srv

    with TestClient(srv.app) as client:
        _init_microscholar(client)
        # Pick something that shouldn't appear anywhere in titles/authors/snippets/sources.
        assert _papers_for(client, "qzzqzzqx") == []
        client.get("/close")


def test_search_ranks_results_by_descending_score():
    from fastapi.testclient import TestClient
    from server import server as srv

    with TestClient(srv.app) as client:
        _init_microscholar(client)

        # "transfer learning" should rank a paper whose title is literally
        # "Parameterized Transfer Learning for Graph Generation" above papers
        # that only share a few stray shingles.
        results = _papers_for(client, "transfer learning")
        assert len(results) >= 2
        top = results[0]
        # The top hit must contain the full phrase; later hits don't have to.
        haystack = " ".join([
            top.get("title", "") or "",
            top.get("authors", "") or "",
            top.get("snippet", "") or "",
            top.get("source", "") or "",
        ]).lower()
        assert "transfer learning" in haystack

        client.get("/close")


def test_search_empty_query_returns_unfiltered():
    from fastapi.testclient import TestClient
    from server import server as srv

    with TestClient(srv.app) as client:
        _init_microscholar(client)

        all_papers = client.get("/data/microscholar-papers").json()["papers"]
        whitespace_papers = _papers_for(client, "   ")

        # Whitespace-only search hits the upstream `search.strip()` guard and
        # returns the full list, not the shingle-filtered list.
        assert len(whitespace_papers) == len(all_papers)

        client.get("/close")


def test_search_single_char_query_does_not_crash():
    from fastapi.testclient import TestClient
    from server import server as srv

    with TestClient(srv.app) as client:
        _init_microscholar(client)
        # Just verify it returns a sensible response — single-char shingle
        # set is {" x "} and many docs will contain " x " somewhere.
        r = client.get("/data/microscholar-papers", params={"search": "a"})
        assert r.status_code == 200
        assert "papers" in r.json()
        client.get("/close")


def test_search_drops_results_below_threshold():
    """Marginal shingle overlap below the threshold must not surface as a hit."""
    from fastapi.testclient import TestClient
    from server import server as srv

    with TestClient(srv.app) as client:
        _init_microscholar(client)

        # Long query with a few common-letter shingles; every paper that
        # survives the filter must clear the configured minimum.
        results = _papers_for(client, "kubernetes orchestration platform")
        qs = _shingles("kubernetes orchestration platform")
        for p in results:
            haystack = " ".join([
                p.get("title", "") or "",
                p.get("authors", "") or "",
                p.get("snippet", "") or "",
                p.get("source", "") or "",
            ])
            assert _query_containment(qs, haystack) >= SCHOLAR_SEARCH_MIN_SCORE

        client.get("/close")
