// Purpose: the spelling engine's one public surface (`@revisor/checker`): check(text) returns the
// flagged words of a Spanish job offer with their positions and suggestions. Pure function of the
// text, no I/O beyond reading the vendored dictionary once (REQ-029).
//
// Skeleton state (golden-path example, REQ-001): the dictionary is really loaded and the function is
// really wired through the server to the page, but no word is flagged yet — the placeholder result
// does not meet REQ-001, so its ledger test is red until the checker's step builds the rules.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import nspell from 'nspell';

/** One flagged word: offsets are UTF-16 code-unit indices into the checked text (D-020). */
export interface Flag {
  start: number;
  end: number;
  word: string;
  suggestions: string[];
}

export interface CheckResult {
  flagged: Flag[];
}

type Speller = ReturnType<typeof nspell>;
let speller: Speller | undefined;

/** Loads the vendored dictionary once; later calls are free. Returns the load time in ms. */
export function loadDictionary(): number {
  if (speller) return 0;
  const started = Date.now();
  const dir = fileURLToPath(new URL('./dictionary/', import.meta.url));
  speller = nspell(readFileSync(dir + 'es.aff.txt'), readFileSync(dir + 'es.dic.txt'));
  return Date.now() - started;
}

/** True once the dictionary is loaded. */
export function isReady(): boolean {
  return speller !== undefined;
}

/** REQ-001: flags the words of the offer that the Spanish dictionary does not hold (placeholder). */
export function check(text: string): CheckResult {
  loadDictionary();
  void text;
  return { flagged: [] };
}
