---
name: client-room
description: Lock 12 Claudes in a room until they find the user paying clients. Four hunting methods (bad Google reviews and old websites, freelance job posts, businesses that opened this month, posts hiring people like the user), three Claudes each, then a secret vote; only the leads at least 7 of 12 agree on get out, as the top 3 clients with proof and a first message to send. Use for /client-room, "find me clients", "find me leads", "who should I pitch".
---

# The client room

Adapted for NeonKey from alexyc9381/client-room-skill at commit 5400499 (MIT, Alex Chen, see LICENSE). Security-reviewed
Nov 6 2026: no hooks, `room.py` is standard-library Python with no network calls. NeonKey changes: no prices in any message,
email only, NeonKey voice, and nothing is sent or logged without Michael.

`room.py` sits next to this file. Every file goes in `.client-room/` in the folder you are in.

## 1. The brief

Ask the user, in one message, for anything they have not already said:
- what they sell (one line, e.g. "websites for local restaurants" or "freelance video editing"),
- where (a city or area, or "remote"),
- their usual price (used only to judge whether a lead could pay; it never appears in a message).

For NeonKey, unless Michael says otherwise: sell an outcome (missed leads, slow replies, email that lands in spam, IT that
breaks), not "AI"; prefer businesses Michael already knows and remote or online work. Never door-to-door, never cold calls.

Then run `python3 room.py new "<what they sell>" --where "<where>" --price "<price>"`.

## 2. The hunt (12 Claudes, all at once)

Run `python3 room.py hunters`. It prints 12 hunters: 4 methods x 3 angles. Start one sub-agent per hunter, all in the same message
so they run in parallel and cannot see each other. Give each one this, with its own method, job and angle filled in:

> You are one of 12 Claudes locked in a room until you find this person a paying client. Read `.client-room/case.json` for what
> they sell, where, and their price. Your one job: {job} Search the web with {angle}. Find up to 3 real businesses or people who
> plausibly need what this person sells and could pay their price. For each, give the source page that proves the need (the bad
> review, the job post, the opening announcement, the hiring post), with the date if the page shows one, plus their website and a
> public contact route if you can find one. Never invent a business, a review, a quote or a link: if you can't find 3 real ones,
> return fewer. Write only this JSON to `.client-room/leads/{id}.json`:
> {"hunter": "{id}", "leads": [{"name": "...", "website": "...", "contact": "...", "need": "one line, in plain words",
> "proof": [{"url": "https://...", "note": "what this page shows, quoting it"}]}]}

When all 12 are back, run `python3 room.py merge`. It drops any lead without a source link and joins duplicates.

## 3. The secret vote (the same 12, all at once, alone)

Start 12 sub-agents again, one per hunter id, all in the same message. Give each one:

> You are {id}, one of 12 Claudes voting in secret. Read `.client-room/case.json` and the numbered leads in
> `.client-room/leads.json`. Open the proof links you need. Vote yes only for leads that (a) really show a need this person can fix,
> (b) look able to pay their price, and (c) are reachable. Vote yes on at most 5. Write only this JSON to
> `.client-room/votes/{id}.json`: {"yes": [{"n": <lead number>, "why": "one line, quoting the proof"}]}

Then run `python3 room.py tally`. The door opens only for leads with 7 or more yes votes.

## 4. The first message

For each of the top 3 leads that got out (or fewer), write one short first email the user can send. NeonKey rules:
- Name the exact thing the proof shows (quote it), and say in one line what we would do about it.
- **Never mention a price, a fee or "costs about".** No guarantees, no invented numbers, no flattery, no "I hope this finds you
  well". Do not lead with "AI".
- "We" voice, signed "NeonKey" (cold) or "Michael @ NeonKey" (someone Michael knows). American spelling, under 80 words.
- End with one easy yes/no question by email. Never ask for a phone call.

Save them as `.client-room/messages.json`: `{"messages": {"<lead number>": "<message>"}}`. Then run `python3 room.py report`.

## 5. Tell the user

Show `.client-room/REPORT.md`: the top clients, the proof for each, and the first message. If the door stayed shut, say so plainly
and suggest one change (a wider area, a clearer offer). Never send anything to anyone yourself, and never add a lead to the Lead Tracker until Michael picks it; he decides what is sent,
inside the normal daily sending caps.
