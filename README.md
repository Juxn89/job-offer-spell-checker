# Job offer spell checker

A public web page for checking the spelling of a job offer written in Spanish. Paste the offer and press **Check spelling**. The page highlights each misspelled word in place, missing accents included, without flagging ordinary job vocabulary. Click a highlighted word to replace it with a suggestion or ignore it, then copy the corrected text back in one click.

- **Private by design.** The check runs on our own server against an open-source Spanish dictionary (Hunspell `es`). The offer's text never leaves that server and is never stored or logged. The page sets no cookies.
- **Knows job offers.** Acronyms (SQL, RRHH), tech terms (JavaScript, freelance, home office), inclusive forms (candidato/a, todes), web and email addresses, names, and spellings from Spain and Latin America are not flagged.
- **English or Spanish, light or dark.** The page opens in English and follows your device's theme. A selector switches the page to Spanish and a switch toggles the theme at once. Both choices are remembered only in your own browser.
- **Limits.** Up to 10,000 characters per check, and 30 checks a minute per address.

## Status

This is a working demo, not yet online.

- Some correct verbs with an attached pronoun are flagged as mistakes, for example *Postúlate*, *Contáctanos* and *Inscríbete*.
- The footer has no contact email yet.
- There is no deployment yet; the planned host is Hetzner (see `ARCHITECTURE.md`).

## Run it locally

With Docker running, from this folder:

    VID_LEDGER_INTERNAL=false docker compose -f docker-compose.test.yml up --build product

Then open <http://localhost:8080>. Stop it with Ctrl+C.

If port 8080 is already taken, publish another one with a small override file, for example `preview.yml`:

```yaml
services:
  product:
    ports: !override ["127.0.0.1:8081:8080"]
```

    VID_LEDGER_INTERNAL=false docker compose -f docker-compose.test.yml -f preview.yml up --build product

Then open <http://localhost:8081>.

## How it is built

- `src/checker/` — the spelling logic: word splitting, exemptions, suggestions, the job and tech term list, and the dictionary.
- `src/server/` — the HTTP server (Fastify): the check endpoint, its limits and the security headers.
- `src/web/` — the page: markup, styles and client script, bundled with esbuild.
- `deploy/` — the production files (not written yet).

The project was specified with ViD: the product specification is `PRD.md`, the stack and the rules that must never break are in `BASELINE.md`, the modules and hosting in `ARCHITECTURE.md`, and the decisions made so far in `DECISIONS.md`.

## Tests

The tests run only inside Docker, through `sh checks/test.sh`. They live in `tests/invariants/`, one file per rule the product must keep. They were written before the page's default language became English, so the ones that read Spanish labels need updating.

## Before you put this online

Not a framework. A sticky note. With /vid deploy, items 1, 2, 4 and 5 are
enforced structurally — the rest still matter.

1. Restore one backup before you trust backups — actually run the restore, once, end to end.
2. Redirect a week of outbound email to your own inbox first; read what the product sends.
3. Try one real feed/integration end-to-end before switching them all on.
4. Rotate any secret an agent ever saw — every key that was ever pasted into a session.
5. Agents never hold prod credentials. Deploys happen from your hands, not from a session.
6. Put a spending cap on every paid API and on the hosting account.
7. Check each Tier-0 row in BASELINE.md by hand once, in the real environment.
8. Keep a copy of PRD.md and DECISIONS.md somewhere off the server.
9. First week: read the logs daily. Boring logs are the goal.
10. When something is wrong, run /vid:vid-fix and answer its questions — don't patch by hand.
