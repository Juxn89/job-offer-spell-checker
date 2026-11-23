// Purpose: ROW-132 (REQ-021, A-045) — the page's limit and the server's count the same unit, characters as
// a person sees them: an offer of exactly 10,000 such characters made of emoji and decomposed accents is
// accepted by both, one of 10,001 is refused by both, and the count is taken before any normalisation.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from REQ-021 arm
// 5 and A-045; texts built by server-limits-helpers.ts (offerOfGraphemes) with a fresh seed per run, their
// counts taken by Intl.Segmenter (UAX #29 grapheme clusters) before anything is sent.
//
// Test argument
// ROW-132 promise: "characters are counted as a person sees them, an emoji or an accented letter counting
//   as one, the same way on the page and on the server" (REQ-021, A-045): 10,000 such characters made of
//   emoji and decomposed accents are accepted by the page and by the server, 10,001 refused by both; the
//   cap applies before normalisation (the row).
// ROW-132 wrong product: a server counting UTF-16 units (text.length) or bytes, or a page whose box has
//   maxlength=10000 (which counts UTF-16 units) — each refuses or cuts the 10,000-character emoji offer;
//   or a server that normalises with NFKC before counting, turning each "…" into three characters; or a
//   page counting graphemes while the server counts code points, so page and server disagree.
// ROW-132 given: a text of exactly 10,000 grapheme clusters — accented dictionary words in NFD (letter +
//   U+0301), emoji with skin tones, ZWJ families and flags, and "…" — whose UTF-16 length, code points,
//   bytes and NFKC-normalised count all exceed 10,000; and the same text plus one emoji (10,001); when:
//   each is POSTed to /api/check, and each is entered on the page and Revisar ortografía pressed; then:
//   the server answers 10,000 with a D-020 answer and refuses 10,001; the page sends the 10,000 whole and
//   shows a result with no limit message, and refuses the 10,001 with a message naming the limit, the
//   text untouched, nothing answered as checked.
// ROW-132 controls: the setup guards show every wrong unit really over-counts this text; a short offer
//   built the same way is answered 200 by the server (emoji and decomposed accents are checkable at all,
//   so a refusal at 10,000 can only be the count).
// ROW-132 technique: values just either side of the threshold in the unit the owner chose, with the
//   other units pushed far apart in the same data so right and wrong never coincide.
// cases: ROW-132 target=ROW-132-10000-characters-of-emoji-and-decomposed-accents-accepted-and-10001-refused-by-page-and-server control=ROW-132-control-a-short-offer-of-emoji-and-decomposed-accents-is-checked

import { expect, test } from '@playwright/test';
import { ROLES, asActor, enterOffer, freshRandom, openChecker, sendRaw } from './harness';
import {
  CHARACTER_LIMIT,
  NAMES_THE_LIMIT,
  asCheckAnswer,
  expectShown,
  graphemeCount,
  isRefusal,
  offerOfGraphemes,
  offerValue,
  pressCheckButton,
  visibleText,
  watchChecks,
} from './server-limits-helpers';

test('ROW-132-10000-characters-of-emoji-and-decomposed-accents-accepted-and-10001-refused-by-page-and-server', async ({ page }) => {
  test.setTimeout(300_000);
  asActor('anonymous');
  const rng = freshRandom();
  const at = offerOfGraphemes(rng, CHARACTER_LIMIT);
  const over = at.text + '👍';
  expect(graphemeCount(over), 'ROW-132 setup: the near miss is one character longer').toBe(CHARACTER_LIMIT + 1);
  expect(
    {
      utf16OverLimit: at.units > CHARACTER_LIMIT + 1_000,
      codePointsOverLimit: at.codePoints > CHARACTER_LIMIT + 1_000,
      bytesOverLimit: at.bytes > CHARACTER_LIMIT * 1.5,
      nfkcOverLimit: at.afterNfkc > CHARACTER_LIMIT,
    },
    `ROW-132 setup: every wrong unit over-counts the 10,000-character text (units ${at.units}, code points ${at.codePoints}, bytes ${at.bytes}, after NFKC ${at.afterNfkc})`,
  ).toEqual({ utf16OverLimit: true, codePointsOverLimit: true, bytesOverLimit: true, nfkcOverLimit: true });

  // The server, sent directly.
  const serverAt = await sendRaw({ body: { text: at.text } });
  expect(
    { status: serverAt.status, checked: asCheckAnswer(serverAt.body) !== null },
    `ROW-132: the server accepts exactly 10,000 characters of emoji and decomposed accents (${serverAt.body.slice(0, 200)})`,
  ).toEqual({ status: 200, checked: true });
  const serverOver = await sendRaw({ body: { text: over } });
  expect(isRefusal(serverOver), `ROW-132: the server refuses 10,001 such characters (answer ${serverOver.status}: ${serverOver.body.slice(0, 200)})`).toBe(true);

  // The page, at the limit.
  await openChecker(page);
  const seenAt = watchChecks(page);
  await enterOffer(page, at.text);
  expect(await offerValue(page), 'ROW-132: the box takes the 10,000 characters whole').toBe(at.text);
  await pressCheckButton(page, 'wait');
  await expect
    .poll(() => seenAt.map((s) => ({ whole: s.text === at.text, status: s.status })), {
      message: 'ROW-132: the page sends the 10,000 characters whole and they are answered as checked',
      timeout: 30_000,
    })
    .toEqual([{ whole: true, status: 200 }]);
  await expect
    .poll(() => visibleText(page, ROLES.count), { message: 'ROW-132: the page shows the check\'s result line for the 10,000 characters', timeout: 15_000 })
    .not.toBe('');
  expect(await visibleText(page, ROLES.message), 'ROW-132: no message names the limit for 10,000 characters').not.toMatch(NAMES_THE_LIMIT);

  // The page, one over.
  await openChecker(page);
  const seenOver = watchChecks(page);
  await enterOffer(page, over);
  expect(await offerValue(page), 'ROW-132: the box takes the 10,001 characters whole — nothing is cut on entry').toBe(over);
  await pressCheckButton(page, 'wait');
  await expectShown(page, ROLES.message, NAMES_THE_LIMIT, 'ROW-132: the page refuses 10,001 such characters with a message naming the limit');
  expect(await offerValue(page), 'ROW-132: the refused text stays in the box untouched').toBe(over);
  expect(seenOver.filter((s) => s.status === 200 || (s.text !== null && s.text !== over)).length, 'ROW-132: nothing of the 10,001 characters was answered as checked or sent cut').toBe(0);
});

test('ROW-132-control-a-short-offer-of-emoji-and-decomposed-accents-is-checked', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const short = offerOfGraphemes(rng, 120);
  const res = await sendRaw({ body: { text: short.text } });
  expect(
    { status: res.status, checked: asCheckAnswer(res.body) !== null },
    `ROW-132 control: a 120-character offer of emoji and decomposed accents is answered as checked (${res.body.slice(0, 200)})`,
  ).toEqual({ status: 200, checked: true });
});
