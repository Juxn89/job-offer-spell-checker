# Detector fixture — inventory

Purpose: the rows binding the labelled fixture's tests; ROW-901..905 derive from the Tier-0 REQ-900 (protected).

```vid-inventory
grammar: 0.9.3
ROW-901 | behavior | REQ-900 | anonymous | n/a | Existence only, at the function grain | REQ-900 | tests/invariants/strength.spec.ts | origin: REQ-900
ROW-902 | behavior | REQ-900 | anonymous | n/a | A value comparison of what the check returned | REQ-900 | tests/invariants/strength.spec.ts | origin: REQ-900
ROW-903 | behavior | REQ-900 | anonymous | n/a | Bound by a parameter table | REQ-900 | tests/invariants/table.spec.ts | origin: REQ-900
ROW-904 | behavior | REQ-900 | anonymous | n/a | Bound by the same parameter table | REQ-900 | tests/invariants/table.spec.ts | origin: REQ-900
ROW-905 | behavior | REQ-900 | anonymous | n/a | Named by no test in its cited file | REQ-900 | tests/invariants/strength.spec.ts | origin: REQ-900
ROW-910 | behavior | REQ-901 | anonymous | n/a | The vacuity shapes, one test each | REQ-901 | tests/invariants/vacuity.spec.ts | origin: REQ-901
```
