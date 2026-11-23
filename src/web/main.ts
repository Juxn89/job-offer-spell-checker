// Purpose: the checker page's client script (`@revisor/web` bundle entry): sends the box's text to our
// own check endpoint, draws each flagged word's highlight over the box at its own place, and runs the
// correction loop — suggestions, Replace, Ignore, the count line, Copy text and every message.
// Nothing of the offer is stored in the browser (REQ-018).

interface Flag {
  start: number;
  end: number;
  word: string;
  suggestions: string[];
}

const offer = document.querySelector<HTMLTextAreaElement>('[data-element="offer"]')!;
const marks = document.querySelector<HTMLElement>('#marks')!;
const editor = marks.parentElement as HTMLElement;
const checkButton = document.querySelector<HTMLButtonElement>('[data-element="check"]')!;
const copyButton = document.querySelector<HTMLButtonElement>('[data-element="copy"]')!;
const countLine = document.querySelector<HTMLElement>('[data-element="count"]')!;
const message = document.querySelector<HTMLElement>('[data-element="message"]')!;

let flags: Flag[] = [];
let checkedText: string | null = null; // the text the shown highlights belong to
let inFlight = false;
let programmatic = false; // true while the page itself edits the box (Replace)
let menu: HTMLElement | null = null;
let menuFlag: Flag | null = null;

// REQ-018, ROW-115: a restored page never shows a previous offer.
offer.value = '';
window.addEventListener('pageshow', (e) => {
  if ((e as PageTransitionEvent).persisted) {
    offer.value = '';
    clearCheck();
  }
});

const graphemes = (t: string): number => {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment(t: string): Iterable<unknown> } }).Segmenter;
  if (!Seg) return Array.from(t).length;
  let n = 0;
  for (const _ of new Seg('es', { granularity: 'grapheme' }).segment(t)) n++;
  return n;
};

function say(text: string, warn = false): void {
  message.textContent = text;
  message.classList.toggle('warn', warn);
}

/** The box grows with its text, so the box and the highlight layer never scroll apart. */
function fitBox(): void {
  offer.style.height = 'auto';
  offer.style.height = `${offer.scrollHeight + 2}px`;
}

// REQ-002: the count line states how many words are flagged, or that no errors were found.
function showCount(cleanCheck: boolean): void {
  countLine.classList.toggle('clean', cleanCheck);
  if (cleanCheck) countLine.textContent = 'No se encontraron errores ortográficos.';
  else if (flags.length === 1) countLine.textContent = '1 palabra marcada.';
  else countLine.textContent = `${flags.length} palabras marcadas.`;
}

/** REQ-001, D-028: the highlight layer holds the box's exact text with each flagged word in a mark. */
function render(): void {
  closeMenu(false);
  marks.replaceChildren();
  if (checkedText === null) return;
  const text = offer.value;
  let at = 0;
  for (const f of flags) {
    if (f.start > at) marks.append(document.createTextNode(text.slice(at, f.start)));
    const m = document.createElement('mark');
    m.dataset.element = 'flag';
    m.tabIndex = 0;
    m.setAttribute('role', 'button');
    m.setAttribute('aria-haspopup', 'menu');
    m.setAttribute('aria-invalid', 'spelling');
    m.setAttribute('aria-label', `${f.word}: posible falta de ortografía`);
    m.textContent = text.slice(f.start, f.end);
    m.addEventListener('click', (e) => {
      e.preventDefault();
      openMenu(f, m);
    });
    m.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu(f, m);
      }
    });
    marks.append(m);
    at = f.end;
  }
  if (at < text.length) marks.append(document.createTextNode(text.slice(at)));
}

function markOf(f: Flag): HTMLElement | null {
  const i = flags.indexOf(f);
  return i < 0 ? null : (marks.querySelectorAll<HTMLElement>('[data-element="flag"]')[i] ?? null);
}

/** REQ-013: a change of the text clears every highlight, the count and any open menu. */
function clearCheck(): void {
  flags = [];
  checkedText = null;
  countLine.textContent = '';
  countLine.classList.remove('clean');
  closeMenu(false);
  marks.replaceChildren();
}

// ── The suggestion menu (REQ-010, D-033) ────────────────────────────────────────────────────────

function closeMenu(returnFocus: boolean): void {
  if (!menu) return;
  const f = menuFlag;
  menu.remove();
  menu = null;
  menuFlag = null;
  if (returnFocus && f) markOf(f)?.focus({ preventScroll: true });
}

function openMenu(f: Flag, anchor: HTMLElement): void {
  closeMenu(false);
  const box = document.createElement('div');
  box.className = 'menu';
  box.dataset.element = 'menu';
  box.setAttribute('role', 'menu');
  box.setAttribute('aria-label', `Sugerencias para ${f.word}`);
  const items: HTMLButtonElement[] = [];
  const add = (label: string, role: string, act: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.element = role;
    b.setAttribute('role', 'menuitem');
    b.textContent = label;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      act();
    });
    box.append(b);
    items.push(b);
  };
  if (f.suggestions.length === 0) {
    const none = document.createElement('p');
    none.dataset.element = 'no-suggestions';
    none.textContent = 'Sin sugerencias';
    box.append(none);
  }
  for (const s of f.suggestions.slice(0, 5)) add(s, 'suggestion', () => replace(f, s));
  if (f.suggestions.length > 0) box.append(document.createElement('hr'));
  add('Ignorar', 'ignore', () => ignore(f));

  box.addEventListener('keydown', (e) => {
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Tab') {
      closeMenu(false);
    }
  });

  editor.append(box);
  menu = box;
  menuFlag = f;
  // Below the word, kept inside the editor's width (REQ-010 on a 360-pixel phone).
  const er = editor.getBoundingClientRect();
  const ar = anchor.getBoundingClientRect();
  const width = box.offsetWidth;
  const left = Math.max(0, Math.min(ar.left - er.left, er.width - width));
  box.style.left = `${left}px`;
  box.style.top = `${ar.bottom - er.top + 4}px`;
  items[0]?.focus({ preventScroll: true });
}

document.addEventListener('pointerdown', (e) => {
  if (menu && !menu.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('[data-element="flag"]')) closeMenu(false);
});

// ── Replace and Ignore (REQ-011, REQ-012) ───────────────────────────────────────────────────────

/** Focus stays in place: the next highlight, or the box at the word (ROW-129). */
function focusAfter(index: number, caret: number): void {
  const next = marks.querySelectorAll<HTMLElement>('[data-element="flag"]')[index];
  if (next) next.focus({ preventScroll: true });
  else {
    offer.focus({ preventScroll: true });
    offer.setSelectionRange(caret, caret);
  }
}

function replace(f: Flag, suggestion: string): void {
  // A menu from an older text can never write (REQ-013, ROW-026).
  if (checkedText === null || !flags.includes(f) || offer.value.slice(f.start, f.end) !== f.word) {
    closeMenu(false);
    return;
  }
  const index = flags.indexOf(f);
  const scroll = window.scrollY;
  programmatic = true;
  try {
    offer.focus({ preventScroll: true });
    offer.setSelectionRange(f.start, f.end);
    // insertText keeps the browser's own undo (REQ-045); setRangeText where it is not supported.
    const done = typeof document.execCommand === 'function' && document.execCommand('insertText', false, suggestion);
    if (!done || offer.value.slice(f.start, f.start + suggestion.length) !== suggestion) {
      offer.setRangeText(suggestion, f.start, f.end, 'end');
    }
  } finally {
    programmatic = false;
  }
  const delta = suggestion.length - (f.end - f.start);
  flags = flags.filter((x) => x !== f).map((x) => (x.start >= f.end ? { ...x, start: x.start + delta, end: x.end + delta } : x));
  checkedText = offer.value;
  fitBox();
  render();
  showCount(false);
  window.scrollTo({ top: scroll });
  focusAfter(index, f.start + suggestion.length);
}

function ignore(f: Flag): void {
  const index = flags.indexOf(f);
  if (index < 0) return closeMenu(false);
  flags = flags.filter((x) => x !== f);
  render();
  showCount(false);
  focusAfter(index, f.end);
}

// ── Typing clears the check (REQ-013) ───────────────────────────────────────────────────────────

offer.addEventListener('input', () => {
  fitBox();
  if (programmatic) return;
  if (checkedText !== null || menu) clearCheck();
  say('');
});

window.addEventListener('resize', () => fitBox());

// ── Check spelling (REQ-001, REQ-002, REQ-021, REQ-022, REQ-025, REQ-026) ───────────────────────

checkButton.addEventListener('click', async () => {
  if (inFlight) return; // ROW-118: one request per press, even on a double tap
  const text = offer.value;
  if (text.trim() === '') {
    clearCheck();
    say('Escribe o pega el texto de una oferta para revisarla.', true);
    offer.focus();
    return;
  }
  inFlight = true;
  checkButton.disabled = true;
  checkButton.setAttribute('aria-busy', 'true');
  say('Revisando…');
  closeMenu(false);
  try {
    let response: Response;
    try {
      response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
        cache: 'no-store',
        credentials: 'same-origin',
      });
    } catch {
      say('No se pudo revisar el texto. Inténtalo de nuevo en un momento.', true);
      return;
    }
    // A result for a text the writer has since changed is discarded (ROW-119).
    if (offer.value !== text) {
      say('');
      return;
    }
    if (response.status === 413) {
      say(`El texto tiene ${graphemes(text).toLocaleString('es-ES')} caracteres y el máximo es 10.000. Acórtalo y vuelve a revisarlo.`, true);
      return;
    }
    if (response.status === 429) {
      say('Has hecho muchas revisiones en poco tiempo. Espera un momento y vuelve a intentarlo.', true);
      return;
    }
    let result: { flagged?: Flag[] } | null = null;
    try {
      result = response.ok ? ((await response.json()) as { flagged?: Flag[] }) : null;
    } catch {
      result = null;
    }
    if (!result || !Array.isArray(result.flagged)) {
      say('No se pudo revisar el texto. Inténtalo de nuevo en un momento.', true);
      return;
    }
    if (offer.value !== text) {
      say('');
      return;
    }
    flags = result.flagged
      .filter((f) => text.slice(f.start, f.end) === f.word)
      .map((f) => ({ start: f.start, end: f.end, word: f.word, suggestions: (f.suggestions ?? []).slice(0, 5) }))
      .sort((a, b) => a.start - b.start);
    checkedText = text;
    fitBox();
    render();
    showCount(flags.length === 0);
    say(flags.length === 0 ? '' : 'Haz clic en una palabra marcada para ver sugerencias.');
  } finally {
    inFlight = false;
    checkButton.disabled = false;
    checkButton.removeAttribute('aria-busy');
  }
});

// ── Copy text (REQ-015, REQ-016) ────────────────────────────────────────────────────────────────

copyButton.addEventListener('click', async () => {
  const text = offer.value;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
    await navigator.clipboard.writeText(text);
    say('Texto copiado al portapapeles.');
  } catch {
    offer.focus({ preventScroll: true });
    offer.select();
    // The async clipboard needs a secure page (HTTPS or localhost); the older copy command still works
    // inside the click on a plain-HTTP address.
    let copied = false;
    try {
      copied = typeof document.execCommand === 'function' && document.execCommand('copy');
    } catch {
      copied = false;
    }
    if (copied) {
      offer.setSelectionRange(offer.value.length, offer.value.length);
      say('Texto copiado al portapapeles.');
      return;
    }
    const touch = navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches;
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    if (touch) say('No se pudo acceder al portapapeles. Mantén pulsado el texto y elige Copiar.', true);
    else say(`No se pudo acceder al portapapeles. El texto está seleccionado: pulsa ${mac ? 'Cmd+C' : 'Ctrl+C'}.`, true);
  }
});

// ── Leaving with text in the box asks first (REQ-043) ───────────────────────────────────────────

window.addEventListener('beforeunload', (e) => {
  if (offer.value === '') return;
  e.preventDefault();
  e.returnValue = '';
});

fitBox();
