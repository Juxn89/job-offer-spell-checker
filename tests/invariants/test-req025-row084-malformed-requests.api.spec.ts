// Purpose: ROW-084 (REQ-021, REQ-025) — malformed check requests (text not a string, a body without text,
// invalid JSON, invalid UTF-8, deeply nested JSON) get a plain refusal carrying none of the server's
// insides; a body over the byte cap is refused before it has been sent in full, whether its length is
// declared or chunked; and ordinary checks are still answered afterwards.
// Provenance: hand-authored by the test-author pass (slice skeleton, batch server-limits) from the row,
// REQ-025 and D-020 ("a body without a string `text` answers 400"); bodies are built here byte for byte,
// the ordinary offers carry fresh non-words.
//
// Test argument
// ROW-084 promise: malformed check requests get a plain refusal with no internals, the byte cap is
//   applied before the body is read in full, and ordinary checks are still answered (the row; D-020's
//   400 for a body without a string text; REQ-021 the limit enforced for every request, whatever sends
//   it; REQ-025 a failure never shown as a technical error).
// ROW-084 wrong product: a server whose parser errors travel to the client ("Unexpected token … in JSON
//   at position 12", "FST_ERR_CTP_INVALID_JSON_BODY", a stack with /srv/dist paths); one that coerces
//   {"text": 12345} or ["hola"] to a string and checks it; one that decodes invalid UTF-8 into U+FFFD and
//   checks it; one that buffers any body before measuring it, so a client declaring 64 MiB, or streaming
//   chunks without end, holds the server's memory and a connection; one that falls over after these, so
//   the next ordinary check fails.
// ROW-084 given: nine malformed bodies (text a number, an array, null; text missing beside a near-miss
//   key; a body that is an array or a bare string; truncated JSON; a text holding the bytes C3 28; text
//   nested 20,000 arrays deep) POSTed as application/json; a body declared as 64 MiB, and a chunked body,
//   each streamed to 16 MiB and then stalled; when: each is sent; then: the first seven are answered 400
//   and the others with a 4xx, each body short and free of framework codes, parser messages, paths and
//   stacks; the server ends each over-cap request before the client has sent its 16 MiB (a plain 4xx, a
//   close or a reset — a reset can discard a refusal already sent, so the end is the observation, and
//   an answer that does arrive must be a plain 4xx); and a following ordinary check is answered 200 with
//   exactly its non-word flagged.
// ROW-084 controls: a well-formed check sent through the same raw door (same bytes path, same headers)
//   is answered with its non-word flagged — refusals come from the bodies, not the door.
// ROW-084 technique: one near miss per malformation, sent byte for byte; for the cap, a body that never
//   completes, so its end by the server before 16 MiB proves the cap came before the end of the body.
// cases: ROW-084 target=ROW-084-malformed-check-requests-get-a-plain-refusal-and-an-ordinary-check-is-still-answered control=ROW-084-control-a-well-formed-check-through-the-raw-door-is-answered

import { connect } from 'node:net';
import { expect, test } from '@playwright/test';
import { asActor, freshRandom, takeCheckSlot } from './harness';
import { INTERNALS, PRODUCT_HOST, PRODUCT_PORT, asCheckAnswer, flagsOf, ordinaryOffer, rawRequest } from './server-limits-helpers';

const JSON_TYPE = { 'content-type': 'application/json' };
const DECLARED = 64 * 1024 * 1024;
const STREAMED = 16 * 1024 * 1024;
const REFUSAL_BOUND_MS = 30_000;

function malformedBodies(): { name: string; body: Buffer; d020: boolean }[] {
  const depth = 20_000;
  return [
    { name: 'text is a number', body: Buffer.from('{"text":12345}'), d020: true },
    { name: 'text is an array', body: Buffer.from('{"text":["hola","mundo"]}'), d020: true },
    { name: 'text is null', body: Buffer.from('{"text":null}'), d020: true },
    { name: 'no text, a near-miss key', body: Buffer.from('{"texto":"hola mundo"}'), d020: true },
    { name: 'the body is an array', body: Buffer.from('["hola mundo"]'), d020: true },
    { name: 'the body is a bare string', body: Buffer.from('"hola mundo"'), d020: true },
    { name: 'truncated JSON', body: Buffer.from('{"text":"hola mun'), d020: false },
    { name: 'invalid UTF-8 in the text', body: Buffer.concat([Buffer.from('{"text":"hol'), Buffer.from([0xc3, 0x28]), Buffer.from('a mundo"}')]), d020: false },
    { name: 'text nested 20,000 arrays deep', body: Buffer.from('{"text":' + '['.repeat(depth) + ']'.repeat(depth) + '}'), d020: false },
  ];
}

test('ROW-084-malformed-check-requests-get-a-plain-refusal-and-an-ordinary-check-is-still-answered', async () => {
  test.setTimeout(400_000);
  asActor('anonymous');
  const rng = freshRandom();
  const answers: { case: string; status: number; plain: boolean; leaked: string | null }[] = [];
  const wrong: string[] = [];
  for (const m of malformedBodies()) {
    const res = await rawRequest({ headers: JSON_TYPE, body: m.body });
    const leaked = (res.body.match(INTERNALS) ?? [])[0] ?? null;
    const plain = leaked === null && res.body.length <= 1_000 && asCheckAnswer(res.body) === null;
    answers.push({ case: m.name, status: res.status, plain, leaked });
    const statusRight = m.d020 ? res.status === 400 : res.status >= 400 && res.status < 500;
    if (!statusRight || !plain) wrong.push(`${m.name}: ${res.status} ${JSON.stringify(res.body.slice(0, 160))}`);
  }
  expect(wrong, `ROW-084: every malformed check request gets a plain refusal — 400 for a body without a string text (D-020), a 4xx otherwise — with none of the server's insides (${JSON.stringify(answers)})`).toEqual([]);

  const { text, nonWord } = ordinaryOffer(rng);
  const after = await rawRequest({ headers: JSON_TYPE, body: JSON.stringify({ text }) });
  const answer = after.status === 200 ? asCheckAnswer(after.body) : null;
  expect({ status: after.status, flagged: answer && flagsOf(answer) }, `ROW-084: an ordinary check after the malformed ones is still answered (${after.body.slice(0, 200)})`).toEqual({
    status: 200,
    flagged: [nonWord],
  });
});

type Streamed = { status: number | null; body: string; sentBytes: number; ms: number; note: string };

/** Streams an over-cap body (declared or chunked) and stalls; returns the server's answer, if any, and how much had been sent. */
async function streamOverCap(mode: 'declared' | 'chunked'): Promise<Streamed> {
  await takeCheckSlot();
  return new Promise<Streamed>((resolve) => {
    const t0 = Date.now();
    let response = Buffer.alloc(0);
    let sent = 0;
    let finished = false;
    const socket = connect({ host: PRODUCT_HOST, port: PRODUCT_PORT });
    const finish = (note: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.destroy();
      const raw = response.toString('latin1');
      const m = /^HTTP\/1\.[01] (\d{3})/.exec(raw);
      const split = raw.indexOf('\r\n\r\n');
      resolve({ status: m ? Number(m[1]) : null, body: split >= 0 ? Buffer.from(raw.slice(split + 4), 'latin1').toString('utf8') : '', sentBytes: sent, ms: Date.now() - t0, note });
    };
    const timer = setTimeout(() => finish('no answer'), REFUSAL_BOUND_MS);
    socket.on('data', (d: Buffer) => {
      response = Buffer.concat([response, d]);
      const raw = response.toString('latin1');
      const split = raw.indexOf('\r\n\r\n');
      if (split < 0) return;
      const length = /\r\ncontent-length:\s*(\d+)/i.exec(raw.slice(0, split));
      if (length && response.length - (split + 4) >= Number(length[1])) finish('answered');
      else if (/\r\ntransfer-encoding:\s*chunked/i.test(raw.slice(0, split)) && raw.endsWith('0\r\n\r\n')) finish('answered');
    });
    socket.on('end', () => finish('closed by the server'));
    socket.on('close', () => finish('closed'));
    socket.on('error', () => finish('connection error'));
    socket.on('connect', async () => {
      const head =
        `POST /api/check HTTP/1.1\r\nHost: ${PRODUCT_HOST}:${PRODUCT_PORT}\r\nContent-Type: application/json\r\n` +
        (mode === 'declared' ? `Content-Length: ${DECLARED}\r\n` : 'Transfer-Encoding: chunked\r\n') +
        '\r\n';
      socket.write(head);
      const opening = Buffer.from('{"text":"');
      const chunk = Buffer.alloc(64 * 1024, 'a');
      const frame = (b: Buffer) => (mode === 'chunked' ? Buffer.concat([Buffer.from(b.length.toString(16) + '\r\n'), b, Buffer.from('\r\n')]) : b);
      let first = true;
      while (!finished && sent < STREAMED) {
        const piece = first ? Buffer.concat([opening, chunk]) : chunk;
        first = false;
        sent += piece.length;
        if (!socket.write(frame(piece))) {
          await new Promise<void>((r) => {
            socket.once('drain', () => r());
            socket.once('close', () => r());
          });
        }
      }
      // stalled from here: the body is never completed
    });
  });
}

test('ROW-084-a-body-over-the-byte-cap-is-refused-before-it-is-sent-in-full-declared-or-chunked', async () => {
  test.setTimeout(180_000);
  asActor('anonymous');
  const outcomes: Record<string, unknown>[] = [];
  for (const mode of ['declared', 'chunked'] as const) {
    const r = await streamOverCap(mode);
    outcomes.push({
      body: mode === 'declared' ? '64 MiB declared' : 'chunked, never ending',
      // The server ended the request — answered, closed or reset — while the client was still sending:
      // a reset can discard a refusal the server did send, so the end itself is the observation.
      endedByTheServerBeforeTheEnd: r.note !== 'no answer' && r.sentBytes < STREAMED,
      answerIfAnyIsAPlain4xx: r.status === null || (r.status >= 400 && r.status < 500 && !INTERNALS.test(r.body) && r.body.length <= 1_000),
      seen: `status ${r.status}, ${r.note} after ${r.ms} ms, ${r.sentBytes} bytes sent: ${JSON.stringify(r.body.slice(0, 160))}`,
    });
  }
  expect(
    outcomes.map((o) => ({ body: o.body, endedByTheServerBeforeTheEnd: o.endedByTheServerBeforeTheEnd, answerIfAnyIsAPlain4xx: o.answerIfAnyIsAPlain4xx })),
    `ROW-084: a body over the byte cap is refused (a plain 4xx, or the connection ended) before the client has sent it in full (${JSON.stringify(outcomes)})`,
  ).toEqual([
    { body: '64 MiB declared', endedByTheServerBeforeTheEnd: true, answerIfAnyIsAPlain4xx: true },
    { body: 'chunked, never ending', endedByTheServerBeforeTheEnd: true, answerIfAnyIsAPlain4xx: true },
  ]);
});

test('ROW-084-control-a-well-formed-check-through-the-raw-door-is-answered', async () => {
  asActor('anonymous');
  const rng = freshRandom();
  const { text, nonWord } = ordinaryOffer(rng);
  const res = await rawRequest({ headers: JSON_TYPE, body: Buffer.from(JSON.stringify({ text }), 'utf8') });
  const answer = res.status === 200 ? asCheckAnswer(res.body) : null;
  expect({ status: res.status, flagged: answer && flagsOf(answer) }, `ROW-084 control: a well-formed check through the raw door is answered (${res.body.slice(0, 200)})`).toEqual({
    status: 200,
    flagged: [nonWord],
  });
});
