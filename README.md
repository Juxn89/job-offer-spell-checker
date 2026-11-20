# Revisor ortográfico de ofertas

A public web page for checking the spelling of a Spanish job offer. You paste the offer and press **Revisar ortografía**. The page highlights the misspelled words, accents included, without flagging ordinary job vocabulary. You can replace or ignore each flagged word, then copy the corrected text back in one click.

The check runs on our own server against an open-source Spanish dictionary. The offer's text never leaves that server and is never stored or logged.

The specification is in `PRD.md`. The stack and the rules that must never break are in `BASELINE.md`, the modules and hosting in `ARCHITECTURE.md`, and the choices made so far in `DECISIONS.md`.

There is no code yet. How to run the page, how to test it (`sh checks/test.sh`) and the preview command arrive with the code skeleton, which `/vid develop` builds as its first step.

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
