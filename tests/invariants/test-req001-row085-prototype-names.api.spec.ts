// Purpose: ROW-085 (REQ-001, REQ-025) — words that name JavaScript's built-in object properties
// (__proto__, constructor, toString, valueOf …), in the offer's text and as keys of the request's JSON,
// get an ordinary answer and no server error, and a later check of the same sample text returns exactly
// the answer it got before them.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch words); the sample's expected
// flags are the test's own record of where it placed an accent-stripped word (gestion, REQ-001's example)
// and a fresh non-word, and dictionary facts come from the harness oracle (dictionary-es 4.0.0, pinned).
//
// Test argument
// ROW-085 promise: __proto__, constructor, toString and valueOf, in the text and as JSON keys, give an
//   ordinary result with no server error, and a later check of the fixed sample text returns exactly its
//   known result (ROW-085, origin domain; REQ-001: every word the dictionary does not hold is flagged, a
//   dictionary word is not; D-020: the answer's shape, and "a body without a string text answers 400
//   {"error": "malformed"}"; REQ-025: a failure never passes for a clean result).
// ROW-085 wrong product: a checker that keeps its word list in a plain object and asks `words[w]`, so
//   "toString", "valueOf" or "hasOwnProperty" find a built-in function and pass as correct; one that
//   copies the body with Object.assign / a spread-merge, so {"__proto__": {"text": …}} is read as a text
//   to check (or pollutes Object.prototype, and every later answer carries the attacker's fields); one
//   that turns {"text": {"toString": …}} into a string and throws (a 500); one whose cache keyed by a
//   plain object answers the later sample differently.
// ROW-085 given: a sample text (fillers, "gestion", a fresh non-word) with its known flags; a text holding
//   __proto__, constructor, toString, valueOf, hasOwnProperty, isPrototypeOf, __defineGetter__ and their
//   lower-case run-together forms; bodies whose keys are __proto__, constructor, toString, valueOf, and a
//   "text" that is an object; when: the sample is checked, then the names text, then the hostile bodies,
//   then the sample again; then: the sample's first answer flags exactly gestion and the non-word at their
//   offsets (gestión first for gestion); the names text answers 200 in the D-020 shape with toString,
//   valueOf, hasOwnProperty, isPrototypeOf and the lower-case forms each flagged at its place, constructor
//   (a dictionary word) and the fillers not; a body with no own string "text" answers 400 malformed; a
//   body with a string text and hostile extra keys answers ordinarily (the sample's own answer, or 400
//   malformed); and the sample's last answer is identical to its first.
// ROW-085 controls: the sample's first answer, checked against the test's own record, is the control
//   case: the endpoint answers and flags; the target needs the names flagged and the later answer equal.
// ROW-085 technique: hostile values at the boundary (property names a plain-object lookup or a merge
//   mishandles) plus a before/after relation on one fixed sample — a polluted server changes the after.
// cases: ROW-085 target=ROW-085-prototype-names-in-the-text-and-as-json-keys-give-ordinary-answers-and-leave-later-checks-unchanged control=ROW-085-control-the-sample-text-gets-its-known-flags

import { expect, test } from '@playwright/test';
import {
  asActor,
  checkText,
  compose,
  fillerWords,
  freshNonWord,
  freshRandom,
  isDictionaryWord,
  sendRaw,
  type CheckAnswer,
  type Rng,
} from './harness';
import { firstSuggestionAt, flagDiff, layout } from './words-helpers';

const JSON_HEADERS = { 'content-type': 'application/json' };

function sample(rng: Rng) {
  const nonWord = freshNonWord(rng);
  const { text, items } = layout(rng, [{ word: 'gestion' }, { word: nonWord }]);
  return { text, items, nonWord };
}

function parse(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return `not JSON: ${body.slice(0, 200)}`;
  }
}

test('ROW-085-control-the-sample-text-gets-its-known-flags', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const s = sample(rng);
  const answer = await checkText(s.text);
  expect(
    { flags: flagDiff(s.text, answer, s.items), gestionFirst: firstSuggestionAt(answer, s.items[0]) },
    `ROW-085 control: the sample ${JSON.stringify(s.text)} gets exactly gestion and "${s.nonWord}" flagged, gestión first for gestion (seed ${rng.seed})`,
  ).toEqual({ flags: { notFlagged: [], flaggedWrongly: [] }, gestionFirst: 'gestión' });
});

test('ROW-085-prototype-names-in-the-text-and-as-json-keys-give-ordinary-answers-and-leave-later-checks-unchanged', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const s = sample(rng);

  // 1. The sample, before anything hostile: its known result.
  const first = await checkText(s.text);
  expect(
    { flags: flagDiff(s.text, first, s.items), gestionFirst: firstSuggestionAt(first, s.items[0]) },
    `ROW-085: the sample ${JSON.stringify(s.text)} first gets its known result (seed ${rng.seed})`,
  ).toEqual({ flags: { notFlagged: [], flaggedWrongly: [] }, gestionFirst: 'gestión' });

  // 2. The names in the text.
  const mustFlag = ['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'tostring', 'valueof', 'hasownproperty', 'proto'];
  const unjudged = ['__proto__', '__defineGetter__']; // underscores: no ratified rule says how they split
  for (const w of mustFlag) if (isDictionaryWord(w) || isDictionaryWord(w.toLowerCase())) throw new Error(`setup: the dictionary oracle holds ${w}`);
  if (!isDictionaryWord('constructor')) throw new Error('setup: the dictionary oracle does not hold constructor');
  const fillers = fillerWords();
  const tokens: string[] = [];
  for (const w of rng.shuffle([...mustFlag, ...unjudged, 'constructor', 'constructor'])) tokens.push(rng.pick(fillers), w);
  tokens.push(rng.pick(fillers));
  const { text: namesText, placed } = compose(tokens);
  const judged = placed.filter((p) => !unjudged.includes(p.word));
  const names = await sendRaw({ body: JSON.stringify({ text: namesText }), headers: JSON_HEADERS });
  expect(names.status, `ROW-085: the names text is answered without a server error: ${names.body.slice(0, 200)}`).toBe(200);
  const namesAnswer = parse(names.body) as CheckAnswer;
  expect(Array.isArray(namesAnswer?.flagged) && namesAnswer.v === 1, `ROW-085: the names text's answer has the D-020 shape: ${names.body.slice(0, 200)}`).toBe(true);
  expect(
    {
      flags: flagDiff(namesText, namesAnswer, placed.filter((p) => mustFlag.includes(p.word)), judged),
      flagsNotOnTheirText: namesAnswer.flagged.filter((f) => namesText.slice(f.start, f.end) !== f.word).map((f) => JSON.stringify(f)),
    },
    `ROW-085: in ${JSON.stringify(namesText)} ${mustFlag.join(', ')} are each flagged at their place, constructor and the fillers are not (seed ${rng.seed})`,
  ).toEqual({ flags: { notFlagged: [], flaggedWrongly: [] }, flagsNotOnTheirText: [] });

  // 3. The names as JSON keys (sent as raw JSON text: a JavaScript object literal would eat "__proto__").
  const t = JSON.stringify(s.text);
  const malformed = [
    `{"__proto__": {"text": ${t}}}`,
    `{"constructor": {"prototype": {"text": ${t}}}}`,
    `{"text": {"toString": "x", "valueOf": "y", "__proto__": {"length": 3}}}`,
  ];
  for (const body of malformed) {
    const res = await sendRaw({ body, headers: JSON_HEADERS });
    expect({ status: res.status, body: parse(res.body) }, `ROW-085: a body with no own string "text" is refused as malformed (D-020): ${body.slice(0, 120)}`).toEqual({
      status: 400,
      body: { error: 'malformed' },
    });
  }
  const extra = `{"text": ${t}, "__proto__": {"v": 2, "flagged": [], "polluted": "yes"}, "constructor": {"prototype": {"polluted": "yes"}}, "toString": "x", "valueOf": 1, "hasOwnProperty": "y"}`;
  const extraRes = await sendRaw({ body: extra, headers: JSON_HEADERS });
  const extraBody = parse(extraRes.body);
  const ordinary =
    (extraRes.status === 200 && JSON.stringify(extraBody) === JSON.stringify(first)) ||
    (extraRes.status === 400 && JSON.stringify(extraBody) === JSON.stringify({ error: 'malformed' }));
  expect(ordinary, `ROW-085: a body with the sample as its text and prototype names as extra keys gets the sample's own answer or a plain malformed refusal — got ${extraRes.status} ${extraRes.body.slice(0, 200)}`).toBe(true);

  // 4. The sample again: exactly the answer it got before.
  const last = await checkText(s.text);
  expect(last, `ROW-085: after the hostile requests the sample ${JSON.stringify(s.text)} gets exactly its first answer (seed ${rng.seed})`).toEqual(first);
});
