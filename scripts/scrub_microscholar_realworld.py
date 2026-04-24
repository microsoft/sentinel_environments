#!/usr/bin/env python3
"""Replace real-world institutions and conferences in MicroScholar data with
plausible-sounding fakes.

Touches:
  data/catalogs/users.json                (microscholar.affiliation/email/homepage)
  data/catalogs/microscholar/papers.jsonl (source)

Run once from repo root; then rebuild the DB:
  python3 -m server.scripts.build_db
"""
from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
USERS = REPO / "data" / "catalogs" / "users.json"
PAPERS = REPO / "data" / "catalogs" / "microscholar" / "papers.jsonl"

# Real institution -> fake institution. Keys are the exact affiliation strings
# seen in users.json microscholar.affiliation.
INSTITUTION_NAME: dict[str, str] = {
    "Stanford University": "Redwood University",
    "UC Berkeley": "Bayview State University",
    "Georgia Institute of Technology": "Peach State Institute of Technology",
    "University of Texas at Austin": "Central Texas University",
    "University of Oxford": "Ashford University",
    "Princeton University": "Ellington University",
    "UCLA": "Pacific Coast University",
    "University of Illinois Urbana-Champaign": "Heartland State University",
    "University of Washington": "Puget Sound University",
    "Massachusetts Institute of Technology": "North Bay Institute of Technology",
    "Carnegie Mellon University": "Iron Hill University",
    "Cornell University": "Finger Lakes University",
    "University of Cambridge": "Thameside University",
    "ETH Zurich": "Alpine Polytechnic",
    "Seoul National University": "Hanbit National University",
    "UNAM": "Universidad Nacional del Valle",
    "New York University": "Hudson Metropolitan University",
    "University of Toronto": "Maple Ridge University",
    "King Abdullah University of Science and Technology": "Desert Horizon University",
    "Trinity College Dublin": "Liffey College Dublin",
    "Instituto Superior Técnico": "Instituto Técnico de Lisboa",
    "Turing Research Labs": "Meridian Research Labs",
    "Indian Institute of Science": "Bharat Institute of Science",
    "KAIST": "Korean Institute of Advanced Technology",
}

# Domain substring replacements, ordered longest-first so that subdomains
# hit their specific rule before the institution root.
DOMAIN_REPLACEMENTS: list[tuple[str, str]] = [
    ("people.csail.mit.edu", "people.csail.nbit.edu"),
    ("cemse.kaust.edu.sa", "cemse.dhu.edu.sa"),
    ("eecs.berkeley.edu", "eecs.bayview.edu"),
    ("cs.stanford.edu", "cs.redwood.edu"),
    ("stat.utexas.edu", "stat.ctu.edu"),
    ("cs.toronto.edu", "cs.mapleridge.ca"),
    ("kaust.edu.sa", "dhu.edu.sa"),
    ("stanford.edu", "redwood.edu"),
    ("berkeley.edu", "bayview.edu"),
    ("gatech.edu", "peachtech.edu"),
    ("utexas.edu", "ctu.edu"),
    ("princeton.edu", "ellington.edu"),
    ("washington.edu", "pugetsound.edu"),
    ("cornell.edu", "fingerlakes.edu"),
    ("utoronto.ca", "mapleridge.ca"),
    ("ucla.edu", "pcu.edu"),
    ("uiuc.edu", "heartland.edu"),
    ("nyu.edu", "hudsonmet.edu"),
    ("mit.edu", "nbit.edu"),
    ("cmu.edu", "ironhill.edu"),
    ("ox.ac.uk", "ashford.ac.uk"),
    ("cam.ac.uk", "thameside.ac.uk"),
    ("snu.ac.kr", "hanbit.ac.kr"),
    ("kaist.ac.kr", "kiat.ac.kr"),
    ("iisc.ac.in", "bis.ac.in"),
    ("eth.ch", "alpinepoly.ch"),
    ("unam.mx", "univalle.mx"),
    ("tcd.ie", "liffey.ie"),
    ("tecnico.pt", "itlisboa.pt"),
    ("deepmind.com", "meridianlabs.ai"),
]


def replace_domain(s: str) -> str:
    for old, new in DOMAIN_REPLACEMENTS:
        s = s.replace(old, new)
    return s


# Real conference / venue -> fake. Keys are exact values of `source` in
# papers.jsonl. All fakes sound like plausible CS/ML venues but are invented.
CONFERENCE: dict[str, str] = {
    "AAAI": "GAIC",
    "ACL": "ACLP",
    "AISTATS": "AISA",
    "ASE": "ASEP",
    "ATC": "ASCC",
    "CCS": "ACSP",
    "CHI": "CIHC",
    "CSCW": "CSSC",
    "CVPR": "AVPR",
    "ECCV": "ECOV",
    "EMNLP": "PLPP",
    "EuroSys": "EuroCS",
    "FOCS": "FCST",
    "FSE": "ESFE",
    "ICCV": "AIVC",
    "ICLR": "ICRT",
    "ICML": "IMLC",
    "ICRA": "ICAR",
    "ICSE": "ISEP",
    "ISCA": "CAPS",
    "JMLR": "JAML",
    "KDD": "DMKR",
    "MICRO": "MACA",
    "NAACL": "NAPL",
    "NSDI": "DSNI",
    "Nature Machine Intelligence": "Journal of Applied Intelligence",
    "NeurIPS": "NIRPS",
    "OSDI": "DSRI",
    "RSS": "RSSC",
    "RecSys": "RSCS",
    "S&P": "IASP",
    "SIGMOD": "IDMC",
    "SODA": "SACA",
    "SOSP": "CSOS",
    "STOC": "SACT",
    "TACL": "JACL",
    "TODS": "JDDS",
    "TOSEM": "JSET",
    "TPAMI": "JAPM",
    "UAI": "CAIR",
    "USENIX Security": "USPS",
    "WSDM": "WDSM",
    "WWW": "CWIT",
    "arXiv": "OpenPreprint",
}


def scrub_users() -> int:
    data = json.loads(USERS.read_text())
    changed = 0
    for u in data:
        sch = u.get("microscholar")
        if not isinstance(sch, dict):
            continue
        aff = sch.get("affiliation")
        if aff in INSTITUTION_NAME:
            sch["affiliation"] = INSTITUTION_NAME[aff]
            changed += 1
        for key in ("email", "homepage"):
            val = sch.get(key)
            if isinstance(val, str) and val:
                new = replace_domain(val)
                if new != val:
                    sch[key] = new
    USERS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    return changed


def scrub_papers() -> tuple[int, set[str]]:
    lines = PAPERS.read_text().splitlines()
    out: list[str] = []
    changed = 0
    unmapped: set[str] = set()
    for ln in lines:
        if not ln.strip():
            out.append(ln)
            continue
        p = json.loads(ln)
        src = p.get("source", "")
        if src in CONFERENCE:
            p["source"] = CONFERENCE[src]
            changed += 1
        elif src:
            unmapped.add(src)
        out.append(json.dumps(p, ensure_ascii=False))
    PAPERS.write_text("\n".join(out) + "\n")
    return changed, unmapped


def main() -> None:
    u = scrub_users()
    p, unmapped = scrub_papers()
    print(f"users.json: {u} microscholar.affiliation values replaced")
    print(f"papers.jsonl: {p} source values replaced")
    if unmapped:
        print(f"  WARN: unmapped sources: {sorted(unmapped)}")


if __name__ == "__main__":
    main()
