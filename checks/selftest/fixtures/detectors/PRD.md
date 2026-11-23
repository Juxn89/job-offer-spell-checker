# Detector fixture — PRD
grammar: 0.9.8.1

Purpose: the labelled fixture's requirements — one Tier-0 (its rows are protected, so strength reads them) and one Tier-1.

```vid-prd
REQ-900 | nfr | T0 | The offer text leaves the server for no outside destination. | fail-if: a marker placed in an offer reaches any outside destination | serves: G1 — fixture | authority: authoritative | source: seed | phase: pilot | feature: FEAT-01 | plain: The text never leaves the server.
REQ-901 | functional | T1 | A misspelt word is flagged. | fail-if: a misspelt word is not flagged | serves: G1 — fixture | authority: authoritative | source: seed | phase: pilot | feature: FEAT-01 | plain: Misspelt words are flagged.
```
