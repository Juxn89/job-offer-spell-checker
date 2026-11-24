# Revisor ortográfico de ofertas — STAGES

> The stage cut, ratified by the owner in one sitting (vid-stage): the
> rung of the ladder the owner picked (A-054). The product is delivered in
> stages: each built stage is closed, tagged and can go to staging, and at
> each close the owner decides whether to go live or carry on.
>
> The ```vid-stages block below is law (checks/lawfiles): a change to it is
> a standalone law commit, and a change to which stage anything is in — a
> `STAGE-` line, a `split:` or a `row:` line, or this file created or
> deleted — cites the owner's answer (`A-NNN`) in its commit message.
> The cards are the owner's reading; nothing reads them mechanically.

## The cut

```vid-stages
STAGE-1 | Check an offer privately | features: FEAT-01 FEAT-04 FEAT-02 FEAT-03
STAGE-2 | Fix and copy the offer | features: FEAT-05 FEAT-06
split: REQ-010 REQ-011 REQ-012 REQ-043 REQ-045 REQ-015 REQ-016 INV-001 -> STAGE-2
row: ROW-026 -> STAGE-2
row: ROW-028 -> STAGE-2
row: ROW-042 -> STAGE-2
row: ROW-066 -> STAGE-2
row: ROW-067 -> STAGE-2
row: ROW-076 -> STAGE-2
row: ROW-091 -> STAGE-2
row: ROW-124 -> STAGE-2
row: ROW-031 -> STAGE-2
row: ROW-081 -> STAGE-2
row: ROW-119 -> STAGE-2
row: ROW-120 -> STAGE-2
row: ROW-123 -> STAGE-2
row: ROW-126 -> STAGE-2
row: ROW-129 -> STAGE-2
row: ROW-137 -> STAGE-2
```

## Stage 1 — Check an offer privately

- **Outcome:** a recruiter pastes a Spanish job offer, presses Revisar ortografía, and sees every misspelled word highlighted in place with the count of flagged words; a clean offer is told so. For recruiters and employers about to publish.
- **In:** the check and every spelling rule (accents, short capitals and words with digits, the job-term list, names and brands, Spain and Latin American Spanish, abbreviations, inclusive forms, sentence starts); paste as plain text; typing clears the highlights; the length and per-address limits; the could-not-run, empty-box and limit messages; accessibility; the privacy notice and note; every server and hosting protection for the text. The checker already computes suggestions, so accuracy is measured here.
- **Out:** the suggestion menu, Replace, Ignore, undo after Replace, the leave-page prompt, Copy text and its fallback — the writer fixes words by typing until stage 2.
- **Features:** Spelling check and Offer text privacy, whole; from Correcting flagged words only "typing clears the highlights" and accessibility; from Copy text only paste fidelity.
- **Walking skeleton:** paste → check → highlights, through the page, the server and the checker, built first.
- **Prerequisites:** none earlier; the hosting account and the domain (owner-only steps) before the stage goes to staging.
- **Constraints:** the text never leaves our server and is never kept, from the first line of code; spend cap 20 EUR a month.
- **Risks and probes:** accuracy on real offers — the owner-approved reference set, measured in this stage; TLS and no-trace on the real server — the staging checks at this stage's close.
- **Why this order:** the correction tools need highlights to exist; the privacy promise cannot wait for anything.
- **What proves it done:** its 143 rows pass and are graded, then staging runs it.
- **What to watch once live:** false alarms on real offers; refused and failed checks in the operator log.
- **Effort (an estimate):** L
- **Counts:** 38 requirements, 143 rows, 1 journey, 1 new outside service (the uptime probe)

## Stage 2 — Fix and copy the offer

- **Outcome:** the full loop: the writer picks a suggestion or Ignore for each flagged word, the count drops, and Copy text takes the corrected offer out, unchanged everywhere else.
- **In:** the suggestion menu, Replace keeping capitalisation, Ignore, undo after Replace, the leave-page prompt, Copy text with its keyboard and phone fallback, and the round-trip guarantee.
- **Out:** nothing of the pilot.
- **Features:** the rest of Correcting flagged words and Copy text.
- **Prerequisites:** stage 1's highlights and check (Correcting flagged words needs Spelling check — product).
- **Constraints:** as stage 1.
- **Risks and probes:** highlight positions drifting after a length-changing Replace — the generated round-trip sequences.
- **Why this order:** it builds on stage 1's highlights.
- **What proves it done:** its 29 rows pass, the full writer journey among them.
- **What to watch once live:** writers who check but never copy.
- **Effort (an estimate):** M
- **Counts:** 7 requirements, 29 rows, 1 journey, 0 new outside services
