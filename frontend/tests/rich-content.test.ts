import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createRichContentSanitizer } from '../src/services/richContent';
import { autoLoadStorageKey, imageDisplayModeStorageKey, legacyFeedAutoLoadStorageKey, legacySearchAutoLoadStorageKey, legacyShowImagesStorageKey, minimalModeStorageKey, readAutoLoadPreference, readImageDisplayMode, readMinimalMode, saveAutoLoadPreference, saveImageDisplayMode, saveMinimalMode } from '../src/services/readingPreferences';

function render(html: string) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const sanitize = createRichContentSanitizer(dom.window as unknown as typeof window);
  const container = dom.window.document.createElement('div');
  container.innerHTML = sanitize(html);
  return container;
}

test('keeps Zhihu lazy images and links in their original order', () => {
  const result = render('<p>正文 <a href="https://example.com/source?q=1">来源</a></p><figure><img src="data:image/gif;base64,R0lGODlh" data-actualsrc="https://pic.zhimg.com/example.jpg" alt="配图"><figcaption>说明</figcaption></figure>');
  const image = result.querySelector('img');
  const link = result.querySelector('a');
  assert.equal(image?.getAttribute('src'), 'https://pic.zhimg.com/example.jpg');
  assert.equal(image?.getAttribute('alt'), '配图');
  assert.equal(image?.getAttribute('referrerpolicy'), 'no-referrer');
  assert.equal(link?.getAttribute('href'), 'https://example.com/source?q=1');
  assert.equal(link?.getAttribute('target'), '_blank');
  assert.equal(link?.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(result.querySelector('figcaption')?.textContent, '说明');
});

test('allows safe fallback and relative addresses', () => {
  const result = render('<img data-original="//pic.zhimg.com/original.jpg"><a href="/question/123">问题</a>');
  assert.equal(result.querySelector('img')?.getAttribute('src'), 'https://pic.zhimg.com/original.jpg');
  assert.equal(result.querySelector('a')?.getAttribute('href'), 'https://www.zhihu.com/question/123');
});

test('removes scripts, event handlers, and unsafe image and link addresses', () => {
  const result = render('<script>alert(1)</script><iframe src="https://example.com"></iframe><img data-actualsrc="javascript:alert(1)" onerror="alert(1)"><a href="javascript:alert(1)" onclick="alert(1)">文本</a>');
  assert.equal(result.querySelector('script, iframe'), null);
  assert.equal(result.querySelector('img')?.hasAttribute('src'), false);
  assert.equal(result.querySelector('img')?.hasAttribute('onerror'), false);
  assert.equal(result.querySelector('a')?.hasAttribute('href'), false);
  assert.equal(result.querySelector('a')?.hasAttribute('onclick'), false);
  assert.equal(result.querySelector('a')?.textContent, '文本');
});

test('supports image placeholders, hiding, and restoring images while keeping text and links', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const sanitize = createRichContentSanitizer(dom.window as unknown as typeof window);
  const html = '<p>正文 <a href="https://example.com/article">原文</a></p><img data-actualsrc="https://pic.zhimg.com/example.jpg">';
  const container = dom.window.document.createElement('div');
  container.innerHTML = sanitize(html, 'placeholder');
  assert.equal(container.querySelector('img'), null);
  assert.equal(container.querySelector('.image-placeholder')?.textContent, '图片');
  assert.equal(container.querySelector('.image-placeholder')?.getAttribute('role'), 'img');
  assert.equal(container.querySelector('a')?.getAttribute('href'), 'https://example.com/article');
  container.innerHTML = sanitize(html, 'hide');
  assert.equal(container.querySelector('img'), null);
  assert.equal(container.querySelector('.image-placeholder'), null);
  assert.equal(container.querySelector('a')?.getAttribute('href'), 'https://example.com/article');
  assert.match(container.textContent || '', /正文/);
  container.innerHTML = sanitize(html, 'show');
  assert.equal(container.querySelector('img')?.getAttribute('src'), 'https://pic.zhimg.com/example.jpg');
});

test('image mode persists and preserves the previous switch preference', () => {
  const dom = new JSDOM('', { url: 'https://example.com' });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  try {
    assert.equal(readImageDisplayMode(), 'show');
    dom.window.localStorage.setItem(legacyShowImagesStorageKey, 'false');
    assert.equal(readImageDisplayMode(), 'hide');
    saveImageDisplayMode('placeholder');
    assert.equal(dom.window.localStorage.getItem(imageDisplayModeStorageKey), 'placeholder');
    assert.equal(readImageDisplayMode(), 'placeholder');
    saveImageDisplayMode('show');
    assert.equal(readImageDisplayMode(), 'show');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
    dom.window.close();
  }
});

test('shared auto-load preference migrates previous choices and persists', () => {
  const dom = new JSDOM('', { url: 'https://example.com' });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  try {
    assert.equal(readAutoLoadPreference(), false);
    dom.window.localStorage.setItem(legacySearchAutoLoadStorageKey, 'true');
    assert.equal(readAutoLoadPreference(), true);
    dom.window.localStorage.setItem(legacyFeedAutoLoadStorageKey, 'false');
    assert.equal(readAutoLoadPreference(), false);
    saveAutoLoadPreference(true);
    assert.equal(dom.window.localStorage.getItem(autoLoadStorageKey), 'true');
    assert.equal(readAutoLoadPreference(), true);
    saveAutoLoadPreference(false);
    assert.equal(readAutoLoadPreference(), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
    dom.window.close();
  }
});

test('minimal mode defaults to off and persists when changed', () => {
  const dom = new JSDOM('', { url: 'https://example.com' });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  try {
    assert.equal(readMinimalMode(), false);
    saveMinimalMode(true);
    assert.equal(dom.window.localStorage.getItem(minimalModeStorageKey), 'true');
    assert.equal(readMinimalMode(), true);
    saveMinimalMode(false);
    assert.equal(readMinimalMode(), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
    dom.window.close();
  }
});
