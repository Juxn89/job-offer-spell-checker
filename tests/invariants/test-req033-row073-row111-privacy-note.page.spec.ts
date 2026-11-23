// Purpose: ledger tests for ROW-073 and ROW-111 (REQ-033) — the footer links to the privacy note, and the
// note says what happens to the offer's text and the IP address, the 7-day log limit and that nothing else
// is collected (ROW-073), and names the controller and a contact, the purpose and legal basis of each
// processing, the visitor's rights and how to use them, and the right to complain (ROW-111).
// Provenance: hand-authored by the test-author pass (slice skeleton, batch privacy-page); what the note
// must say comes from REQ-033 and owner answers A-028, A-029 and A-040, never from the product's source.
//
// Test argument
// ROW-073 promise: REQ-033 (A-029, A-028) — the footer links to the note; the note says the offer's text
// ROW-073   is processed in memory only and never kept, the IP address is held briefly for the abuse limit,
// ROW-073   request logs hold no full IP and are deleted within 7 days, and nothing else is collected.
// ROW-073 wrong product: the link sits in the header, not the footer, or leads to a page without the note;
// ROW-073   the note says the text "is processed on our server" but never that it is not kept; it gives
// ROW-073   the logs a 30-day retention, or says nothing about the IP in the logs being partial; it omits
// ROW-073   the IP's short holding for the limit; it never says nothing else is collected.
// ROW-073 given: the checker page. when: the writer operates the privacy link inside the footer
// ROW-073   (data-element="footer" → "privacy-link", D-021). then: the note (data-element="privacy-note")
// ROW-073   is shown, and within one reading unit of it (an innermost block — paragraph, list item, table
// ROW-073   row — or a heading with what follows it) each statement stands: texto/oferta + memoria;
// ROW-073   texto/oferta + a negated keep (no se guarda / no lo almacenamos…); IP + límite/abuso +
// ROW-073   minuto/breve; registro + 7/siete días; registro + IP + not complete (no … completa / parcial /
// ROW-073   truncada / anonimizada); and a "nothing else" statement (ningún otro dato, nada más, solo
// ROW-073   tratamos estos datos…). Read accent- and case-insensitively.
// ROW-073 controls: the control case shows the footer link opens a page showing the note, so a red target
// ROW-073   is about what the note says, never about a page that did not open.
// ROW-073 technique: one exact place (the note's element, the link inside the footer) and co-occurrence
// ROW-073   within one reading unit, so a statement split across unrelated paragraphs — "7 días" said of
// ROW-073   something else — does not pass; the near miss "30 días" is refused by the pattern.
// ROW-073 cases: ROW-073 target=tests/invariants/test-req033-row073-row111-privacy-note.page.spec.ts::[chromium]ROW-073_the_footer_links_to_the_note,_which_says_what_happens_to_the_text,_the_IP_and_the_logs_and_that_nothing_else_is_collected control=tests/invariants/test-req033-row073-row111-privacy-note.page.spec.ts::[chromium]ROW-073_ROW-111_control:_the_footer's_privacy_link_opens_the_note
//
// ROW-111 promise: REQ-033 (A-040) — the note names who is responsible for the processing and how to
// ROW-111   contact them, the purpose and legal basis of each processing, the visitor's rights and how to use
// ROW-111   them, and the right to complain to a data-protection authority.
// ROW-111 wrong product: a note that says what is done with the text and the IP but names no controller
// ROW-111   and no contact address; or lists the rights without saying how to exercise them; or gives one
// ROW-111   legal basis for "the processing" with no purpose per processing; or forgets the complaint.
// ROW-111 given/when: the note reached through the footer link, as for ROW-073. then: a unit names the
// ROW-111   responsable together with a contact (an email, or contacto / correo / escribir), and the note
// ROW-111   gives an email address (as text or a mailto link); for each processing —
// ROW-111   the offer's text (texto/oferta), the IP address (IP), the request logs (registro) — a unit
// ROW-111   names it with a purpose (finalidad / para / con el fin…) and a legal basis (base jurídica / base
// ROW-111   legal / legitimación / interés legítimo / consentimiento / art. 6); the note names the rights of
// ROW-111   access, rectification, erasure (supresión), restriction (limitación) and objection (oposición),
// ROW-111   and a unit about the rights (derecho) says how to exercise them (ejercer / escribir / solicitar /
// ROW-111   contacto, or an email); a unit names a complaint (reclamación) before a data-protection
// ROW-111   authority (autoridad de control / Agencia Española de Protección de Datos / AEPD).
// ROW-111 controls: the shared control case above (the note is reached through the footer link).
// ROW-111 technique: per-processing co-occurrence within one reading unit, so a single generic legal basis
// ROW-111   does not stand in for each processing; the GDPR rights read by name (Art. 15–18, 21).
// ROW-111 cases: ROW-111 target=tests/invariants/test-req033-row073-row111-privacy-note.page.spec.ts::[chromium]ROW-111_the_note_names_the_controller_and_contact,_purpose_and_legal_basis_per_processing,_the_rights_and_the_right_to_complain control=tests/invariants/test-req033-row073-row111-privacy-note.page.spec.ts::[chromium]ROW-073_ROW-111_control:_the_footer's_privacy_link_opens_the_note

import { expect, test } from '@playwright/test';
import { asActor, openChecker } from './harness';
import { EMAIL, followFooterPrivacyLink, NOT_KEPT, readNote, type NoteReading } from './privacy-page-helpers';

const TEXT = /\b(texto|oferta)s?\b/;
const IP = /\bip\b/;
const LOGS = /\bregistros?\b/;
const NOT_FULL_IP =
  /\b(no|nunca|ni|sin)\b(\s+\S+){0,6}?\s+\S*complet|parcial|truncad|anonimizad|seudonimizad|recortad|incomplet|\bprimeros?\b[^.]{0,30}\b(bits|octetos|bloques|digitos|cifras)/;
const NOTHING_ELSE =
  /\bningun(a|o)? (otro|otra)s?\b|\bningun dato (mas|adicional)\b|\bnada mas\b|\bno (se )?(recog|recopil|trat|guard|almacen)\w*(\s+\S+){0,4}?\s+(otros?|otras?|mas|adicional(es)?)\b|\b(solo|solamente|unicamente) (se )?(trat|recog|recopil)\w* (estos|esos|dichos) datos\b/;
const PURPOSE = /\bfinalidad\b|\bproposito\b|\bobjetivo\b|\bpara\b|\bcon el fin\b|\bsirve\b/;
const BASIS = /base (juridica|legal|de legitimacion)|\blegitimacion\b|interes legitimo|\bconsentimiento\b|obligacion legal|art(\.|iculo) ?6\b/;

const someUnit = (n: NoteReading, ...all: RegExp[]) => n.units.some((u) => all.every((re) => re.test(u)));

test("ROW-073 ROW-111 control: the footer's privacy link opens the note", async ({ page }) => {
  asActor('anonymous');
  await openChecker(page);
  await followFooterPrivacyLink(page);
});

test('ROW-073 the footer links to the note, which says what happens to the text, the IP and the logs and that nothing else is collected', async ({ page }) => {
  asActor('anonymous');
  await openChecker(page);
  const { note } = await followFooterPrivacyLink(page);
  const n = await readNote(note);

  expect(someUnit(n, TEXT, /\bmemoria\b/), 'ROW-073: the note says the offer\'s text is processed in memory').toBe(true);
  expect(someUnit(n, TEXT, NOT_KEPT), 'ROW-073: the note says the offer\'s text is never kept').toBe(true);
  expect(someUnit(n, IP, /\blimite\b|\babuso\b/, /\bminuto\b|\bbreve|\btemporal|\bmomentane/), 'ROW-073: the note says the IP address is held briefly, for the abuse limit').toBe(true);
  expect(someUnit(n, LOGS, /\b(7|siete) dias\b/), 'ROW-073: the note says request logs are deleted within 7 days').toBe(true);
  expect(someUnit(n, LOGS, IP, NOT_FULL_IP), 'ROW-073: the note says request logs hold no full IP address').toBe(true);
  expect(someUnit(n, NOTHING_ELSE), 'ROW-073: the note says nothing else is collected').toBe(true);
});

test('ROW-111 the note names the controller and contact, purpose and legal basis per processing, the rights and the right to complain', async ({ page }) => {
  asActor('anonymous');
  await openChecker(page);
  const { note } = await followFooterPrivacyLink(page);
  const n = await readNote(note);

  expect(
    someUnit(n, /\bresponsable\b/, new RegExp(`${EMAIL.source}|contact|correo|escrib|e-?mail`, 'i')),
    'ROW-111: the note names who is responsible for the processing together with how to contact them',
  ).toBe(true);
  expect(EMAIL.test(n.whole) || n.mailto.length > 0, 'ROW-111: the note gives a contact email address').toBe(true);

  for (const [name, re] of [['the offer\'s text', TEXT], ['the IP address', IP], ['the request logs', LOGS]] as const) {
    expect(someUnit(n, re, PURPOSE, BASIS), `ROW-111: the note gives the purpose and the legal basis of processing ${name}`).toBe(true);
  }

  for (const [right, re] of [
    ['access', /\bacceso\b|\bacceder\b/],
    ['rectification', /\brectific/],
    ['erasure', /\bsupresion\b|\bsuprimir\b|\bborrado\b|\bborrar\b|\beliminacion\b|\bolvido\b/],
    ['restriction', /\blimitacion del tratamiento\b|\blimitar (el|su) tratamiento\b|\blimitacion\b/],
    ['objection', /\boposicion\b|\boponerse\b|\boponerte\b/],
  ] as const) {
    expect(re.test(n.whole), `ROW-111: the note names the right of ${right}`).toBe(true);
  }
  expect(
    n.units.some((u) => /\bderechos?\b/.test(u) && (/\bejerc|\bescrib|\bsolicit|\bcontact|\benvi/.test(u) || EMAIL.test(u))),
    'ROW-111: the note says how to exercise the rights',
  ).toBe(true);
  expect(
    someUnit(n, /\breclamacion\b|\breclamar\b|\bdenuncia|\bqueja\b/, /autoridad (de control|de proteccion de datos)|agencia espanola de proteccion de datos|\baepd\b|autoridad supervisora/),
    'ROW-111: the note gives the right to complain to a data-protection authority',
  ).toBe(true);
});
