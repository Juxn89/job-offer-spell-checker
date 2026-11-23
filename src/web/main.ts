// Purpose: the checker page's client script (`@revisor/web` bundle entry): sends the box's text to
// the check endpoint and shows the result.
//
// Skeleton state (golden-path example, REQ-001): Check spelling really posts the text to
// /api/check and writes what came back into the count line; highlights, suggestions, Replace,
// Ignore, Copy text and every message are built by their steps.

const offer = document.querySelector<HTMLTextAreaElement>('[data-element="offer"]');
const checkButton = document.querySelector<HTMLButtonElement>('[data-element="check"]');
const count = document.querySelector<HTMLElement>('[data-element="count"]');

// REQ-001: Check spelling sends the offer's text to our own server only.
checkButton?.addEventListener('click', async () => {
  if (!offer || !count) return;
  const response = await fetch('/api/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: offer.value }),
  });
  const result = (await response.json()) as { flagged?: unknown[] };
  count.textContent = String(result.flagged?.length ?? 0);
});
