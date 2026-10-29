import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { UserAvatar } from '../src/components/UserAvatar';
import { readHideUserAvatars, saveHideUserAvatars, hideUserAvatarsStorageKey } from '../src/services/readingPreferences';
import { useZhihuStore } from '../src/store/useZhihuStore';

test('hidden avatars render 知 without an image source and can be restored', () => {
  const src = 'https://example.com/avatar.jpg';
  // Server rendering reads Zustand's initial snapshot through useSyncExternalStore.
  const initial = useZhihuStore.getInitialState();
  const previous = initial.hideUserAvatars;
  try {
    initial.hideUserAvatars = true;
    const hidden = renderToStaticMarkup(<UserAvatar src={src} name="作者" size={28}/>);
    assert.match(hidden, /知/);
    assert.match(hidden, /font-size:13px/);
    assert.doesNotMatch(hidden, /example\.com|<img/);
    initial.hideUserAvatars = false;
    const visible = renderToStaticMarkup(<UserAvatar src={src} name="作者" size={28}/>);
    assert.match(visible, /example\.com\/avatar\.jpg/);
    const noImage = renderToStaticMarkup(<UserAvatar src="" name="作者" size={28}/>);
    assert.doesNotMatch(noImage, /<img|src=""/);
    assert.match(noImage, /font-size:13px/);
  } finally { initial.hideUserAvatars = previous; }
});

test('avatar preference is off by default and persists', () => {
  const dom = new JSDOM('', { url: 'https://example.com' });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  try {
    assert.equal(readHideUserAvatars(), false);
    saveHideUserAvatars(true);
    assert.equal(dom.window.localStorage.getItem(hideUserAvatarsStorageKey), 'true');
    assert.equal(readHideUserAvatars(), true);
    saveHideUserAvatars(false);
    assert.equal(readHideUserAvatars(), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
    dom.window.close();
  }
});
