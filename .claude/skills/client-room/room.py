#!/usr/bin/env python3
"""The client room: 12 Claudes hunt for paying clients four ways, vote in secret, and only the clients most of them agree on get out.

    python3 room.py new "<what you sell>" --where "<city or remote>" --price "<typical price>"   start .client-room/case.json
    python3 room.py hunters                    print the 12 hunters' jobs (method + angle) as JSON
    python3 room.py merge                      merge .client-room/leads/*.json into one numbered list (duplicates joined)
    python3 room.py tally                      count .client-room/votes/*.json; the door opens for leads with 7+ of 12 yes votes
    python3 room.py report                     write .client-room/REPORT.md: the top 3, their proof and the first message

A lead without a source link is thrown out at merge, and a vote that names a lead number that doesn't exist is thrown out at tally.
"""
import json
import os
import re
import sys
from urllib.parse import urlparse

ROOM = ".client-room"
METHODS = {
    "reviews": "Reads bad Google reviews: local businesses whose reviews complain about something you fix, or whose website "
               "looks old (no mobile site, broken booking, a copyright year years out of date).",
    "jobs": "Watches job posts for work you could do freelance: posts on job boards and freelance sites asking for exactly what you sell.",
    "new": "Finds businesses that opened this month: new openings, grand openings, new listings and permits, which need everything.",
    "hiring": "Hunts posts hiring people like you: companies posting for a role you could fill as a contractor instead.",
}
ANGLES = ["the most obvious searches", "the niche or neighborhood searches", "the searches nobody else would think of"]
DOOR = 7          # yes votes (of 12) a lead needs to get out of the room


def path(*p):
    return os.path.join(ROOM, *p)


def hunters():
    out = []
    for m, job in METHODS.items():
        for k, a in enumerate(ANGLES):
            out.append({"id": f"{m}-{k + 1}", "method": m, "job": job, "angle": a})
    return out


def domain(u):
    try:
        d = urlparse(u).netloc.lower()
    except ValueError:
        return ""
    return d[4:] if d.startswith("www.") else d


def key(lead):
    name = re.sub(r"[^a-z0-9]+", " ", lead.get("name", "").lower()).strip()
    return domain(lead.get("website", "")) or name


def merge():
    merged, seen = [], {}
    d = path("leads")
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        if not f.endswith(".json"):
            continue
        try:
            data = json.load(open(os.path.join(d, f)))
        except ValueError:
            continue
        for lead in data.get("leads", []):
            proof = [p for p in lead.get("proof", []) if str(p.get("url", "")).startswith("http")]
            if not lead.get("name") or not proof:
                continue                                    # no source link, no lead
            k = key(lead)
            if k in seen:
                m = merged[seen[k]]
                m["found_by"].append(data.get("hunter", f[:-5]))
                m["proof"] += [p for p in proof if p["url"] not in {q["url"] for q in m["proof"]}]
                continue
            seen[k] = len(merged)
            merged.append({"n": len(merged) + 1, "name": lead["name"], "website": lead.get("website", ""),
                           "contact": lead.get("contact", ""), "need": lead.get("need", ""), "proof": proof,
                           "found_by": [data.get("hunter", f[:-5])]})
    json.dump({"leads": merged}, open(path("leads.json"), "w"), indent=1)
    return merged


def tally():
    leads = json.load(open(path("leads.json")))["leads"]
    valid = {l["n"] for l in leads}
    yes = {n: 0 for n in valid}
    why = {n: [] for n in valid}
    voters, thrown = 0, 0
    d = path("votes")
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        if not f.endswith(".json"):
            continue
        try:
            v = json.load(open(os.path.join(d, f)))
        except ValueError:
            continue
        voters += 1
        for item in v.get("yes", []):
            n = item.get("n") if isinstance(item, dict) else item
            if n not in valid:
                thrown += 1
                continue
            yes[n] += 1
            if isinstance(item, dict) and item.get("why"):
                why[n].append(item["why"])
    ranked = sorted(leads, key=lambda l: (-yes[l["n"]], -len(l["found_by"]), l["n"]))
    out = [{**l, "yes": yes[l["n"]], "why": why[l["n"]], "out": yes[l["n"]] >= DOOR} for l in ranked]
    json.dump({"voters": voters, "thrown_out": thrown, "door": DOOR, "leads": out}, open(path("tally.json"), "w"), indent=1)
    return out


def report():
    t = json.load(open(path("tally.json")))
    case = json.load(open(path("case.json")))
    top = [l for l in t["leads"] if l["out"]][:3]
    msgs = json.load(open(path("messages.json"))).get("messages", {}) if os.path.exists(path("messages.json")) else {}
    L = [f"# Your top {len(top)} clients", "",
         f"For: {case['offer']} ({case.get('where', '')}, about {case.get('price', '?')}). "
         f"{t['voters']} Claudes voted on {len(t['leads'])} leads; a client needed {t['door']} yes votes to get out.", ""]
    if not top:
        L += ["The door stayed shut: no lead got enough votes. Run it again with a wider area or a clearer offer.", ""]
    for i, l in enumerate(top, 1):
        L += [f"## {i}. {l['name']}  ({l['yes']} of {t['voters']} yes)", "",
              f"- Website: {l['website'] or 'none found'}", f"- Contact: {l['contact'] or 'find it on their site'}",
              f"- What they need: {l['need']}", "- Proof:"]
        L += [f"  - {p.get('note', '')} {p['url']}" for p in l["proof"][:4]]
        L += ["- Why the room voted yes:"] + [f"  - {w}" for w in l["why"][:3]]
        if msgs.get(str(l["n"])):
            L += ["", "**First message to send:**", "", "> " + msgs[str(l["n"])].replace("\n", "\n> ")]
        L += [""]
    L += ["## Everyone else the room found", ""] + [f"- {l['name']}: {l['yes']} yes" for l in t["leads"] if l not in top]
    open(path("REPORT.md"), "w").write("\n".join(L) + "\n")
    return top


def main(a):
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if a[0] == "new":
        os.makedirs(path("leads"), exist_ok=True)
        os.makedirs(path("votes"), exist_ok=True)
        opt = lambda f: a[a.index(f) + 1] if f in a and a.index(f) + 1 < len(a) else ""
        json.dump({"offer": a[1], "where": opt("--where"), "price": opt("--price")}, open(path("case.json"), "w"), indent=1)
        print(f"room ready: {path('case.json')}")
    elif a[0] == "hunters":
        print(json.dumps(hunters(), indent=1))
    elif a[0] == "merge":
        print(f"{len(merge())} leads (with source links) in {path('leads.json')}")
    elif a[0] == "tally":
        t = tally()
        print(f"{sum(l['out'] for l in t)} lead(s) got {DOOR}+ yes votes")
    elif a[0] == "report":
        print(f"{len(report())} client(s) in {path('REPORT.md')}")
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
