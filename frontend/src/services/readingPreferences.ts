export type ImageDisplayMode = 'show' | 'placeholder' | 'hide';

export const imageDisplayModeStorageKey = 'zhihu-focus-image-display-mode';
export const legacyShowImagesStorageKey = 'zhihu-focus-show-images';
export const autoLoadStorageKey = 'zhihu-focus-global-auto-load';
export const legacyFeedAutoLoadStorageKey = 'zhihu-focus-auto-load';
export const legacySearchAutoLoadStorageKey = 'zhihu-focus-search-auto-load';
export const hideUserAvatarsStorageKey = 'zhihu-focus-hide-user-avatars';
export const minimalModeStorageKey = 'zhihu-focus-minimal-mode';

export function readMinimalMode(): boolean {
  try { return window.localStorage.getItem(minimalModeStorageKey) === 'true'; } catch { return false; }
}

export function saveMinimalMode(enabled: boolean): void {
  try { window.localStorage.setItem(minimalModeStorageKey, String(enabled)); } catch { /* Storage is optional. */ }
}

export function readHideUserAvatars(): boolean {
  try { return window.localStorage.getItem(hideUserAvatarsStorageKey) === 'true'; } catch { return false; }
}

export function saveHideUserAvatars(hidden: boolean): void {
  try { window.localStorage.setItem(hideUserAvatarsStorageKey, String(hidden)); } catch { /* Storage is optional. */ }
}

export function readAutoLoadPreference(): boolean {
  try {
    const saved = window.localStorage.getItem(autoLoadStorageKey);
    if (saved === 'true' || saved === 'false') return saved === 'true';
    const previous = window.localStorage.getItem(legacyFeedAutoLoadStorageKey) ?? window.localStorage.getItem(legacySearchAutoLoadStorageKey);
    return previous === 'true';
  } catch { return false; }
}

export function saveAutoLoadPreference(enabled: boolean): void {
  try { window.localStorage.setItem(autoLoadStorageKey, String(enabled)); } catch { /* Storage is optional. */ }
}

export function readImageDisplayMode(): ImageDisplayMode {
  try {
    const mode = window.localStorage.getItem(imageDisplayModeStorageKey);
    if (mode === 'show' || mode === 'placeholder' || mode === 'hide') return mode;
    return window.localStorage.getItem(legacyShowImagesStorageKey) === 'false' ? 'hide' : 'show';
  } catch { return 'show'; }
}

export function saveImageDisplayMode(mode: ImageDisplayMode): void {
  try { window.localStorage.setItem(imageDisplayModeStorageKey, mode); } catch { /* Storage is optional. */ }
}
