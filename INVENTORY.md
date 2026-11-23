# Revisor ortográfico de ofertas — TEST INVENTORY

> Ratified at init, same standing as PRD.md: the owner ratified these ROWS —
> what will be verified — before any code existed. Mechanically derived from
> three enumerable sets (PRD requirements + Fail-ifs; design pack @screen
> markers via the resolved design-join table; the scaffold's route table via
> the ratified routes extractor), plus the auth-state × surface axis and the
> genus-row proposals (origin: domain). Rows are generated, never authored;
> only exceptions are hand-touched. Additions during development are
> permitted, never silent — checks/inventory.sh fails a commit whose new
> route has no row here, and every change to this block is a law change:
> a standalone commit, nothing else in it (pre-commit, §4.1). Development is
> "make the ledger green": every row below was materialised as a failing
> ledger test at init (proved red — the red gate), or carries
> `owed: <reason>` until its test can exist.

## Row schema

    ROW-NNN | kind | subject | actor/state | marker | obligation | derived-from | test

- `kind` — `surface` · `journey` · `shell` · `behavior` · `reachability`
- `subject` — route (`/account`, in the scaffold's own literal form), screen
  id, or requirement id
- `actor/state` — `anonymous` · `candidate` · `operator:<role>` · `n/a` ·
  `(process)` (v0.9.3 3.2, R3: a machine journey or a trigger row — the
  product acting on what enters at an external input boundary, with no
  person at a browser)
- `marker` — the design pack marker this row binds to (`P03/expired`), or `n/a`
- `obligation` — one falsifiable sentence a fresh-context grader can check
- `derived-from` — `REQ-NNN` and/or a design marker; never "authored"
- a **journey** row's obligation carries the narrative followed by
  `transitions:` — one numbered item per transition, `<actor> at <state>
  · <entry control> · <action> · <next state> · <observable effect>`
  (v0.9.2 3.5, R8); an `(off_screen)` phase stays in the narrative and is
  no transition. The row is paid per transition, in a real browser,
  operating the real control; setup may reach the starting state through
  the API or a fixture and never performs a transition; the verdict pass
  returns one verdict per transition and the row is KEPT only when every
  transition is.
- a **machine journey** (v0.9.3 3.2, R3) is a journey row with actor
  `(process)`: every external input boundary ARCHITECTURE.md declares
  (feeds, uploads, webhooks, scheduled pulls, inbound mail) × every
  observable consequence the PRD promises for what enters there
  (searchable, matched, notified, exported, expired, deleted); its
  `transitions:` are the stages as the PRD states them (enter · parse ·
  store · index · notify · expire), each with its observable effect; paid
  per stage at the boundary's real entry point, the external party played
  by the harness's fake (itself a `difference` row), never a browser.
- **the deployed population** (v0.9.3 3.3, R4): every row of kind
  `journey`, and every row whose actor is `(process)`, is paid by the close
  run's deployed pass — the product's declared processes running on the
  same image, nothing inline — and that report alone is its receipt (a row
  absent from it is red, whatever the inline report says). Scoped runs stay
  inline.
- `test` — path under tests/invariants/, or `owed: <reason>` (owed rows block
  completion — checks/inventory.sh --strict and checks/coverage.sh --strict).
  One owed reason has its own standing (v0.9.1 3.6): `owed: paid by /vid
  deploy gate <1|2|3> — <what the rung observes>` — a row whose obligation
  can only be observed through something the harness substitutes (a DIF
  row's paying step, a seam with `credentials: not-yet`, a deployed
  worker consuming a schedule). Reported as `deploy-owed`, outside the
  owed gaps; completion requires it present and named, never silently
  absent; it is paid only by that rung's evidence and stamped `| paid-at:
  gate-N <date> <deploy log row>` in a law commit. Any other shape in this
  field is a GAP, never silent — a typo'd path must not exit the evidence
  join.

  **Deferral is a closed vocabulary (v0.9.2 3.2, R3).** Under a block
  whose first line inside the fence is `grammar: 0.9.2` — or `grammar:
  0.9.3`, which carries every 0.9.2 rule — an owed reason
  reads `owed: <class> — <detail>`, the class one of the table below and
  the detail naming the missing dependency and its payment point; a legal
  word alone does not pass, and any other reason is a GAP at every commit
  (`unclassed deferral`, checks/inventory.sh). "Materialised when its
  surface exists", "lands with the screen's slice", "in the slice that
  builds the subject" are not classes: they describe a red test — a test
  against a missing route or marker IS a red test, and is written. A
  block without the line keeps the pre-0.9.2 reading (any reason,
  reported).

  | class | when it is legal | detail must name |
  |---|---|---|
  | `guard-first` | a hostility probe or control sibling whose guard does not exist yet | the protection row; paid in the slice that builds it |
  | `census-armed` | a rule row before any site exists; and a rule row during a sanctioned rule-shaped repair (every enumerated site being guarded — citing a test arms the census at once) | for the repair: `sites being guarded, fix <finding id>`; paid by the owed→path flip once every site is guarded |
  | `probe-capture` | a seam probe awaiting the capture | the seam id; paid before the first client line, or at deploy gate 2 (R15) |
  | `golden-set` | the row awaits its ratified golden set | the fixture path to be ratified |
  | `fixture-source` | a fixture from an external source not yet held | the source; when it is expected |
  | `prerequisite` | a fixture or interface contract the harness lacks (a test-author pass's `unwritable: missing prerequisite`) | what is missing; paid at which slice or boundary |
  | `spec-only` | a row ratified at a spec-only init whose test is not written yet (v0.26.10.9); develop's code skeleton writes it, or, in ticket mode, the ticket that carries it | exactly `first stage`; `ticket` for a row appended under ticket mode |
  | `owner-decision` | the existing visible-debt class | `OQ-n` |
  | `reverted` | **legacy** — written by 0.9.2's develop at the two-attempt bound; 0.9.3 never writes it (a row past the bound stays materialised and is held, below) and an upgraded project keeps the rows it has | the verdict's one-line reason, quoted |
  | `paid by /vid deploy gate <1\|2\|3>` | the v0.9.1 deploy-owed form above, verbatim | what the rung observes (its own `deploy-owed=N` and `paid-at:` semantics, never re-classed) |

  The par (v0.9.2 R4): checks/inventory.sh prints `par: rows=R
  materialised=N legitimate=K (by class) deploy-owed=D other=J` under the
  line, and the red gate fails while `J > 0` or `N + K + D ≠ R` — every
  row is materialised or legitimately deferred, and the count of
  legitimate deferrals is printed at the gate. A surface row may be
  deferred ONLY as `prerequisite` naming a harness fixture the state
  needs and the harness lacks; a missing route, a 404 or a missing
  marker is a failing case of the surface instrument, never a deferral.

**A row's verdicts (v0.9.3 3.6, 3.7; R8–R11).** Under `grammar: 0.9.3` a
materialised row is ledger-tested only when its cases pass in the current
receipt AND its latest verdict is KEPT (`checks/coverage.sh --strict`,
per row, whatever the row derives from). KEPT means the promise holds in
the product AND the test observes it. BREACHED carries its class:
`product` (the product violates the Fail-if), `test` (the test cannot
observe the promise — it asserts what was already true, stops before the
effect, binds the wrong boundary) or `harness` (the instrument failed); a
row whose transitions differ takes `product` if any transition's latest
breach is, else `test`, else `harness`. A `test` or `harness` breach costs
no attempt and leaves the row `unverdicted` until a fresh verdict. Rounds,
attempts and holds are computed from the verdict events by
`checks/metrics.sh`, never written: two `product` rounds since the row's
latest KEPT, reissue or amendment hold it (`reason=bound`), two `test`
rounds likewise (`reason=test`), two `harness` rounds with no harness
repair between them (`reason=harness`). A held row stays materialised —
this field unchanged, no law commit — counts `breached`, is left out of
the automatic claim and waits for the owner; an owner answer
(`reissued`), an amendment, or a KEPT from a fix's blind re-grade releases
it. An amended obligation, or a changed `fail-if:` of the item a row
derives from, wipes the row's verdicts and its attempt history
(`checks/hooks/post-commit` records `amended row=ID sha=<commit>`); a
verdict quoted before the amendment does not count.

Every row may carry optional trailing labeled fields, in any order:

- `| origin: REQ-NNN | domain | finding-NNN | derivation <date>` — provenance:
  which requirement, genus-row proposal, grade finding, or re-derivation
  sitting produced the row.
- `| paid-at: gate-N <date> <deploy log row>` — on a deploy-owed row, the
  rung that paid it (v0.9.1 3.6); written by /vid deploy, never by a
  sandbox run.
- `| proved-red: <commit-sha>` — the commit at which the row's test was
  observed failing (§3.6). Init stamps it for materialised rows; a test added
  later records the parent commit where it was red. A row test with no
  proved-red has the same standing as `owed` — an unproved test is not
  evidence, and checks/inventory.sh counts it accordingly. The stamp is
  joined, not merely present (v0.8.1d): the sha must resolve, the cited
  file must exist at it, and the file there must name the row (its ROW id
  or its `derived-from` REQ id) — a sha at which the test was never red
  is a GAP. Cited test paths resolve against the commit under construction
  (the staged index, then HEAD), never the working tree: the rhythm is
  test (free ledger addition, observed red) → row (law commit, stamped with
  the parent) → code.
- `| golden: tests/invariants/<fixture>` and `| divergence: DIF-NNN` —
  on a row derived from a `derives: golden-set` item: the ratified golden
  set the row's test reads (one line per query: `query | must-appear |
  must-outrank | must-not-appear`, proposed by a fresh-context lens, never
  by the build or tuning context), and the difference row that legalises
  a model or engine divergence on that path. A named DIF must exist and
  carry a `paying-step:` (below) — checks/inventory.sh joins the two.

**Row shapes with no new class (v0.8.1d).** One row per independently
breakable promise of a requirement's complete block — the ROW is the
atomic unit, no sub-ids. A **trigger-existence row** (kind `behavior`,
subject the item, actor `(process)` under `grammar: 0.9.3` — so the
deployed pass pays it) for every time-worded Fail-if. A **volume row** per
list surface once a scale item exists. A **control sibling** of every
guard/never row — the allowed case demonstrably works, effect observed —
an ordinary ROW, `derived-from` the same REQ, obligation opening
`control of ROW-NNN: …`. **Property-form rows** through the public
surface: many-input datasets, and the four invariance relations —
reorder-invariance, rename-invariance of aggregates, repeat-idempotence,
unrelated-state-unchanged — each a falsifiable predicate over the
product's own outputs, never a reference implementation.

**Two tiers.** `tests/invariants/` is the ledger and the only tier rows
cite. `tests/scaffolding/` is the builder's non-law tier: implementation-
keyed instruments, never cited, never evidence, outside the coverage join,
proved-red, the extractors and the deletion tripwire; deletable without a
law commit; never run by the gate. Every fixture file under `tests/`
opens with a one-line `Provenance:` header — `hand-authored`, `captured
from <seam probe>`, or `generated by <generator path under tests/>` — so
a fixture whose expected value the system under test produced (circular)
is visible to the vacuity extractor.

## Census row classes (v0.7 — read by checks/census.sh)

    rule       | RULE-NNN | statement | census-command | tier | test
    difference | DIF-NNN  | knob | test-value | prod-value | why-safe [| paying-step: <rung> — <what re-runs against the real component>]
    exception  | EXC-NNN  | subject | census-class | why-rule-does-not-apply
    suppression| SUP-NNN  | subject | census-class | extractor-gap | fix-by

- A **rule** row's census command is its denominator — it enumerates every
  site the rule applies to; new code that adds a site is automatically in
  scope on the next run. Three forms: a ratified extractor path
  (`checks/extractors/invariant.<name>.sh`); two enumerations
  `<sites-cmd> :: <guarded-cmd>` (orphans = left minus right); or a single
  enumeration (a pure denominator the row's ledger test asserts over). The
  command may contain pipes; the statement field may not. An empty
  population is a FAILURE, never a pass (zero-denominator guard) — except
  while the rule's test is still `owed:`, when orphans AND an empty
  population report `pending` (ratified, not yet armed); materialising the
  test arms the census fail-closed.
- **State-machine variant (v0.8, §6.1).** A rule row whose statement field
  begins `state-machine <field>:` declares a transition table and is the
  landing spot for a lifecycle decision (publication status, alert
  lifecycle, consent):

      rule | RULE-NNN | state-machine <field>: draft>published published>archived | census-command | tier | test

  The declared transitions are the field's whole legal vocabulary
  (space-separated `from>to` pairs; a bare token declares a state with no
  transition, e.g. an initial state nothing transitions into). The census
  command enumerates every site that mutates or guard-reads the field,
  one line per site: `<site> <from>><to>` for a mutation, `<site> <state>`
  for a guard read. The engine convicts any site whose transition is not
  declared or whose state is outside the vocabulary — fail-closed, naming
  the site (grade brief instruction: find a state mutation outside the
  declared table). Zero-denominator, debt-awareness, and the population=1
  flag apply as for any rule row.
- A **difference** row is the only legal way for a knob to differ between
  test and prod. The census prints the full divergence table every run —
  the owner sees exactly what the green ledger did NOT validate. Every
  fake the harness substitutes is a divergence by construction — derived
  at materialisation, never waited for. A DIF that legalises a model or
  engine divergence on a golden-set item's path carries `paying-step:` —
  the deploy rung and the re-run that pays it (the golden set against
  the real component): a deferred test with a named step, never a
  permanent shrug. **The paying step `close run, profile=deployed`**
  (v0.9.3 3.3): a difference whose knob is the inline switch, a scheduler
  stand-in or the absent workers is paid by the close run's deployed pass,
  locally, and its deploy gate-2 sibling stays, narrowed to the platform
  half ("the platform's worker consumes it"); a knob whose real component
  exists only on the platform keeps `paying-step: staging`.
- An **exception** says the rule genuinely does not apply to this subject.
  Exceptions count toward the complexity law's ceremony threshold
  (CLAUDE.md §2): a rule whose exception list exceeds ~15–20% of its
  population is ceremony and is deleted.
- A **suppression** says the rule applies but the extractor cannot yet see
  the site — it never counts toward deletion and stands as a to-do against
  the extractor, printed every run. `census-class` in exception and
  suppression rows names the extractor class (`dead-path`, `divergence`,
  `reachability`, `vacuity`) for extractor orphans, and MUST name the
  specific `RULE-NNN` for a rule row's orphans — the class word is not a
  skeleton key across rules.

## Provider seam rows (v0.8 — read by checks/seams.sh)

    seam | SEAM-NNN | service | purpose | chosen: D-NNN | credentials: <held|not-yet|never> | probe: <owed | probed(YYYY-MM-DD) | unreachable-risk(reason)> | evidence: <contract-test path + captured-response path, or owed> | quirks: <one per ";", or "none yet"> [| module: <module id>]

- One row per EXTERNAL service the product depends on — payments, mail,
  feeds, search, auth, storage: anything on the other side of the network
  this repo does not own. Two discovery doors (§3.2): init's architecture
  step declares known seams (an external boundary without a row cannot be
  ratified), and checks/seams.sh rejects a staged outbound destination no
  row covers — discovery is mechanical, not remembered.
- **Born owing a probe** — same debt semantics as every other row. Two
  legal exits: pay it (`probe: probed(date)`) or declare
  `unreachable-risk(reason)` with the reason stated. Never silent coverage.
- **The probe (§3.3) comes before the first client line:** the smallest
  real calls that answer the questions — never discover a limit by
  exceeding it (that is load-testing someone else's service; where docs
  are silent, chunk conservatively). Observed shapes, error semantics, and
  identifier-namespace behavior are written into the contract tests the
  evidence field names; the captured response becomes those tests' sample
  data — the surviving, shape-scoped form of fixture provenance. Contract
  tests are ledger additions (free) and are how the probe is paid; the row
  flip `owed → probed(date)` is a law change, standalone.
- Routing per the two-channel rule: a technical quirk is logged in the
  quirks field and pinned by a contract test; a quirk touching product
  meaning ("empty response cannot be distinguished from a broken feed")
  goes to the owner as a product question, never a silent log line.
- Optional `| module: <module id>` names the module of ARCHITECTURE.md's
  module table that talks to the service (its Module column, a dotted
  label read as a path). The project viewer lists the service among that
  module's contracts; no court reads it.
- Optional trailing `| match: <tokens>` names the greppable tokens that
  identify code touching this seam (client-library import names,
  hostnames, space-separated). Absent, the service field is the match
  token. Pick tokens that will not legitimately occur otherwise — the
  vid-forbidden rule, applied here.
- checks/seams.sh (presence-gated, fail-closed): app-source additions
  matching an OWED seam's tokens are rejected naming the row (tests/ is
  exempt — contract tests are the probe's own artifact); a staged outbound
  destination covered by no seam row demands one before the code lands. A
  destination that is content, not an outbound call (a footer link), takes
  an exception row naming class `seam`.
- The grade brief carries this table with a standing instruction — find a
  behavior of this service the probe did not pin. vid-deploy's "one real
  action per provider seam" gate is these rows' re-verification, not a
  separate concept.

## Hostility rows (v0.8 §4 — read by checks/inventory.sh)

    hostility | HOS-NNN | attempt | protects: <RULE-NNN|REQ-NNN|ROW-NNN> | disable: <toggle> | test [| proved-red: <sha>]

- One row per **Tier-0 protection**: the sibling of a ratified Tier-0 rule
  row (`tier` = 0) or Tier-0 requirement, which *attempts the forbidden
  thing* against the locally running app through its real public surface,
  in the same Docker-only harness as every other ledger test. Reads confirm
  a guard is present and correct; only an attempt establishes that it
  holds. The measured class: a correct publication guard defeated by a
  different path erasing the state it read, and a rate-limit bound defeated
  by one rotated client-identity header — both present, both correct, both
  bypassed. The must-never-happen list, executed instead of trusted.
- `attempt` — one falsifiable sentence naming the forbidden thing the probe
  commits, never the guard it hopes to meet ("submit the same form twice
  concurrently, expect exactly one record", not "double-submit is guarded").
- `protects:` — the ratified protection this row is a sibling of: a
  Tier-0 rule row, a Tier-0 requirement, or a Tier-0 ROW (a ratified genus
  protection — the court resolves a ROW target to its REQ). Absent,
  the row is a sibling of nothing and is rejected.
- `disable:` — the named, reversible way that protection is turned OFF so
  the probe can be watched failing. Required; `none` and `n/a` are not
  values. It is a LOCAL mutation performed at materialisation and reverted
  in the same sitting (remove the guard clause, build without it) — never a
  runtime switch that ships. A guard with a production kill-switch is not a
  guard; the toggle is written down so the ritual can be re-run, not so the
  product can be unlocked.
- `test` — path under tests/invariants/, or `owed: <reason>`, as for any row.
- `proved-red:` is **mandatory** here, not optional as it is for a ROW row:
  a cited probe test with no proved-red is a GAP, not debt. A probe never
  observed failing is not evidence, and unlike an ordinary row it is
  evidence with the polarity that reassures.

### The bounded set

Derived mechanically from the ratified Tier-0 protections, never invented:
~one probe per Tier-0 protection (10–15 for a mid-sized product). A fixed
list — explicitly not a fuzzer, not a scanner, no generated or open-ended
input exploration. Probes beyond the ratified protections are ceremony and
are deleted under the complexity law; the way to add one is to ratify the
protection it is the sibling of. The shapes these protections take,
stated as behavior so they carry to any stack:

- concurrent double-submit of the same action → exactly one record
- a replayed one-time link or token → exactly one effect, one timestamp
- a valid session for actor A requesting actor B's resource → refused, with
  an audit entry
- a transition attempted out of a state that forbids it (reject, then
  publish) → refused, whichever path sets the state
- a rotated client-identity header against a rate limit → the bound holds
- refresh mid-flow, expired-form resubmit, stale-state action → no double
  effect
- **dependency failure during the protected operation** (v0.8.1d): the
  seam the operation touches fails mid-way → the forbidden effect does
  not occur and the failure is recorded, never a silent success; the
  `disable:` toggle is the fail-closed handling itself (the measured
  class: an erasure that failed open when its store was down, whose probe
  counted residue through the pointer it had just blanked)
- **concurrency against the protected operation** (v0.8.1d): two
  simultaneous attempts → exactly one effect; the toggle is the
  serialisation guard

### The fail-first ritual (mandatory, §4.2)

A hostility probe passing proves nothing until it has been watched failing:
"refused" is equally green when the attempt was malformed and never reached
the guard at all. At materialisation, in one sitting, per probe:

1. **Prove the runner can go red** — invoke it with a selector naming a test
   that does not exist. Runners commonly exit 0 on a selection that matches
   nothing; wired that way, every probe below is a green that can never go
   red, which is worse than no probe at all. If it exits 0, fix the
   invocation before any probe is trusted.
2. **Disable** the protection by the row's own `disable:` toggle and run the
   probe. It MUST fail, and fail on its assertion about the forbidden effect
   — not on a connection error, a 404, or a fixture fault. A red for the
   wrong reason is the same false assurance in the other direction.
3. **Restore** the protection and run the probe. It MUST pass.
4. **Stamp** `proved-red: <sha>` — the commit at which step 2 was observed.

A probe with no verified failing state is REJECTED at materialisation: the
row stays `owed:` until the ritual is performed. checks/inventory.sh
enforces the mechanical half — a missing `protects:`, a missing or `none`
`disable:` toggle, and a cited test with no `proved-red` are GAPs that fail
the commit; a Tier-0 rule row with no hostility sibling is owed debt that
blocks completion (`--strict`). The honesty of steps 1–3 is the builder's,
and the row is what the graders read.

Granularity is **screen × state** — the zero-results, expired, and error
variants are where gaps hide. Mandatory row classes, generated, not
judged: (1) every drawn screen × state, one surface row per applicable auth
state; (2) every requirement with a Fail-if, one behavior row; (3) **the
shell** in each auth state — header, footer, primary nav, error pages, empty
states; (4) reachability — every required surface reachable from an entry
point in its auth state, every default-navigation link resolves, a session
implies a sign-out control, no anonymous-only control shown authenticated or
vice versa; (5) every critical PRD journey end-to-end, one row each.

Browser-class rows (shell, reachability, journeys, the surface
instrument) are ledger tests in the engines the harness contract declares,
inside the container-only harness. **The sizing is law (v0.9.2 3.4,
R7):** ~5 shell rows + ~10 journey rows + one instrument for all screens
— written, for new projects, as a ledger test file per screen (its states
together, up to 5 rows a file; v0.9.8.1 R18), every file through the one
measure module, produced by the surface test-author pass
from the rows, the canvases and the measure module, one case per surface
row (screen × state × auth state), loading each state once per engine,
reading every load-bearing paint property in one evaluate, checking the
state's content, stray controls (the denominator: the whole page minus
the shell) and console errors, then the row's `pins:` hook on that same
loaded page. Surface rows cite their screen's file (its head carries the
row table); a surface test, or a pins hook, written by the builder is a
defect. Other new test files hold one row, or up to 5 related rows.

## Rows

```vid-inventory
grammar: 0.9.3
ROW-001 | behavior | REQ-001 | anonymous | n/a | A word missing its accent (gestion, tecnico) is flagged, and a correctly spelled dictionary word is not, over a generated sample of dictionary words and their accent-stripped forms, leaving out every accent-stripped form that is itself a dictionary word | REQ-001 | tests/invariants/test-req001-row001-missing-accent-flagged.api.spec.ts | origin: REQ-001 | proved-red: 96fa81b9f960
ROW-002 | behavior | REQ-001 | anonymous | n/a | Each flagged word is highlighted at its own position in the text, including when the same word occurs several times and only one occurrence is misspelled | REQ-001 | tests/invariants/test-req001-row002-highlight-at-own-position.page.spec.ts | origin: REQ-001 | proved-red: 96fa81b9f960
ROW-003 | behavior | REQ-002 | anonymous | n/a | After a check the count line states exactly the number of highlighted words | REQ-002 | owed: spec-only — first stage | origin: REQ-002
ROW-004 | behavior | REQ-002 | anonymous | n/a | An offer with no misspelling shows the no-spelling-errors message and no highlight | REQ-002 | owed: spec-only — first stage | origin: REQ-002
ROW-005 | behavior | REQ-003 | anonymous | n/a | All-capital words of 5 letters or fewer (SQL, SAP, RRHH) and words with a digit (B2B, 3D) are never flagged | REQ-003 | owed: spec-only — first stage | origin: REQ-003
ROW-006 | behavior | REQ-003 | anonymous | n/a | control of ROW-005: an all-capital word longer than 5 letters missing its accent (GESTION) is flagged | REQ-003 | owed: spec-only — first stage | origin: REQ-003
ROW-007 | behavior | REQ-004 | anonymous | n/a | JavaScript, Python, Excel, backend, frontend, freelance, home office, marketing, software and Scrum, correctly written, are not flagged | REQ-004 | owed: spec-only — first stage | origin: REQ-004
ROW-008 | behavior | REQ-004 | anonymous | n/a | control of ROW-007: a misspelling of a term-list word (Javscript, fronted) is flagged | REQ-004 | owed: spec-only — first stage | origin: REQ-004
ROW-009 | behavior | REQ-005 | anonymous | n/a | A correct word next to ¿, ¡, a comma, a bracket or a quote is not flagged, and no punctuation mark is ever highlighted | REQ-005 | owed: spec-only — first stage | origin: REQ-005
ROW-010 | behavior | REQ-005 | anonymous | n/a | A hyphenated word whose parts are all correct is not flagged, and one with a misspelled part is flagged at that part | REQ-005 | owed: spec-only — first stage | origin: REQ-005
ROW-011 | behavior | REQ-005 | anonymous | n/a | A correct word pasted with decomposed accents (NFD) is not flagged, and a word with an inner apostrophe is checked as one word | REQ-005 | owed: spec-only — first stage | origin: REQ-005
ROW-012 | behavior | REQ-006 | anonymous | n/a | candidato/a, todos/as, l@s, tod@s, todxs and todes are not flagged, and an inclusive form on a misspelled base (canditado/a) is flagged | REQ-006 | owed: spec-only — first stage | origin: REQ-006
ROW-013 | behavior | REQ-007 | anonymous | n/a | No part of a web address, an email address or an @handle is flagged, including one with misspelling-like parts | REQ-007 | owed: spec-only — first stage | origin: REQ-007
ROW-014 | behavior | REQ-007 | anonymous | n/a | Lic., Ing., Sr., Sra., Dr., Dra. and etc. are not flagged | REQ-007 | owed: spec-only — first stage | origin: REQ-007
ROW-015 | behavior | REQ-008 | anonymous | n/a | computadora, ordenador, celular, móvil, tenés, sólo and éste are not flagged, and guión is flagged | REQ-008 | owed: spec-only — first stage | origin: REQ-008
ROW-016 | behavior | REQ-009 | anonymous | n/a | A capitalised mid-sentence name not in the dictionary (Tecnosoluciones, Tegucigalpa) is not flagged | REQ-009 | owed: spec-only — first stage | origin: REQ-009
ROW-017 | behavior | REQ-009 | anonymous | n/a | A misspelled first word of a sentence (Buscamso) is flagged, and a capitalised mid-sentence word whose accented form is a dictionary word (Gestion, Informatica) is flagged | REQ-009 | owed: spec-only — first stage | origin: REQ-009
ROW-018 | behavior | REQ-035 | anonymous | n/a | A misspelled capitalised first word of a bullet line, a heading line, a numbered line, or after a colon (Gestion in a bullet, Ubicacion before a colon) is flagged | REQ-035 | owed: spec-only — first stage | origin: REQ-035
ROW-019 | behavior | REQ-035 | anonymous | n/a | A correct name after Lic., Sr. or Dr. is not flagged | REQ-035 | owed: spec-only — first stage | origin: REQ-035
ROW-020 | behavior | REQ-010 | anonymous | n/a | Opening a highlighted word by click or by Enter shows at most 5 suggestions and an Ignore choice, over a generated sample of one-letter and accent errors | REQ-010 | tests/invariants/test-req010-suggestion-menu.page.spec.ts | origin: REQ-010 | proved-red: d58a3cf
ROW-021 | behavior | REQ-010 | anonymous | n/a | For a one-letter or accent error (gestion) the expected correction is the first suggestion, over a generated sample of dictionary words with one letter or accent changed | REQ-010 | tests/invariants/test-req010-suggestion-quality.api.spec.ts | origin: REQ-010 | proved-red: d58a3cf
ROW-022 | behavior | REQ-010 | anonymous | n/a | A flagged word with no suggestion shows Sin sugerencias beside Ignore, never an empty list | REQ-010 | tests/invariants/test-req010-suggestion-menu.page.spec.ts | origin: REQ-010 | proved-red: d58a3cf
ROW-023 | behavior | REQ-011 | anonymous | n/a | Choosing a suggestion replaces only that occurrence, keeps its capitalisation (Gestion becomes Gestión), removes its highlight and lowers the count by one, every other character unchanged | REQ-011 | tests/invariants/test-req011-replace-keeps-case.page.spec.ts | origin: REQ-011 | proved-red: d58a3cf
ROW-024 | behavior | REQ-012 | anonymous | n/a | Ignore removes the highlight of that one occurrence only, lowers the count by one, leaves the text unchanged, and the word is flagged again on the next check | REQ-012 | tests/invariants/test-req012-ignore-one-occurrence.page.spec.ts | origin: REQ-012 | proved-red: d58a3cf
ROW-025 | behavior | REQ-013 | anonymous | n/a | Typing after a check clears every highlight and the count line, and no check runs until Check spelling is pressed again | REQ-013 | tests/invariants/test-req013-only-a-text-change-clears-the-check.page.spec.ts | origin: REQ-013 | proved-red: d58a3cf
ROW-026 | behavior | REQ-013 | anonymous | n/a | After typing, no stale suggestion menu can be applied: choosing a suggestion from a menu opened before the edit changes no character | REQ-013 | tests/invariants/test-req013-only-a-text-change-clears-the-check.page.spec.ts | origin: REQ-013 | proved-red: d58a3cf
ROW-027 | behavior | REQ-014 | anonymous | n/a | Pasting formatted text from a word processor (bold, links, colours) keeps plain text only | REQ-014 | tests/invariants/test-req014-paste-keeps-plain-text-and-layout.page.spec.ts | origin: REQ-014 | proved-red: d58a3cf
ROW-028 | behavior | REQ-014 | anonymous | n/a | Line breaks, blank lines, bullet characters, tabs and runs of spaces survive paste and any number of checks, replacements and ignores exactly | REQ-014 | tests/invariants/test-req014-paste-keeps-plain-text-and-layout.page.spec.ts | origin: REQ-014 | proved-red: d58a3cf
ROW-029 | behavior | REQ-015 | anonymous | n/a | Copy text puts exactly the box's current text, replacements included, on the clipboard and shows a confirmation | REQ-015 | tests/invariants/test-req015-copy-text-and-its-fallback.page.spec.ts | origin: REQ-015 | proved-red: d58a3cf
ROW-030 | behavior | REQ-016 | anonymous | n/a | With clipboard access refused, Copy text selects all the text, tells the writer to press Ctrl+C (Cmd+C on a Mac), and does not claim the text was copied | REQ-016 | tests/invariants/test-req015-copy-text-and-its-fallback.page.spec.ts | origin: REQ-016 | proved-red: d58a3cf
ROW-031 | behavior | INV-001 | anonymous | n/a | Property form: over generated sequences of checks, replacements and ignores on generated offers, the text Copy text returns differs from the pasted text only at the replaced words; each generated sequence holds at least one replacement that changes the word's length placed before another flagged word on the same line, followed by a second Replace and Copy text | INV-001, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015 | tests/invariants/test-inv001-copy-returns-the-paste-changed-only-at-replacements.page.spec.ts | origin: INV-001 | proved-red: d58a3cf
ROW-032 | behavior | page | anonymous | n/a | No network request the page sends during and after a check of an offer carrying a unique marker goes to any host other than our own server | REQ-017 | owed: spec-only — first stage | origin: REQ-017
ROW-033 | behavior | server | n/a | n/a | The server, run with outbound network blocked, checks an offer carrying a unique marker successfully, and no outbound connection attempt of any kind (DNS query or connection to any host other than our own) is made by the server process during or after the check | REQ-017 | owed: spec-only — first stage | origin: REQ-017
ROW-034 | behavior | page | anonymous | n/a | After checks of an offer carrying a unique marker, including a refused and a failed check and a reload, the marker is absent from local storage, session storage, IndexedDB and cookies | REQ-018 | owed: spec-only — first stage | origin: REQ-018
ROW-035 | behavior | server | n/a | n/a | After checks of an offer carrying a unique marker, including a 10,001-character refusal, a rate-limit refusal, a malformed request and a forced checker failure, the marker is in no file anywhere in the server and proxy containers; Each marker check plants three forms (a digit-free unknown word that gets flagged, a title-case mid-sentence pseudo-name, and a phrase of correct words), and the search covers decompressed rotated logs and the escaped, base64 and lower-cased forms of each | REQ-018 | owed: spec-only — first stage | origin: REQ-018
ROW-036 | behavior | logs | n/a | n/a | After the same checks, the marker is in no application, proxy, access or error log line and in no error report; Each marker check plants three forms (a digit-free unknown word that gets flagged, a title-case mid-sentence pseudo-name, and a phrase of correct words), and the search covers decompressed rotated logs and the escaped, base64 and lower-cased forms of each | REQ-018 | owed: spec-only — first stage | origin: REQ-018
ROW-037 | behavior | REQ-018 | anonymous | n/a | control of ROW-035: the marker offer is checked normally and its misspellings are returned and highlighted | REQ-018 | owed: spec-only — first stage | origin: REQ-018
ROW-038 | behavior | network | n/a | n/a | The proxy in the deployed shape terminates TLS itself on the product's own server (the Caddyfile serves the site with its own certificate, no upstream TLS proxy is configured) | REQ-038 | owed: spec-only — first stage | origin: REQ-038
ROW-039 | behavior | hosting | n/a | n/a | The proxy's request logging records no request body for any request, including the check request | REQ-038 | owed: spec-only — first stage | origin: REQ-038
ROW-040 | behavior | REQ-019 | anonymous | n/a | The one-line notice under the text box says the text is checked on our server and is not saved | REQ-019 | owed: spec-only — first stage | origin: REQ-019
ROW-041 | behavior | REQ-019 | anonymous | n/a | Loading the page and running a check sets no cookie and loads no analytics or tracking script | REQ-019 | owed: spec-only — first stage | origin: REQ-019
ROW-042 | behavior | page | anonymous | n/a | An offer containing markup and a script tag is shown back as plain text: no markup renders and no script runs, in highlights, suggestions and messages | REQ-020 | owed: spec-only — first stage | origin: REQ-020
ROW-043 | behavior | page | anonymous | n/a | The page loads no script, font, style or image from any other host | REQ-020 | owed: spec-only — first stage | origin: REQ-020
ROW-044 | behavior | server | n/a | n/a | A plain-http request to any path receives a redirect to HTTPS and no page content | REQ-020 | owed: spec-only — first stage | origin: REQ-020
ROW-045 | behavior | page | anonymous | n/a | An offer of 10,001 characters is refused with a message naming the 10,000-character limit, nothing is checked or cut, and the text stays in the box untouched | REQ-021 | owed: spec-only — first stage | origin: REQ-021
ROW-046 | behavior | server | n/a | n/a | A check request of 10,001 characters sent directly to the server, not through the page, is refused | REQ-021 | owed: spec-only — first stage | origin: REQ-021
ROW-047 | behavior | REQ-021 | anonymous | n/a | control of ROW-045: an offer of exactly 10,000 characters is checked | REQ-021 | owed: spec-only — first stage | origin: REQ-021
ROW-048 | behavior | page | anonymous | n/a | A 31st check within one minute from one address is refused with a message to wait a moment, the text in the box untouched | REQ-022 | owed: spec-only — first stage | origin: REQ-022
ROW-049 | behavior | server | n/a | n/a | A 31st check request within one minute from one address sent directly to the server is refused, whatever client-controlled header (X-Forwarded-For, Forwarded) it rotates | REQ-022 | owed: spec-only — first stage | origin: REQ-022
ROW-050 | behavior | REQ-022 | anonymous | n/a | control of ROW-048: the 30th check within a minute is accepted, and a check from a second address is accepted while the first is refused | REQ-022 | owed: spec-only — first stage | origin: REQ-022
ROW-051 | behavior | REQ-023 | anonymous | n/a | At a phone width of 360 pixels every control is reachable and the page does not scroll sideways | REQ-023 | owed: spec-only — first stage | origin: REQ-023
ROW-052 | behavior | REQ-023 | anonymous | n/a | p95 time from press to highlights for 1,000-word offers is at most 2 seconds | REQ-023 | owed: paid by /vid deploy gate 2 — measured against staging under the mid-range phone and 4G profile | origin: REQ-023
ROW-053 | behavior | REQ-034 | anonymous | n/a | p95 time from a first visit until the box accepts text and the button can be pressed is at most 3 seconds | REQ-034 | owed: paid by /vid deploy gate 2 — measured against staging under the mid-range phone and 4G profile | origin: REQ-034
ROW-054 | behavior | REQ-024 | (process) | n/a | Trigger: an outside probe is registered against the deployed checker, checks the fixed sample text every 5 minutes, its last firing is recorded, and an outage appears in the month's availability figure | REQ-024 | owed: paid by /vid deploy gate 2 — the outside probe registered against staging, firing every 5 minutes, an induced outage recorded | origin: REQ-024
ROW-055 | behavior | REQ-024 | anonymous | n/a | The fixed sample text the probe sends is shipped in the code and a check of it returns its known expected result | REQ-024 | owed: spec-only — first stage | origin: REQ-024
ROW-056 | behavior | REQ-025 | anonymous | n/a | When the checker cannot run (server down, server error, timeout), the page shows the plain could-not-run message, never a technical error or a no-errors result, and the text stays untouched | REQ-025 | owed: spec-only — first stage | origin: REQ-025
ROW-057 | behavior | REQ-026 | anonymous | n/a | Pressing Check spelling with an empty or blank box sends no check, shows no count or no-errors message, and shows the prompt to write or paste an offer | REQ-026 | owed: spec-only — first stage | origin: REQ-026
ROW-058 | behavior | REQ-027 | n/a | n/a | A failed, a refused and an erroring check each leave one operator log line holding only its kind and time | REQ-027 | owed: spec-only — first stage | origin: REQ-027
ROW-059 | behavior | REQ-027 | (process) | n/a | Trigger: a daily count per kind can be read from the operator log by the command the deployed shape provides | REQ-027 | owed: spec-only — first stage | origin: REQ-027
ROW-060 | behavior | REQ-028 | anonymous | n/a | The page footer shows the contact email address set at deployment | REQ-028 | owed: spec-only — first stage | origin: REQ-028
ROW-061 | behavior | REQ-028 | n/a | n/a | Mail sent to the footer's contact address is delivered to a person and does not bounce | REQ-028 | owed: paid by /vid deploy gate 2 — a mail sent to the configured production contact address is received | origin: REQ-028
ROW-062 | behavior | REQ-029 | n/a | n/a | A fresh container built from the code alone, with no network at run time, runs checks, and two fresh builds return identical flags and suggestions for the same offer | REQ-029 | owed: spec-only — first stage | origin: REQ-029
ROW-063 | behavior | REQ-030 | n/a | n/a | On the approved reference set: at least 95% of marked misspellings flagged, at most 1 correct word in 500 flagged, the right correction among the suggestions for at least 90% of flagged misspellings; a flag counts only at the marked position, and recall is also reported per kind and per variant (Spain, Latin America) | REQ-030 | owed: golden-set — tests/invariants/golden/reference-offers.txt, proposed by a fresh-context lens and approved by the owner before tuning (REQ-037) | origin: REQ-030
ROW-064 | behavior | REQ-036 | n/a | n/a | The reference set holds at least 30 offers and at least 200 marked misspellings, at least half accent errors, Spain and Latin America within one offer of each other, and every named kind of content present; each named kind (all-capital title, bullet or heading first word, inclusive form, word beside a URL or email, Latin American vocabulary) carries at least 3 marked misspellings; no marked misspelling is a word accepted under REQ-008 or a word correct both with and without its accent; every marked misspelling carries its position | REQ-036 | owed: golden-set — tests/invariants/golden/reference-offers.txt, proposed by a fresh-context lens and approved by the owner before tuning (REQ-037) | origin: REQ-036
ROW-065 | behavior | REQ-037 | n/a | n/a | The reference set's content hash matches the hash in the owner's recorded approval; any change without a new approval fails | REQ-037 | owed: golden-set — tests/invariants/golden/reference-offers.txt, proposed by a fresh-context lens and approved by the owner before tuning (REQ-037) | origin: REQ-037
ROW-066 | behavior | REQ-031 | anonymous | n/a | An automated WCAG 2.2 AA scan finds no failure on the page in its empty, checked, menu-open, refused and failed states | REQ-031 | tests/invariants/test-req031-accessibility-of-the-correction-loop.page.spec.ts | origin: REQ-031 | proved-red: d58a3cf
ROW-067 | behavior | REQ-031 | anonymous | n/a | Check spelling, each highlighted word, the suggestion list, Ignore and Copy text are reachable and usable from the keyboard alone | REQ-031 | tests/invariants/test-req031-accessibility-of-the-correction-loop.page.spec.ts | origin: REQ-031 | proved-red: d58a3cf
ROW-068 | behavior | REQ-031 | anonymous | n/a | A highlighted word is exposed to assistive technology as flagged, and a change of the count line is announced through a live region | REQ-031 | tests/invariants/test-req031-accessibility-of-the-correction-loop.page.spec.ts | origin: REQ-031 | proved-red: d58a3cf
ROW-069 | behavior | server | n/a | n/a | After checks from a known address, the address is in no file or cache on the server, and the address stops counting toward the limit one minute after its last check | REQ-032 | owed: spec-only — first stage | origin: REQ-032
ROW-070 | behavior | logs | n/a | n/a | No log line on the server or proxy carries a full IP address | REQ-032 | owed: spec-only — first stage | origin: REQ-032
ROW-071 | behavior | logs | (process) | n/a | Trigger: the deployed shape rotates every request log so that no line older than 7 days exists | REQ-032 | owed: spec-only — first stage | origin: REQ-032
ROW-072 | behavior | logs | (process) | n/a | On the deployed servers, no request log line older than 7 days exists | REQ-032 | owed: paid by /vid deploy gate 2 — the staging server's log files and rotation inspected after a forced rotation | origin: REQ-032
ROW-073 | behavior | REQ-033 | anonymous | n/a | The footer links to the privacy note, and the note says the offer's text is processed in memory only and never kept, the IP address is held briefly for the abuse limit, request logs hold no full IP and are deleted within 7 days, and nothing else is collected | REQ-033 | owed: spec-only — first stage | origin: REQ-033
ROW-074 | behavior | network | n/a | n/a | On staging, every A and AAAA record of the domain resolves to our server, and the TLS peer certificate, compared over IPv4 and over IPv6 separately, is the one Caddy holds on our server | REQ-038 | owed: paid by /vid deploy gate 2 — TLS peer and DNS resolution of the staging check endpoint inspected | origin: REQ-038
ROW-075 | behavior | server | n/a | n/a | On staging, after checks of an offer carrying a unique marker, the marker is absent from every file and log on the server, including the container runtime's logs | REQ-018 | owed: paid by /vid deploy gate 2 — the staging server searched for the marker after marker checks | origin: REQ-018
ROW-076 | shell | / | anonymous | n/a | The page shell in Spanish: title, text box, Check spelling, Copy text, the privacy notice, and a footer with the contact address and the privacy-note link; no console error on load | REQ-019, REQ-028, REQ-033 | tests/invariants/test-req019-row076-checker-page-shell.page.spec.ts | origin: REQ-019 | proved-red: a190c1c63a72
ROW-077 | shell | error-pages | anonymous | n/a | An unknown path returns a plain Spanish not-found page with a link back to the checker, and no error page reveals a stack trace, a file path or a framework name | REQ-025 | tests/invariants/test-req025-row077-not-found-and-error-pages.api.spec.ts | origin: REQ-025 | proved-red: a190c1c63a72
ROW-078 | shell | privacy | anonymous | n/a | The privacy-note page has the shell's footer and a link back to the checker | REQ-033 | tests/invariants/test-req033-row078-privacy-page-footer-and-back-link.page.spec.ts | origin: REQ-033 | proved-red: a190c1c63a72
ROW-079 | reachability | / | anonymous | n/a | The checker page is the site's entry point at its root address over HTTPS | REQ-020 | owed: prerequisite — the harness has no TLS-terminating proxy and no HTTPS address (D-025); paid at the stage-1 step that builds deploy/ and adds the proxy to the harness | origin: REQ-020
ROW-080 | reachability | privacy | anonymous | n/a | The privacy note is reached from the footer link of the checker page, and every link on both pages resolves | REQ-033 | owed: spec-only — first stage | origin: REQ-033
ROW-081 | journey | writer | anonymous | n/a | The writer pastes an offer, checks it, fixes and ignores the flagged words, and copies it out. transitions: 1. anonymous at empty page · text box · pastes a formatted offer holding gestion, a brand name and one more misspelling · offer in box · the text is shown plain, line breaks kept; 2. anonymous at offer in box · Check spelling · press · checked · three words highlighted and the count line says 3; 3. anonymous at checked · the highlighted gestion · open, choose gestión · two flagged · the word reads gestión, its highlight gone, count 2; 4. anonymous at two flagged · the highlighted brand name · Ignore · one flagged · text unchanged, count 1; 5. anonymous at one flagged · the last highlighted word · choose its first suggestion · none flagged · count 0; 6. anonymous at none flagged · Copy text · press · copied · the clipboard holds the pasted text with exactly the two replacements, and a confirmation shows | REQ-001, REQ-002, REQ-010, REQ-011, REQ-012, REQ-014, REQ-015 | tests/invariants/test-req001-row081-writer-journey.page.spec.ts | origin: REQ-001 | proved-red: 54925f8584b5
ROW-082 | journey | writer-clean | anonymous | n/a | A writer with a clean offer is told so. transitions: 1. anonymous at empty page · text box · pastes an offer with no misspelling · offer in box · text shown plain; 2. anonymous at offer in box · Check spelling · press · checked · the no-spelling-errors message shows and nothing is highlighted | REQ-002 | tests/invariants/test-req002-row082-clean-offer-journey.page.spec.ts | origin: REQ-002 | proved-red: 54925f8584b5
ROW-083 | behavior | server | n/a | n/a | Pathological offers within the limit (one 10,000-letter token, thousands of distinct unknown words, regex-backtracking URL and email strings) are answered or refused within the server's check timeout, and a concurrent ordinary check is still answered | REQ-021, REQ-023, REQ-025 | owed: spec-only — first stage | origin: domain
ROW-084 | behavior | server | n/a | n/a | Malformed check requests (raw body over the byte cap, text not a string, invalid JSON or UTF-8, deeply nested JSON) get a plain refusal with no internals, the byte cap applied before the body is read in full, and ordinary checks are still answered | REQ-021, REQ-025 | owed: spec-only — first stage | origin: domain
ROW-085 | behavior | server | n/a | n/a | Words such as __proto__, constructor, toString and valueOf, in the text and as JSON keys, give an ordinary result with no server error, and a later check of the fixed sample text returns exactly its known result | REQ-001, REQ-025 | owed: spec-only — first stage | origin: domain
ROW-086 | behavior | server | n/a | n/a | A connection that stalls before completing a check request is closed after a timeout, and one address cannot hold more than a small fixed number of checks in flight while a second address is still answered | REQ-022, REQ-024 | owed: spec-only — first stage | origin: domain
ROW-087 | behavior | server | n/a | n/a | The per-address limit counts one IPv6 /64 as one address, and an IPv4 address and its ::ffff-mapped form as the same address: a 31st check within a minute split across either is refused | REQ-022 | owed: spec-only — first stage | origin: A-037
ROW-088 | behavior | server | n/a | n/a | Under check requests from very many distinct addresses, the limiter's memory stays under a fixed ceiling, its entries are gone one minute after their last check, and an ordinary check is still answered | REQ-022, REQ-032 | owed: spec-only — first stage | origin: domain
ROW-089 | behavior | server | n/a | n/a | A check request carrying a foreign Origin, or a content type other than JSON, is refused, and no response carries an Access-Control-Allow-Origin naming another origin or the wildcard | REQ-039 | owed: spec-only — first stage | origin: A-038
ROW-090 | behavior | server | n/a | n/a | Every check response carries Cache-Control: no-store, and after a marker check, navigating away and reopening, the marker is absent from the browser's HTTP cache | REQ-018 | owed: spec-only — first stage | origin: domain
ROW-091 | behavior | page | anonymous | n/a | With scripts disabled and before the page script loads, pressing Check spelling or Enter changes no URL and sends no request carrying the text, and across a full check, menu and Replace no request URL holds the marker or a flagged word | REQ-018 | owed: spec-only — first stage | origin: domain
ROW-092 | behavior | logs | n/a | n/a | A request carrying the marker in its path or query string, refused or not found, leaves the marker in no log line and no error report; logs record paths without query strings | REQ-018 | owed: spec-only — first stage | origin: domain
ROW-093 | behavior | server | n/a | n/a | Paths such as /.env, /.git/config, /Caddyfile, the compose file, package.json, any dotfile and any directory return the plain not-found page; only the built page assets and the privacy note are served | REQ-020 | owed: spec-only — first stage | origin: domain
ROW-094 | behavior | server | n/a | n/a | The app reads the client address from forwarded headers only when the connection comes from the proxy; from any other peer it uses the socket address | REQ-022 | owed: spec-only — first stage | origin: domain
ROW-095 | behavior | server | n/a | n/a | From outside the server only ports 80 and 443 (and SSH) answer; the app's port, the proxy's admin API and the Docker API are refused | REQ-020, REQ-022, REQ-038 | owed: paid by /vid deploy gate 2 — the staging server's open ports scanned from outside | origin: domain
ROW-096 | behavior | server | n/a | n/a | Through the real Docker and proxy path, checks from an IPv4 and an IPv6 client are counted against each client's own address, never a gateway or proxy address | REQ-022 | owed: paid by /vid deploy gate 2 — two external clients, IPv4 and IPv6, against staging | origin: domain
ROW-097 | behavior | server | n/a | n/a | In the deployed compose the app container has no outbound route: a connection from inside it to an outside host fails, and a check still succeeds | REQ-017 | owed: spec-only — first stage | origin: domain
ROW-098 | behavior | server | n/a | n/a | On staging, a connection from inside the app container to an outside host fails, and a check still succeeds | REQ-017 | owed: paid by /vid deploy gate 2 — an outbound connection attempted from the staging app container | origin: domain
ROW-099 | behavior | server | n/a | n/a | A crash in the middle of a marker check (uncaught throw, abort, out-of-memory) leaves the marker in no core dump, diagnostic report, heap snapshot or container log, and the deployed shape disables core dumps and heap snapshots | REQ-018 | owed: spec-only — first stage | origin: domain
ROW-100 | behavior | server | n/a | n/a | After the checks of a marker offer finish, a forced garbage collection followed by a heap snapshot of the server finds no string containing the marker | REQ-018 | owed: spec-only — first stage | origin: domain
ROW-101 | behavior | server | n/a | n/a | The hosts have no swap or only encrypted swap, and neither the proxy nor the app spools a request body to a temporary file | REQ-018 | owed: paid by /vid deploy gate 2 — the staging host's swap and temporary files inspected during a 10,000-character marker check | origin: domain
ROW-102 | behavior | server | n/a | n/a | The deployed compose declares automatic restart and a memory limit for both services, and after the app process is killed, a check of the fixed sample text succeeds again with no operator action | REQ-024 | owed: spec-only — first stage | origin: domain
ROW-103 | behavior | server | n/a | n/a | After a reboot of the staging host, a check of the fixed sample text succeeds again with no operator action | REQ-024 | owed: paid by /vid deploy gate 2 — the staging host rebooted | origin: domain
ROW-104 | behavior | server | n/a | n/a | No check is answered against a partly loaded dictionary: until the dictionary is loaded and a self-check of the fixed sample text passes, checks get the could-not-run message and the server reports not ready | REQ-025, REQ-002 | owed: spec-only — first stage | origin: domain
ROW-105 | behavior | server | n/a | n/a | The proxy's certificate state is on a persistent volume, so recreating the proxy container serves the same certificate without a new issuance, and the certificate challenge path stays reachable | REQ-020 | owed: spec-only — first stage | origin: domain
ROW-106 | behavior | REQ-027 | n/a | n/a | The daily count per kind and the monthly availability figure use UTC whatever the container's timezone: events at 23:59:59 and 00:00:00 UTC fall on different days | REQ-040, REQ-027, REQ-024 | owed: spec-only — first stage | origin: A-039
ROW-107 | behavior | REQ-027 | n/a | n/a | Each server start and each abnormal exit writes one operator-log line of kind and time, counted in the daily count | REQ-027 | owed: spec-only — first stage | origin: domain
ROW-108 | behavior | server | n/a | n/a | The server refuses to report ready, and writes an operator line, when a required deployment setting (the contact address, the site's domain) is missing, empty or a placeholder | REQ-028 | owed: spec-only — first stage | origin: domain
ROW-109 | behavior | logs | n/a | n/a | With the app stopped, checks sent through the deployed proxy leave no proxy or container log line holding a full IP address or the marker | REQ-032, REQ-018 | owed: spec-only — first stage | origin: domain
ROW-110 | behavior | page | anonymous | n/a | Built assets are named by content hash and the page is served no-cache; a check response the page cannot parse, or of another format version, shows the could-not-run message and never a no-errors result | REQ-025, REQ-002 | owed: spec-only — first stage | origin: domain
ROW-111 | behavior | REQ-033 | anonymous | n/a | The privacy note names the controller and a contact, the purpose and legal basis of each processing, the data subject's rights with how to exercise them, and the right to complain to a supervisory authority | REQ-033 | owed: spec-only — first stage | origin: A-040
ROW-112 | behavior | REQ-033 | anonymous | n/a | Every field a request log line holds, and how mail to the contact address is handled, are named in the privacy note with their retention, and no log line holds a field the note does not name | REQ-033, REQ-032 | owed: spec-only — first stage | origin: domain
ROW-113 | behavior | logs | n/a | n/a | Any address a log line holds keeps at most its first 24 bits for IPv4 and its first 48 bits for IPv6, for both address families | REQ-032 | owed: spec-only — first stage | origin: A-041
ROW-114 | behavior | page | anonymous | n/a | After marker checks, a refused check and a reload, no service worker is registered for the site and Cache Storage holds no entry carrying the marker | REQ-018 | owed: spec-only — first stage | origin: domain
ROW-115 | behavior | page | anonymous | n/a | The box declares autocomplete off, and a tab closed after a marker check and reopened through the browser's restore shows an empty box | REQ-018 | owed: spec-only — first stage | origin: domain
ROW-116 | behavior | hosting | n/a | n/a | No hosting-platform, firewall or network log keeps a full IP address, and no snapshot or backup holds a log older than 7 days | REQ-032 | owed: paid by /vid deploy gate 2 — the hosting account's logging and snapshot settings inspected | origin: domain
ROW-117 | behavior | server | n/a | n/a | At the production cutover the marker search, the full-IP search, the TLS-peer and DNS check over IPv4 and IPv6, the outbound-connection check from inside the app container, and the log-rotation check are re-run against production, and cutover is refused if any fails | REQ-018, REQ-032, REQ-038 | owed: paid by /vid deploy gate 3 — the same checks re-run against production at cutover | origin: domain
ROW-118 | behavior | page | anonymous | n/a | A second press while a check runs, including a fast double tap, sends no second request, and the finished check draws one set of highlights matching the count | REQ-002, REQ-022 | owed: spec-only — first stage | origin: domain
ROW-119 | behavior | page | anonymous | n/a | A check result arriving after the writer changed the text is discarded: no highlight, no count, and no suggestion from it can change the text | REQ-013, INV-001 | tests/invariants/test-req013-only-a-text-change-clears-the-check.page.spec.ts | origin: domain | proved-red: d58a3cf
ROW-120 | behavior | page | anonymous | n/a | Cut, drag and drop, context-menu paste, keyboard autocorrect and composition, dictation, and undo or redo clear every highlight and the count like typing; undo straight after a Replace (Ctrl+Z, Cmd+Z or the Edit menu) restores exactly the text before that Replace and clears every highlight and the count | REQ-045, REQ-013, REQ-011 | tests/invariants/test-req045-every-edit-path-clears-and-undo-after-replace.page.spec.ts | origin: A-049 | proved-red: d58a3cf
ROW-121 | behavior | page | anonymous | n/a | Caret moves, focus, selection, scrolling, copying and opening the soft keyboard leave every highlight and the count in place; only a change of the text clears them | REQ-013 | tests/invariants/test-req013-only-a-text-change-clears-the-check.page.spec.ts | origin: domain | proved-red: d58a3cf
ROW-122 | behavior | page | anonymous | n/a | Highlights stay over their own words after scrolling, rotation, opening the soft keyboard, resizing, 200% zoom and the font finishing loading | REQ-001 | owed: spec-only — first stage | origin: domain
ROW-123 | behavior | page | anonymous | n/a | Highlight and Replace positions stay exact when astral emoji, ZWJ sequences, combining marks, decomposed accents, zero-width and bidi control characters come before or inside the text | REQ-001, REQ-011, INV-001 | owed: spec-only — first stage | origin: domain
ROW-124 | behavior | page | anonymous | n/a | Soft hyphens, zero-width characters, no-break spaces, BOM, curly apostrophes, dashes, Word bullets and CRLF line ends: correct words beside or containing them are not flagged, no highlight covers them, and Copy text returns them exactly | REQ-005, REQ-014 | owed: spec-only — first stage | origin: domain
ROW-125 | behavior | page | anonymous | n/a | The box declares lang es and turns off the browser's own spellcheck, autocorrect and autocapitalisation | REQ-001, REQ-002 | owed: spec-only — first stage | origin: domain
ROW-126 | behavior | page | anonymous | n/a | At 360 pixels on a touch screen a tap on any highlighted word, at the edges included, opens a fully visible menu; tapping outside or Escape closes it and changes nothing | REQ-010, REQ-023 | tests/invariants/test-req010-touch-menu-at-360-pixels.page.spec.ts | origin: domain | proved-red: d58a3cf
ROW-127 | behavior | page | anonymous | n/a | Following the privacy-note link with an offer in the box and coming back leaves the offer exactly as it was, with nothing written to browser storage | REQ-033, REQ-018 | owed: spec-only — first stage | origin: domain
ROW-128 | behavior | page | anonymous | n/a | Leaving or reloading the page with text in the box asks for confirmation in every browser but Safari on iPhone, with nothing stored; an empty box leaves without a prompt | REQ-043 | tests/invariants/test-req043-leave-prompt-with-text-in-the-box.page.spec.ts | origin: A-044 | proved-red: d58a3cf
ROW-129 | behavior | page | anonymous | n/a | After Replace or Ignore on a word deep in a long offer the view does not jump, and focus stays at the word or moves to the next highlighted word | REQ-011, REQ-012, REQ-031 | tests/invariants/test-req011-req012-view-and-focus-after-replace-or-ignore.page.spec.ts | origin: domain | proved-red: d58a3cf
ROW-130 | behavior | page | anonymous | n/a | Copying from the box by keyboard, context menu or touch while highlights show puts on the clipboard only the plain text, equal to the box's text | REQ-015, REQ-016 | tests/invariants/test-req015-copy-text-and-its-fallback.page.spec.ts | origin: domain | proved-red: d58a3cf
ROW-131 | behavior | page | anonymous | n/a | On a touch phone with clipboard access refused, Copy text visibly selects the whole text and the message names the long-press Copiar action | REQ-016 | tests/invariants/test-req015-copy-text-and-its-fallback.page.spec.ts | origin: A-048 | proved-red: d58a3cf
ROW-132 | behavior | page | anonymous | n/a | The page's count limit and the server's use the same unit: an offer of exactly 10,000 characters made of emoji or decomposed accents is accepted by both and one of 10,001 refused by both; the cap applies before normalisation | REQ-021 | owed: spec-only — first stage | origin: A-045
ROW-133 | behavior | REQ-010 | anonymous | n/a | Every suggestion offered, once chosen, is not flagged on the next check, and no suggestion is a word from an independent list of Spanish vulgar or offensive words, over a generated sample of misspellings | REQ-010, REQ-011 | tests/invariants/test-req010-suggestion-quality.api.spec.ts | origin: domain | proved-red: d58a3cf
ROW-134 | behavior | REQ-008 | anonymous | n/a | Enclitic verb forms (Postúlate, Envíanos, Únete, sumate, postulate) are not flagged over a generated sample, while the same forms on a misspelled stem are flagged | REQ-008, REQ-001 | owed: spec-only — first stage | origin: domain
ROW-135 | behavior | REQ-008 | anonymous | n/a | The full conjugation of frequent job-offer verbs, voseo included, and the gender and number forms of job titles, drawn from a source independent of the product's dictionary, are not flagged | REQ-008 | owed: spec-only — first stage | origin: domain
ROW-136 | behavior | REQ-008 | anonymous | n/a | A sample of Latin American Spanish vocabulary from an independent word source is not flagged | REQ-008 | owed: spec-only — first stage | origin: domain
ROW-137 | behavior | REQ-001 | anonymous | n/a | A missing ñ or ü is flagged in lower case, title case and capitals, a capitalised mid-sentence word included, and the first suggestion restores it | REQ-001, REQ-009, REQ-010 | owed: spec-only — first stage | origin: domain
ROW-138 | behavior | REQ-011 | anonymous | n/a | Replace keeps all-capital and accented-capital forms (GESTION becomes GESTIÓN, Area becomes Área), and the list shows each suggestion in that case | REQ-011 | tests/invariants/test-req011-replace-keeps-case.page.spec.ts | origin: domain | proved-red: d58a3cf
ROW-139 | behavior | REQ-001 | anonymous | n/a | Words correct with and without an accent (esta and está, publico and público, mas and más) are never flagged | REQ-001 | owed: spec-only — first stage | origin: domain
ROW-140 | behavior | REQ-001 | anonymous | n/a | Words with an extra or misplaced accent (fué, exámen, jóven) are flagged, the correct form first among the suggestions | REQ-001 | owed: spec-only — first stage | origin: domain
ROW-141 | behavior | REQ-001 | anonymous | n/a | Correct dictionary words written in all capitals with capital accents, or in title case, are not flagged, over a generated sample | REQ-001, REQ-003, REQ-009 | owed: spec-only — first stage | origin: domain
ROW-142 | behavior | REQ-010 | anonymous | n/a | For a generated sample of sound-alike confusions (b and v, ll and y, s, c and z, a dropped h, g and j), the intended word is among the 5 suggestions | REQ-010 | tests/invariants/test-req010-suggestion-quality.api.spec.ts | origin: domain | proved-red: d58a3cf
ROW-143 | behavior | REQ-007 | anonymous | n/a | Common job-offer abbreviations and acronym plurals (aprox., máx., S.A., EE. UU., KPIs, PyMEs) from an independent list are not flagged, and the word after any accepted abbreviation is not a sentence start | REQ-007, REQ-035 | owed: spec-only — first stage | origin: domain
ROW-144 | behavior | REQ-009 | anonymous | n/a | Affix-expanded inflected forms and capital-only dictionary entries, written title-case mid-sentence without their accents (Tecnicos, Bogota), are flagged with the accented form first | REQ-009 | owed: spec-only — first stage | origin: domain
ROW-145 | behavior | REQ-001 | anonymous | n/a | Dictionary entries that exist only capitalised (España, Bogotá), written in lower case, are flagged with the capitalised form first | REQ-001 | owed: spec-only — first stage | origin: domain
ROW-146 | behavior | REQ-009 | anonymous | n/a | Mixed-case words with a capital letter after their first letter (LinkedIn, WhatsApp, PowerPoint, iOS, eCommerce), and a generated sample like them, are not flagged mid-sentence or at a sentence start, while an ordinary misspelled word beside them, and an all-capital word over 5 letters missing its accent (GESTION), are | REQ-041 | owed: spec-only — first stage | origin: A-042
ROW-147 | behavior | REQ-035 | anonymous | n/a | Country, capital and major-city names of Spanish-speaking countries, from an independent list, are not flagged at a line start or after a colon, and a capitalised word after a colon that is not in the dictionary and whose accent-restored form is not a word (Empresa: Tecnosoluciones) is not flagged | REQ-035 | owed: spec-only — first stage | origin: A-046
ROW-148 | behavior | REQ-001 | anonymous | n/a | ano and anos, in any case, ANO and ANOS included, are always flagged with año or años as the first suggestion | REQ-044, REQ-001 | owed: spec-only — first stage | origin: A-047
rule | RULE-001 | Only the operator-log module writes log output; no other source file calls console or a logger | if [ -e src ]; then grep -rlE '(console|logger|log)\.(log|info|warn|error|debug|trace|fatal)\(' src; fi | T1 | owed: census-armed — no source site exists before the code skeleton
rule | RULE-002 | No page source file uses browser storage or cookies | if [ -e src/web ]; then find src/web -name '*.ts' -o -name '*.html'; fi | T1 | owed: census-armed — no source site exists before the code skeleton
rule | RULE-003 | No server source file makes an outbound network call, and the page's only request goes to its own origin by a relative path | if [ -e src ]; then find src -name '*.ts'; fi | T1 | owed: census-armed — no source site exists before the code skeleton
rule | RULE-004 | Every page write of user text uses a text sink, never an HTML sink (innerHTML, outerHTML, insertAdjacentHTML, document.write) | if [ -e src/web ]; then find src/web -name '*.ts'; fi | T1 | owed: census-armed — no source site exists before the code skeleton
rule | RULE-005 | Every route whose handler reaches the spelling engine, on any method, carries the 10,000-character cap, a per-word length cap and the per-address bound, with no request attribute exempting a caller (the probe included) | if [ -e checks/extractors/routes.sh ]; then sh checks/extractors/routes.sh; fi | T1 | owed: census-armed — no source site exists before the code skeleton
rule | RULE-006 | The box's text is changed only by the declared mutators: plain-text paste, typing, Replace | if [ -e src/web ]; then grep -rnE '\.(value|textContent|innerText)[[:space:]]*=' src/web; fi | T1 | owed: census-armed — no source site exists before the code skeleton
rule | RULE-007 | Every served response carries HSTS, a Content-Security-Policy with script-src 'self' and frame-ancestors 'none', X-Content-Type-Options nosniff and a strict Referrer-Policy | if [ -e checks/extractors/routes.sh ]; then sh checks/extractors/routes.sh; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-008 | Offer text is read only from the request body of a check route; no route reads it from a path or query | if [ -e checks/extractors/routes.sh ]; then sh checks/extractors/routes.sh; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-009 | Every log sink of the deployed shape declares a size cap and a retention bound | if [ -e deploy/docker-compose.yml ]; then grep -nE 'logging:|log \{|max-size|roll_' deploy/docker-compose.yml deploy/Caddyfile; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-010 | No module-level collection in server source holds a key or value taken from request text, except the limiter's per-address entry | if [ -e src/server ]; then grep -rnE '^(export )?(const|let) [A-Za-z_]+ *= *new (Map|Set|WeakMap)|^(export )?(const|let) [A-Za-z_]+ *= *(\[|\{)' src/server src/checker; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-011 | The page writes to the clipboard and never reads it; pasted text comes only from the paste event | if [ -e src/web ]; then grep -rnE 'navigator\.clipboard|clipboardData' src/web; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-012 | Every word lookup (dictionary, term list, abbreviations, inclusive base, accent restore) goes through the one normalise-for-lookup function | if [ -e src/checker ]; then grep -rnE '\.(correct|spell|suggest|has)\(' src/checker; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-013 | Every user-visible string comes from the one Spanish string catalogue, and every entry passes the product's own checker | if [ -e src/web ]; then find src/web -name 'strings*.ts'; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-014 | Every page-facing ledger test runs in Chromium, WebKit and Firefox, one engine at a phone viewport with touch | if [ -e tests/invariants ]; then grep -lrE 'test\(' tests/invariants --include='*.spec.ts'; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: REQ-042
rule | RULE-015 | Every element that holds or shows offer text carries translate no, notranslate and the writing-assistant opt-out attributes | if [ -e src/web ]; then grep -rnE '<textarea|contenteditable|role="listbox"|aria-live' src/web; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-016 | Every dependency resolves from the lockfile with an integrity hash, and the vendored dictionary files' hash is recorded and checked at build | if [ -e package-lock.json ]; then grep -cE '"integrity":' package-lock.json; ls src/checker/dictionary; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-017 | No response body or Location header echoes raw request path, query or Host text; the redirect goes to the canonical host and an unknown Host is refused | if [ -e checks/extractors/routes.sh ]; then sh checks/extractors/routes.sh; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-018 | No served HTML page, the note and error pages included, references an asset on another host | if [ -e src/web ]; then find src/web -name '*.html'; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-019 | No term-list entry equals, case-insensitively, the accent-stripped form of a different Spanish dictionary word | if [ -e src/checker ]; then find src/checker -name 'terms*'; fi | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
rule | RULE-020 | No commit touching the checker's dictionary, term list, abbreviation list or normalisation precedes the owner's approval of the current reference-set hash, or follows a set change without a newer approval; the approval lives in a law file only the owner's ratification changes | git log --format=%H -- src/checker | T1 | owed: census-armed — no source site exists before the code skeleton | origin: domain
hostility | HOS-001 | Check an offer whose text holds markup that would fetch a remote resource (an img tag and a link to an outside host carrying the marker) and observe no request to any outside host | protects: REQ-017 | disable: drop the page's Content-Security-Policy and render highlights through an HTML sink | owed: guard-first — ROW-032; paid in the slice that builds the page's rendering and headers
hostility | HOS-002 | Force the checker to fail mid-check and send malformed, oversize and rate-limited check requests carrying the marker, then find the marker in some log, file or error report | protects: REQ-018 | disable: restore the framework's default error and request logging, which records the request body | owed: guard-first — ROW-035; paid in the slice that builds the server's error handling
hostility | HOS-003 | Send two check requests with different markers at the same instant, many times, and find one request's text in the other's response | protects: REQ-017 | disable: share one module-level result buffer between requests in the checker | owed: guard-first — ROW-032; paid in the slice that builds the check endpoint
hostility | HOS-004 | Route a check request to staging through a third-party TLS-terminating proxy and observe the check is answered under a certificate other than our server's | protects: REQ-038 | disable: point the staging DNS record through a proxying CDN | owed: prerequisite — the staging server and its DNS record; paid at deploy gate 2, the staging endpoint's TLS peer compared before and after the proxy toggle
```
