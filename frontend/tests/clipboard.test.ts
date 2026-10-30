import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { copyTextToClipboard } from '../src/services/clipboard';

test('copies through the Clipboard API', async () => {
  const dom = new JSDOM('');
  const copied: string[] = [];
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async (value: string) => { copied.push(value); } } });
  assert.equal(await copyTextToClipboard('saved-cookie-fixture', dom.window as unknown as typeof window), true);
  assert.deepEqual(copied, ['saved-cookie-fixture']);
  dom.window.close();
});

test('HTTP fallback copies saved text, cleans up and restores focus even on failure', async () => {
  const dom = new JSDOM('<button>复制 Cookie</button>', { url: 'http://localhost' });
  const button = dom.window.document.querySelector('button')!;
  button.focus();
  let shouldFail = false;
  Object.defineProperty(dom.window.document, 'execCommand', { value: (command: string) => {
    assert.equal(command, 'copy');
    assert.equal((dom.window.document.activeElement as HTMLTextAreaElement).value, 'saved-cookie-fixture');
    if (shouldFail) throw new Error('Denied');
    return true;
  } });
  const root = dom.window as unknown as typeof window;
  assert.equal(await copyTextToClipboard('saved-cookie-fixture', root), true);
  assert.equal(dom.window.document.querySelector('textarea'), null);
  assert.equal(dom.window.document.activeElement, button);
  shouldFail = true;
  assert.equal(await copyTextToClipboard('saved-cookie-fixture', root), false);
  assert.equal(dom.window.document.querySelector('textarea'), null);
  assert.equal(dom.window.document.activeElement, button);
  dom.window.close();
});

test('falls back after Clipboard API rejection and reports unavailable copy support', async () => {
  const dom = new JSDOM('');
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Denied'); } } });
  assert.equal(await copyTextToClipboard('saved-cookie-fixture', dom.window as unknown as typeof window), false);
  Object.defineProperty(dom.window.document, 'execCommand', { value: () => true });
  assert.equal(await copyTextToClipboard('saved-cookie-fixture', dom.window as unknown as typeof window), true);
  dom.window.close();
});
