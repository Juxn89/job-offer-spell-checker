# Revisor ortográfico de ofertas — DECISIONS

Append-only, except labels. One line per decision. Trigger (law in
CLAUDE.md): the choice picked between plausible alternatives, constrains
future code, or would surprise a competent newcomer. Entries without an
`| enforced:` ref, or without a label, are rejected at commit.

Format:

    - **D-NNN** <what> | why: <why> | enforced: <test/hook ref, or "convention"> | applies-to: <ids and codes> [| origin: proposal] [| model: <id>]
    - **D-NNN** <what> | why: <why> | enforced: <test/hook ref, or "convention"> | scope: project [| origin: proposal] [| model: <id>]

The label says where a brief quotes the decision. `applies-to:` items,
comma separated: ROW, RULE or REQ ids of INVENTORY.md; screen codes (the
part before `/` of an INVENTORY marker); DIF ids, when rows carry a
`divergence:` field; module ids of ARCHITECTURE.md's module table (its
Module column, a dotted label read as a path). A decision that bears on
one module, or a few, names them beside its row, requirement or screen
items, never instead of them: a module item reaches only the briefs of
builders whose step names the module, and graders, test authors and
fixers join by rows. `scope: project` only when it bears on many areas. A
commit may change a line's label and nothing else; that is the one edit
this file allows.

`origin: proposal` marks defaults the model chose when the owner skipped a
hint or delegated the choice. `model:` is optional (§9 model-change
durability): record it when the deciding model differs from the project's
usual one, so a later model can see what it inherits.

## Log

- **D-001** Stack: TypeScript 5 on Node.js 22 LTS with Fastify 5 serving one plain HTML page and the check endpoint; no UI framework; alternatives rejected: Python/Django or FastAPI, Express, Next.js, a React or Vue page | why: the owner said "you pick"; one language on page and server, Fastify gives schema validation, body limits and headers without hand-rolling them, and a single page does not need a UI framework | enforced: checks/conformance.sh (BASELINE.md vid-forbidden) | scope: project | origin: proposal
- **D-002** Spelling engine: nspell (pure-JS Hunspell) with the LibreOffice Spanish dictionary (RLA-ES), vendored into the repository as .aff/.dic files, plus the built-in term list as a project dictionary in the same module; alternatives rejected: LanguageTool (a Java server, or a web service that breaks REQ-017), nodehun native bindings (build fragility in Docker), typo-js (slower suggestions, unmaintained) | why: REQ-017 forbids any outside spelling service; vendoring makes restoring the code restore the dictionary (REQ-029); the RLA-ES dictionary is the open Spanish standard used by LibreOffice and Firefox | enforced: checks/conformance.sh (BASELINE.md vid-forbidden) | applies-to: REQ-017, REQ-029, RULE-012, RULE-016, RULE-019, ROW-033, ROW-062, src/checker | origin: proposal
- **D-003** No storage of any kind: no database, no file cache, no browser storage; the offer's text lives only in the request's memory | why: REQ-018 and REQ-029 leave nothing to store; a store would be a place for the text to leak | enforced: convention | scope: project | origin: proposal
- **D-004** Hosting: two small Hetzner Cloud VPS in the EU (one staging, one production), each running Docker Compose with the app and Caddy; Caddy terminates TLS with Let's Encrypt on our own machine; alternatives rejected: Fly.io, Render, Vercel and Netlify (their edge terminates TLS on machines outside our account, breaking REQ-038), Cloudflare in proxy mode (same), DigitalOcean (equivalent, but Hetzner is cheaper and EU-based by default) | why: REQ-038 requires the check request to be decrypted only on our own machines; EU hosting matches the GDPR note (REQ-033); the owner accepted the recommendation | enforced: convention | applies-to: REQ-038, REQ-033, ROW-038, ROW-074, ROW-105, ROW-117 | origin: proposal
- **D-005** Platform check against BASELINE: a Hetzner VPS runs any Docker image, so the pinned Node 22 image and Caddy run unchanged; no database, workers or cron are needed (the address window is in process memory, log retention of 7 days is the Docker log driver's rotation); two of the smallest shared-vCPU servers cost about 9 EUR a month together, inside the 20 EUR cap | why: vid-staging-setup Part 1 requires the platform to be checked against the stack before the build-out | enforced: convention | scope: project | origin: proposal
- **D-006** Access for ViD to the platform is a Hetzner API token the owner keeps in the environment variable HCLOUD_TOKEN outside the repository; DNS has no ViD access, and the owner adds the DNS records by hand | why: the owner accepted the recommendation; no credential value is ever recorded | enforced: checks/hooks/pre-commit (hosting-access) | scope: project | origin: proposal
- **D-007** Release downtime: a brief restart of a few seconds is acceptable when a release is deployed; there is no database and so no migration window | why: the owner accepted the recommendation (vid-staging-setup Part 1, downtime tolerance) | enforced: convention | scope: project | origin: proposal
- **D-008** The availability probe (REQ-024) is an outside uptime monitor that POSTs a fixed sample text, never an offer, to the check endpoint every 5 minutes; its account is the owner's to create; it is the only outside service and receives no offer text, so REQ-017 holds | why: REQ-024 requires the measurement to come from outside the product; the hosting batch said "outside services: none", which covered services the product calls, not this inbound probe | enforced: convention | applies-to: REQ-024, REQ-017, RULE-005, ROW-054, ROW-055, src/server | origin: proposal
- **D-009** Tests: Vitest for the checker and the HTTP surface, Playwright on Chromium, WebKit and Firefox for the page, clipboard and phone width (REQ-042), axe-core for WCAG 2.2 AA; alternatives rejected: Jest, Cypress, Puppeteer | why: Vitest runs TypeScript natively; Playwright covers WebKit and Firefox, where clipboard behaviour differs (REQ-016), and the owner ruled all three browsers in (A-043) | enforced: checks/conformance.sh (BASELINE.md vid-forbidden) | scope: project | origin: proposal
- **D-010** Design: no design pass; the page is plain, built from semantic HTML and one small stylesheet, no design/ directory | why: the owner's hint "Plain, no design pass" | enforced: convention | scope: project | origin: proposal
- **D-011** Three modules: src/checker (pure engine), src/server (HTTP, limits, operator log), src/web (the page); the checker is a pure function of the text so that the accuracy golden set (REQ-030) runs against it directly | why: the engine is the product's core and must be testable without a network; only the server touches I/O | enforced: checks/imports.sh (ARCHITECTURE.md seam table) | scope: project | origin: proposal
- **D-012** ViD budget: stacks=1 (one test stack at a time) | why: the default; one small product on one machine | enforced: convention | scope: project | about: vid-settings | origin: proposal
- **D-013** ViD budget: memory-headroom-mb=2048 | why: this machine has about 15 GB with 14 GB free; 2 GB headroom keeps the test stack and browsers clear of swapping | enforced: convention | scope: project | about: vid-settings | origin: proposal
- **D-014** ViD budget: claims-per-slice=60 | why: the default | enforced: convention | scope: project | about: vid-settings | origin: proposal
- **D-015** ViD budget: wall-hours-per-slice=8 | why: the default | enforced: convention | scope: project | about: vid-settings | origin: proposal
- **D-016** ViD budget: court-seconds=300 | why: the default | enforced: convention | scope: project | about: vid-settings | origin: proposal
- **D-017** ViD budget: builder-context-tokens=400000 | why: the default; a builder or fixer is told once to finish at this context | enforced: convention | scope: project | about: vid-settings | origin: proposal
