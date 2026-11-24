// Purpose: the page preferences on both pages (REQ-046 to REQ-049): applies the remembered page
// language and theme before the first paint (loaded in <head>, not deferred), wires the language
// selector and the theme switch, and keeps those two choices — only they, each only when its own
// control is used — in this browser's local storage. Never a cookie, never sent anywhere.

type Lang = 'en' | 'es';
type Theme = 'light' | 'dark';

const LANG_KEY = 'revisor.lang';
const THEME_KEY = 'revisor.theme';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage refused: nothing is remembered
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage refused or full: the choice lasts for this visit only
  }
}

const asLang = (v: string | null): Lang => (v === 'es' ? 'es' : 'en'); // REQ-047: English by default
const asTheme = (v: string | null): Theme | null => (v === 'light' || v === 'dark' ? v : null);

const root = document.documentElement;
const device = window.matchMedia('(prefers-color-scheme: dark)');
let lang: Lang = asLang(read(LANG_KEY));
let theme: Theme | null = asTheme(read(THEME_KEY)); // null: follow the device (REQ-048)

const TITLES: Record<string, Record<Lang, string>> = {
  checker: { en: 'Job offer spell checker', es: 'Revisor ortográfico de ofertas' },
  privacy: { en: 'Privacy notice — Job offer spell checker', es: 'Aviso de privacidad — Revisor ortográfico de ofertas' },
};
const GROUP_LABEL: Record<Lang, string> = { en: 'Page language', es: 'Idioma de la página' };

const shownTheme = (): Theme => theme ?? (device.matches ? 'dark' : 'light');

function apply(): void {
  root.lang = lang;
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  const title = TITLES[root.dataset.page ?? ''];
  if (title) document.title = title[lang];
  for (const el of document.querySelectorAll<HTMLElement>('[data-placeholder-en]')) {
    el.setAttribute('placeholder', el.dataset[lang === 'en' ? 'placeholderEn' : 'placeholderEs'] ?? '');
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-set-lang]')) {
    b.setAttribute('aria-pressed', String(b.dataset.setLang === lang));
  }
  document.querySelector('[data-element="language"]')?.setAttribute('aria-label', GROUP_LABEL[lang]);
  // The switch is named "Dark theme" in both themes; pressed exactly when dark is shown.
  document.querySelector('[data-element="theme"]')?.setAttribute('aria-pressed', String(shownTheme() === 'dark'));
  document.dispatchEvent(new CustomEvent('revisor:prefs', { detail: { lang } }));
}

function reread(): void {
  lang = asLang(read(LANG_KEY));
  theme = asTheme(read(THEME_KEY));
  apply();
}

apply(); // before the body is parsed: the root's language, theme and the title, with no flash

document.addEventListener('DOMContentLoaded', apply);

document.addEventListener('click', (e) => {
  const control = (e.target as Element).closest<HTMLElement>('[data-set-lang], [data-element="theme"]');
  if (!control) return;
  if (control.dataset.setLang) {
    const picked = asLang(control.dataset.setLang);
    if (picked === lang) return;
    lang = picked;
    write(LANG_KEY, lang);
  } else {
    theme = shownTheme() === 'dark' ? 'light' : 'dark';
    write(THEME_KEY, theme);
  }
  apply();
});

device.addEventListener('change', apply); // with no theme chosen the page follows the device at once
window.addEventListener('storage', (e) => {
  if (e.key === LANG_KEY || e.key === THEME_KEY) reread();
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) reread(); // Back or Forward from a page where the choice changed
});

export {}; // a module of its own: its names never meet main.ts's
