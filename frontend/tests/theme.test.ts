import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { contrastRatio, createThemePalette, defaultThemeColor, normalizeThemeColor, readThemeColor, saveThemeColor } from '../src/services/themePreferences';

test('theme colors provide readable text for light and dark choices', () => {
  for (const color of ['#315f4b', '#ffffff', '#000000', '#ffff00', '#ff0000', '#777777', '#7c3aed']) {
    const palette = createThemePalette(color);
    assert.ok(contrastRatio(palette.primary, palette.onPrimary) >= 4.5, `button contrast for ${color}`);
    assert.ok(contrastRatio(palette.surface, palette.text) >= 4.5, `accent text contrast for ${color}`);
  }
  assert.equal(normalizeThemeColor('#ABC'), '#aabbcc');
  assert.equal(normalizeThemeColor('invalid'), defaultThemeColor);
});

test('theme preference persists in browser storage', () => {
  const dom = new JSDOM('', { url: 'https://example.com' });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  try {
    assert.equal(readThemeColor(), defaultThemeColor);
    saveThemeColor('#abc');
    assert.equal(readThemeColor(), '#aabbcc');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
    dom.window.close();
  }
});
