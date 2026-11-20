# Revisor ortográfico de ofertas — GRADING CHECKLIST

> Owner-curated, versioned, injected VERBATIM into every grading brief
> (§7.2). This is the residue that stays human: absent guards leave no
> artifact — no orphan, no site list, no divergent knob — so no census can
> find them; only domain knowledge names them in advance. Every accepted
> absent-guard finding adds one line here: this run's blind spot becomes the
> next run's standard question. Seeded at init from the interview and the
> plugin's seed library (seed/checklist.md); lines the owner marks general
> at run end are promoted back into the seed (§7.3). A seeded line that
> fires nothing across two runs is dropped (the complexity law).

## Standing lines (every project)

- **Harness attacks.** Check that the test harness itself has not been
  defeated: assertion-neutralising equality overrides (`__eq__` and its
  analogues), early process exit before assertions run (`sys.exit(0)` and
  its analogues), test-framework monkey-patching, skipped or filtered tests
  counted as run. Measured hidden-test hack rates of 12–13% make "the suite
  exited 0" an attackable claim.
- **Example-only evidence.** A computational promise — a calculation, a
  ranking, a match, a decision — proved only by published, named examples
  is unproved: find the implementation that branches on the fixture and
  answers correctly for exactly those inputs. Generated or independently
  sampled inputs are the standard (exact fixture-named assertions can be
  satisfied by branching on the fixture names, with no engine built).
- **Probe fixture realism.** Tidy stand-in fixtures carry none of the
  hostile properties of real input: check that a hostility probe's input
  is hostile in every field the product stores or renders, not only the
  one the probe asserts on, and that filenames, addresses and markup look
  like the real thing (hostile markup planted in the description alone
  leaves every other field between a hostile feed and stored script).
- **Assertion strength on Tier-0.** A Tier-0 row whose test asserts only
  that something EXISTS — an element is present, a record count is at
  least one, a status is in a set spanning success and redirect — is a
  finding: name the value or behaviour the assertion should have pinned
  (the ladder: existence → type → status → value → behaviour; presence
  assertions can outnumber real visibility assertions many times over).

## Domain lines

- **Fences (the non-goals).** Building any of these is a defect: grammar, style or punctuation checking (NG-001); a language other than Spanish, for the offers or the page (NG-002); accounts, sign-in, or a personal or saved dictionary, with Ignore lasting beyond the current check (NG-003); a button inside a job-posting system or a browser extension (NG-004); correct-all, download as a file, or any analytics or success counting (NG-005).
- **The offer's text is a secret in transit and at rest.** Follow the text from the paste event to the response and back: name every place it is copied (variables kept beyond the request, closures, caches, error objects, debug output, the proxy, the container runtime). A copy that outlives the request is a REQ-018 finding, even if no test reads it.
- **Spanish messages.** Every message the page shows (count line, no-errors, could-not-run, limit, wait, empty-box prompt, copied, copy fallback, Sin sugerencias, privacy notice and note) is natural, correct Spanish that a recruiter in Spain and in Latin America understands, with no technical term and no English left over.
- **Suggestions that change meaning.** Among the flagged words of a realistic offer, look for a first suggestion that would change the offer's meaning or register (a different job title, a vulgar word, a word from another country's slang). A checker can pass the 90% bar and still embarrass the employer.
- **Screen-reader walk.** With a real screen reader (VoiceOver or NVDA), check an offer, walk to each flagged word, choose a suggestion, ignore one, copy the text: every step is announced and nothing traps the focus (the manual half of REQ-031).
- **Accuracy evidence.** The accuracy rows read the owner-approved reference set only. Check that no tuning reads it in a way that could overfit, such as a term list grown from its words or exceptions keyed to its offers (REQ-037).
- **Overload.** Under traffic from many addresses, each within its own limit, does a global bound refuse the excess with the plain could-not-run message (logged as refused), instead of slowing every writer past 2 seconds or crashing?
- **Release and rollback.** Can the operator name the commit production runs, without seeing any offer, and return to the previous release with one documented command whose image is still on the host? Does a release let in-flight checks finish, or fall back to the could-not-run message rather than a proxy error page?
- **Host upkeep.** Are host security updates automatic, is SSH key-only, are base images rebuilt on a stated schedule, are old images pruned at each deploy, and is there a disk-usage alert?
- **Alerting.** Does the outside probe's failure alert reach a named person, and does a certificate expiring within 14 days alert that person before it expires?
- **Processor and location.** Is there a GDPR Art. 28 data-processing agreement with the hosting provider? Does the server run in the EEA? Does the privacy note name the host and its location?
- **Reference-set personal data.** Before the owner approves the reference set (REQ-037), is every real offer in it anonymised: person names replaced, emails and URLs on reserved example domains, phone numbers fictitious, company names invented?
