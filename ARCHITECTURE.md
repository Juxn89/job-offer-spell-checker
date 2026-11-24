# Revisor ortográfico de ofertas — ARCHITECTURE

The seam table. One row per module. Updated in the same commit as any seam
change (law in CLAUDE.md). This table is EXECUTED, not descriptive: it is the
import court's rule source (checks/imports.sh reads it at every commit). A
module with no row cannot be imported; a row that lies fails the build.

Import court: enforce
<!-- "Import court: enforce" fails closed. For a retrofit onto an existing
     codebase write "Import court: report-only" instead: violations are
     listed at every commit but never fatal, until the owner picks the
     cutover commit and flips this line to enforce (run
     `sh checks/imports.sh --report` for the full tree-wide list). -->

## Column contract (machine-read — keep the shapes exact)

- **Module** — the module's repo path (`apps/web`, `packages/core/alerts`);
  `/src/` segments in real file paths are collapsed when matching, so
  `packages/core/alerts` also owns `packages/core/src/alerts/`. Django-style
  dotted labels (`apps.public`) are accepted and read as paths.
- **Public surface** — leads with the module's import specifier(s) in
  backticks (`` `@revisor/core/alerts` ``); prose may follow. Importing any
  path DEEPER than a declared specifier is a violation — declare an entry
  point per module, not one barrel for the world. A row with no backticked
  specifier can only be reached by its own files.
- **Dependents** — comma-separated Module paths that may import this module,
  or `all`, or `none`. Direction law is encoded here: app-layer rows say
  `none` (nothing imports the app), so core reaching into app is rejected as
  an undeclared dependent. Relative imports that cross module paths are
  always violations — enter a module through its specifier.

| Module | Responsibility | Owned tables/data | Public surface | Dependents |
|---|---|---|---|---|
| src/checker | The spelling engine: splits the text into words (REQ-005, REQ-035), applies the exemptions and rules (REQ-003, REQ-004, REQ-006 to REQ-009), flags misspellings with their positions and up to 5 suggestions (REQ-001, REQ-010). Pure function of the text; no I/O. | the vendored Spanish dictionary and the built-in term list (read-only, shipped in the code, REQ-029) | `@revisor/checker` — `check(text)` returning the flagged words with offsets and suggestions | src/server, tests/invariants |
| src/server | The HTTP server: serves the page and its assets, the check endpoint, the 10,000-character limit (REQ-021), the per-address limit held in memory (REQ-022, REQ-032), security headers and HTTPS-only behaviour behind Caddy (REQ-020), the operator log of kind and time (REQ-027). Never logs or stores the text (REQ-017, REQ-018). | the in-memory per-address window (1 minute, never persisted); the operator log (kind and time only) | `@revisor/server` — the process entry point; nothing imports it | none |
| src/web | The page: text box, Check spelling, highlights and count line, the suggestion menu with Replace and Ignore, Copy text with its fallback, the messages and the privacy notice, the page-language selector and the light/dark theme switch (REQ-002, REQ-011 to REQ-016, REQ-019, REQ-025, REQ-026, REQ-028, REQ-031, REQ-033, REQ-046 to REQ-049). Bundled to static files the server serves. | the visitor's two page preferences, language (en or es) and theme (light or dark), in that visitor's own browser storage, each written only when its own control is used (REQ-049); nothing else, and no part of the offer (REQ-018) | `@revisor/web` — the page bundle's entry; nothing imports it | none |

Laws:

- A module without a row here should not be committed to — add the row in the
  same commit.
- Cross-module access goes through the public-surface column only; reaching
  into another module's tables or internals is a defect — and, since v0.6, a
  rejected commit.
- The dependents column is the blast-radius map: a fix in module X re-grades
  X plus its declared dependents, not the whole product (/vid fix law).

## Where it runs

<!-- v0.26.10.8 (R4): the owner's answers at init (vid-staging-setup Part 1),
     one `key: value` line each — never a table, so the seam table's readers
     never see it, and NEVER a credential. access: and dns-access: take only
     `cli-login <platform>` (the word equal to platform:), `env <NAME>` (a
     variable the owner keeps outside the repository, by its name) or `none`;
     the pre-commit hook refuses any other shape. A later answer updates its
     key in place, in a commit citing the owner's answer. -->

```vid-hosting
platform: hetzner
region: eu-central (Germany, Falkenstein or Nuremberg; Helsinki as the alternative)
staging: staging subdomain of the owner's domain, the domain to be named by the owner before the first staging deploy
production: the owner's domain (or a subdomain of it), named by the owner before the first staging deploy
sending: none
spend-cap: 20 EUR a month
access: env HCLOUD_TOKEN
dns-access: none
owner-only: create the Hetzner Cloud project and its API token, kept in HCLOUD_TOKEN outside the repository; set the project's spending alert at 20 EUR; name the domain; add the DNS records pointing staging and production at the server; create the outside uptime-probe account (REQ-024); provide the contact mailbox shown in the footer (REQ-028)
providers: uptime-probe (outside monitor that checks a fixed sample text every 5 minutes, never an offer): live-restricted on staging once built
```

