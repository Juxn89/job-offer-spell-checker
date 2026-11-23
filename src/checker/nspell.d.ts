// Purpose: the type declaration of the nspell spelling engine (it ships none), limited to what the
// checker calls.

declare module 'nspell' {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    spell(word: string): { correct: boolean; forbidden: boolean; warn: boolean };
    add(word: string, model?: string): NSpell;
    remove(word: string): NSpell;
    dictionary(dic: string | Uint8Array): NSpell;
    personal(dic: string | Uint8Array): NSpell;
    wordCharacters(): string | undefined;
  }
  function nspell(aff: string | Uint8Array, dic?: string | Uint8Array): NSpell;
  export default nspell;
}
