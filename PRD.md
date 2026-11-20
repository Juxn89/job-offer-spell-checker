# Revisor ortográfico de ofertas — PRD
grammar: 0.9.8.1

> **Precedence rule:** the base of this file (everything above `## Appends`)
> is immutable after final ratification. All change is appended under
> `## Appends`. Later appends win over the base and over earlier appends.
> Authority order within the record: Seed and human answers > ratified
> thesis > sources > model proposals.

## Seed

here is my idea, ortography checker button for a job offer

## Thesis

### Product summary

A single public web page where someone writing a job offer in Spanish
pastes or types the offer and presses a "Check spelling" button. The page
highlights every word it judges misspelled — missing accents included —
without flagging the ordinary vocabulary of job offers (tech terms,
acronyms, words with digits). Clicking a highlighted word offers up to
five suggestions to replace it, or Ignore; a line says how many words are
flagged, or that none are. A "Copy text" button takes the corrected offer
out. The check runs on the product's own server with an open-source
dictionary: the offer's text never goes to an outside service and is
never stored or logged. No accounts, nothing saved.

### Primary users

Recruiters and employers who write job offers in Spanish and publish them
somewhere else (a job board, a careers page, a social post). A spelling
error in a published offer makes the employer look careless to the very
candidates it wants; the writer wants a fast last check before publishing,
without signing up and without handing the offer to a third party.

### MVP focus

- G1: A Spanish job offer pasted on the page has its misspelled words found and highlighted in place, without flagging the ordinary vocabulary of job offers.
- G2: The writer fixes each flagged word in place — a suggestion or Ignore — and takes the corrected offer out with one Copy text act, the rest of the text unchanged.
- G3: The offer's text never leaves the product's own server and is never kept: no outside service, no storage, no log.

### Explicitly not MVP

Grammar, style or punctuation checking (spelling only, A-004); any
language other than Spanish (A-003, A-011); accounts or sign-in (A-002); a
personal or saved dictionary — Ignore lasts for the current check only
(A-007); a button inside an existing job-posting system or a browser
extension (A-001); automatic correction of every error at once (A-005);
downloading the text as a file (A-006); analytics or success counting of
any kind (A-009). Each is deferred by the owner, not forgotten.

### Required core flows

- A writer pastes a Spanish job offer, presses Check spelling, sees each misspelled word highlighted and the count of flagged words, replaces or ignores each one, and copies the corrected offer out with Copy text.
- A writer whose offer has no spelling errors presses Check spelling and is told so, with nothing highlighted.

### Value logic

The writer comes back because one press before publishing catches the
embarrassing errors — above all the missing accents Spanish readers notice
— without burying them under false alarms on "JavaScript" or "SQL", and
without the offer leaving the employer's hands. A checker that cries wolf
on job vocabulary gets ignored; one that misses accents gives false
comfort; one that ships the offer to a stranger's server is one an
employer cannot use for an unannounced position.

### Evidence basis

The seed is one sentence, written in English; everything else comes from
the owner's answers to the interview batch, all given as "pick up the
recommendations" (A-001 to A-010). The owner first chose a different seed
(a job-search page) and then replaced it with this idea; the job-search
seed is not part of this product. Question 3's recommendation was one
language without naming it; the owner's answer (A-003) therefore leaves
the language open, and Spanish is ViD's decision (A-011), resting only on
the seed's word "ortography" (Spanish "ortografía") — put to the owner
first at pause 1, with the page's own language a separate decision
(A-020). How words are split, what Replace, Ignore and editing do, and how
text survives paste and copy are ViD's decisions too (A-017, A-018,
A-019). No other source exists; no conflicts.

## Actors and journeys

### Writer (recruiter or employer)

1. Drafts the job offer in their usual tool — a document, an applicant tracking system, an email (off_screen)
2. Opens the page, pastes the offer and presses Check spelling
3. Walks the highlighted words: picks a suggestion for "gestion" ("gestión"), ignores the company's unusual brand name, and sees the count fall to zero
4. Presses Copy text and pastes the corrected offer into the job board (off_screen)
5. Publishes the offer; candidates read it free of spelling errors (off_screen)

## Mechanisms

```vid-prd-mechanisms
MECH-01 | G1 | Pressing Check spelling sends the offer's text to the product's own server, which compares each word against an open-source Spanish dictionary and returns the words not found, with accents counting, so a wrong build that ignores accents or flags nothing is visible. | stated: answer A-004
MECH-02 | G1 | Words of at most five letters written entirely in capitals, and words containing a digit, are never flagged, while longer capitalised words are checked with their accents, and a built-in list of common job and tech terms is treated as correct. | stated: answer A-007
MECH-03 | G2 | Each flagged word is highlighted in place; clicking it shows up to five suggestions, choosing one replaces that word in the text, Ignore removes its highlight for this check, and a line gives the count of flagged words or says no spelling errors were found. | stated: answer A-005
MECH-04 | G2 | A Copy text button puts the whole current text, corrections included, on the clipboard; nothing is saved anywhere. | stated: answer A-006
MECH-05 | G3 | The check runs only on the product's own server with an open-source dictionary; the text is sent to no outside service and is written to no storage and no log. | stated: answer A-008
MECH-06 | G1 | The text is split into words by a stated rule — hyphenated parts checked one by one, inclusive forms such as candidato/a and l@s accepted, URLs, emails and @handles skipped, common abbreviations such as Lic. and Ing. accepted, accents normalised before lookup — so ordinary job-offer writing is not flagged. | stated: answer A-017
MECH-07 | G2 | A replacement keeps the flagged word's capitalisation and acts on that one occurrence, Ignore acts on that one occurrence, the count updates at once, and any typing in the box after a check clears every highlight until Check spelling is pressed again. | stated: answer A-018
MECH-08 | G2 | Pasted text is kept as plain text with its line breaks, blank lines, bullet characters and spacing exactly as pasted, Copy text returns exactly the box's text, and when the browser refuses the clipboard the page selects the text and tells the writer to copy it by keyboard. | stated: answer A-019
```

## Content contract

```vid-prd-contract
DIM-core-loop-continuity | Core-loop continuity | mechanism | required | covered_by: functional, ux_flow, data_entity | status: covered
DIM-nfr-security | Security floor | nfr | required | covered_by: nfr, constraint, invariant, functional | status: covered
DIM-nfr-privacy | Privacy and data protection | nfr | required | covered_by: nfr, constraint, functional, data_entity | status: covered
DIM-nfr-availability | Availability and performance | nfr | required | covered_by: nfr, constraint | status: covered
DIM-nfr-accessibility | Accessibility | nfr | required | covered_by: nfr, constraint | status: covered
DIM-nfr-operability | Operability — backup, observability, support | nfr | required | covered_by: nfr, constraint, functional | facets: backup, observability, support | status: covered
DIM-word-segmentation | What counts as a checkable word | mechanism | required | covered_by: functional, invariant, constraint | prompt: without it a builder decides alone how text splits into words (hyphens, apostrophes, ¿¡ and other punctuation, URLs, emails, abbreviations such as Lic. or Ing., inclusive forms such as candidato/a or l@s, sentence-initial and title-case words, decomposed accents) and so which recruiter-written words get flagged | status: covered
DIM-lexical-norm | Spanish variety and dictionary scope | mechanism | required | covered_by: constraint, functional, non_goal, risk | prompt: without it a builder picks alone which Spanish variety counts as correct (Spain or Latin American forms, voseo), whether current or older RAE accent rules are accepted (solo/sólo, guion/guión), whether proper nouns, places and company names are flagged, and which anglicisms and tech terms the built-in list holds — together the false-alarm rate writers see | status: covered
DIM-correction-semantics | What Replace, Ignore and editing do to the text and the highlights | mechanism | required | covered_by: functional, ux_flow, invariant | prompt: without it a builder invents whether a replacement keeps the original's capitalisation, whether Replace and Ignore act on one occurrence or every identical word, how suggestions are ordered, what the popup shows with no suggestion, how the count updates, and what happens to highlights when the writer types after a check | status: covered
DIM-text-roundtrip | Paste-in and copy-out fidelity | mechanism | required | covered_by: functional, invariant, constraint, ux_flow | prompt: without it a builder invents whether rich text pasted from Word or a tracking system is reduced to plain text, whether line breaks, bullets and blank lines come back exactly from Copy text, and what happens when the browser refuses clipboard access | status: covered
DIM-input-envelope | Input envelope and over-limit behaviour | mechanism | required | covered_by: constraint, nfr, functional, ux_flow, risk | prompt: without it a builder invents the maximum text length, the per-client request rate and what the writer sees at a limit (silent truncation, an error, a server that tips over), leaving the anonymous page open as a free bulk spelling service | status: covered
DIM-no-trace | Where the offer text must never appear, and the proof | nfr | required | covered_by: invariant, constraint, nfr, risk, metric, hypothesis | prompt: without it a builder decides alone whether pasted text may appear in proxy or access logs, error reports, request debugging, caches or browser storage, and nobody can show that the text never leaves the server or is kept, so "never stored or logged" quietly loses to ordinary logging defaults | status: covered
DIM-check-accuracy | Accuracy bar on real Spanish job-offer text | proof | required | covered_by: metric, nfr, hypothesis, outcome | prompt: without it a builder decides alone what is good enough — no reference set of Spanish job offers with known errors, no ceiling on false alarms, no floor on missed misspellings or on the right correction being among the suggestions — so a checker that flags half the text or almost nothing fails no requirement | status: covered
```

## Criticality tiers

- **T0** — must never break or leak.
- **T1** — core behavior; getting it wrong is a defect.
- **T2** — desirable; getting it wrong is a fix-round item.

## Items

```vid-prd-features
FEAT-01 | G1 | Spelling check
FEAT-02 | G2 | Correcting flagged words
FEAT-03 | G2 | Copy text
FEAT-04 | G3 | Offer text privacy
```

## Answer ledger

```vid-prd-answers
A-001 | human | 2026-11-20 | Q: where does the button live? | A: accepted as recommended: a standalone web page; someone pastes or types a job offer into a box and presses Check spelling; not inside an existing job-posting system, not a browser extension | settles: thesis, MECH-01
A-002 | human | 2026-11-20 | Q: who uses it, and do they sign in? | A: accepted as recommended: recruiters or employers writing an offer; no accounts; anyone with the link can use it | settles: thesis
A-003 | human | 2026-11-20 | Q: which language are the job offers written in? | A: accepted as recommended: one language for the first version | settles: thesis
A-004 | human | 2026-11-20 | Q: what does it check? | A: accepted as recommended: spelling only — words not in the dictionary, accents included; no grammar or style | settles: thesis, MECH-01
A-005 | human | 2026-11-20 | Q: what does the writer see after pressing the button? | A: accepted as recommended: each misspelled word highlighted in the text; clicking one shows up to 5 suggestions; choosing one replaces the word, or Ignore; a line says how many words were flagged or "No spelling errors found"; no automatic correction | settles: MECH-03
A-006 | human | 2026-11-20 | Q: how does the corrected text leave the page? | A: accepted as recommended: a Copy text button; nothing is saved anywhere; no download as file | settles: MECH-04
A-007 | human | 2026-11-20 | Q: job-ad vocabulary such as JavaScript, SQL, Excel, company names and acronyms? | A: accepted as recommended, then narrowed by the owner's pause-1 ruling on F-01: words of at most 5 letters written entirely in capitals (acronyms such as SQL, SAP, RRHH) and words containing a digit are never flagged; longer words written in capitals are checked, accents included; a short built-in list of common job and tech terms is treated as correct; no permanent add-to-my-dictionary | settles: MECH-02
A-008 | human | 2026-11-20 | Q: where may the text of the offer go? | A: accepted as recommended: checked on our own server with an open-source dictionary; it never goes to an outside company and is never stored or logged | settles: MECH-05
A-009 | human | 2026-11-20 | Q: is a measure of success needed for this first version? | A: accepted as recommended: none; no analytics or counting; the owner judges it by trying it | settles: thesis
A-010 | human | 2026-11-20 | Q: the scope challenge — suggestions, click-to-replace, Ignore, the built-in job and tech word list: cut or keep? | A: accepted as recommended: keep all four | settles: thesis, MECH-02, MECH-03
A-011 | model_proposed | 2026-11-20 | Q: which one language are the job offers, and the page itself, written in? | A: Spanish: the offers checked are Spanish texts and the dictionary is Spanish | settles: thesis, MECH-01 | shown: pause-1 2635187517
A-012 | model_proposed | 2026-11-20 | Q: which Spanish counts as correct? | A: general Spanish under the current RAE spelling rules: Spain and Latin American spellings and voseo forms are all accepted (computadora and ordenador alike); the diacritic accents the RAE now advises against but does not call errors (sólo, éste) are accepted; forms the current rules make errors are flagged (guión is flagged, guion is correct); a word starting with a capital letter that is not the first word of a sentence and is not in the dictionary is treated as a proper noun (a company, a city, a person) and not flagged; a sentence-initial word is checked | settles: MECH-01 | shown: pause-1 3622571747
A-013 | model_proposed | 2026-11-20 | Q: how long may an offer be, and how often may one visitor check? | A: at most 10,000 characters per check, refused with a message naming the limit, never silently cut; at most 30 checks per minute from one network address, the excess refused with a message to wait a moment | settles: MECH-01 | shown: pause-1 3033763974
A-014 | model_proposed | 2026-11-20 | Q: how fast, and on what screens? | A: the result of a check of a typical offer of up to 1,000 words appears within 2 seconds; the page works on a phone as well as on a computer | settles: MECH-01 | shown: pause-1 1208414633
A-015 | model_proposed | 2026-11-20 | Q: what accessibility baseline? | A: WCAG 2.2 level AA: the button, the highlighted words, the suggestion list, Ignore and Copy text all work from the keyboard and are announced by a screen reader | settles: MECH-03 | shown: pause-1 1162382151
A-016 | model_proposed | 2026-11-20 | Q: what does the page say when the checker itself is down? | A: a plain message that the check could not run and to try again in a moment; the writer's text stays in the box untouched | settles: MECH-01 | shown: pause-1 1877015940
A-017 | model_proposed | 2026-11-20 | Q: what counts as a checkable word? | A: a word is a run of letters, accented letters included, with any inner apostrophe kept; a hyphenated word is checked part by part; inclusive endings written with a slash (candidato/a, todos/as), with @ (l@s, tod@s), with x (todxs) or with e (todes) are accepted, not flagged; URLs, email addresses, @handles and words containing a digit are skipped; common abbreviations ending in a period (Lic., Ing., Sr., Sra., Dr., Dra., etc.) are accepted; decomposed accents are normalised to composed letters before lookup; ¿ ¡ and all other punctuation separate words and are never flagged | settles: MECH-06 | shown: pause-1 2999992521
A-018 | model_proposed | 2026-11-20 | Q: what do Replace, Ignore and editing do to the text and the highlights? | A: choosing a suggestion replaces only that one occurrence and keeps its capitalisation (a capitalised Gestion becomes Gestión); Ignore removes only that one occurrence's highlight, for this check only; suggestions are listed most likely first; a word with no suggestion shows "Sin sugerencias" beside Ignore; the count line updates at once after each Replace or Ignore; any typing in the box after a check clears every highlight and the count, and the writer presses Check spelling again | settles: MECH-07 | shown: pause-1 1940487862
A-019 | model_proposed | 2026-11-20 | Q: what survives paste-in and copy-out? | A: pasted text is kept as plain text only, all formatting dropped; its line breaks, blank lines, bullet characters and spacing are kept exactly; Copy text puts exactly the box's current text on the clipboard; when the browser refuses clipboard access the page selects all the text and tells the writer to press Ctrl+C (Cmd+C on a Mac) | settles: MECH-08 | shown: pause-1 2077946999
A-020 | model_proposed | 2026-11-20 | Q: which language is the page itself written in — its button, labels and messages? | A: Spanish, the same language as the offers it checks | settles: thesis | shown: pause-1 2994559765
A-021 | human | 2026-11-20 | Q: the contract sitting — which floor dimensions are struck, and how are the case-by-case entries ruled? | A: approved as proposed: identity, consent, entity lifecycle, operations, feedback intake, trust states, authorization, notifications, data integrity, success thresholds and instrumentation struck — an anonymous page that stores nothing and measures nothing; technical SEO and multi-locale ruled out; the 13 listed dimensions kept | settles: contract
```

## Open decisions

<!-- None open. -->

## Findings

### 2026-11-20 — pause 1 sitting

```vid-prd-findings
F-01 | red-team | advisory | MECH-02 | repaired | evidence: all-capital titles with missing accents would pass unflagged; owner ruled at the sitting that only all-capital words of at most five letters are exempt (A-007 restated)
F-02 | red-team | blocking | DIM-word-segmentation | repaired | evidence: no rule split text into words; MECH-06 added on ViD decision A-017, shown at pause 1
F-03 | red-team | blocking | DIM-correction-semantics, MECH-03 | repaired | evidence: Replace and Ignore scope, capitalisation and edit-after-check undefined; MECH-07 added on ViD decision A-018, shown at pause 1
F-04 | red-team | blocking | DIM-text-roundtrip | repaired | evidence: paste and copy fidelity and a refused clipboard undefined; MECH-08 added on ViD decision A-019, shown at pause 1
F-05 | red-team | advisory | DIM-lexical-norm | repaired | evidence: A-012 contradicted current RAE rules on guión and left proper nouns open; A-012 rewritten before it was shown
F-06 | red-team | advisory | thesis | repaired | evidence: Evidence basis overstated the seed's grounding for Spanish and A-011 bundled the page language; basis corrected, page language split out as A-020
```

## Ratifications

## Appends

<!-- Append-only below this line. Each append is dated and names its
     source: (owner answer), (/vid fix correction), (/vid add), (gap
     augment). New items ride in ```vid-prd blocks with fresh IDs
     continuing their prefix sequence. Behavior changes restate the full
     row with the marker AMENDED appended to the ID field: a later
     AMENDED row supersedes every earlier row with its ID, and carries
     `arms:` for every arm of the row it supersedes. -->
