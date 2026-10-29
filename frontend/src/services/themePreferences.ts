export const defaultThemeColor = '#315f4b';
export const themeColorStorageKey = 'zhihu-focus-theme-color';

export const themePresets = [
  { name: '松绿', color: '#315f4b' },
  { name: '海蓝', color: '#356687' },
  { name: '石墨', color: '#4f5c6b' },
  { name: '暖棕', color: '#8a5b43' },
  { name: '暮紫', color: '#705a83' },
  { name: '莓红', color: '#925566' },
] as const;

export function normalizeThemeColor(value: string | null | undefined): string {
  if (!value) return defaultThemeColor;
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) return `#${[...hex.slice(1)].map(ch => ch + ch).join('')}`;
  return defaultThemeColor;
}

export function readThemeColor(): string {
  try { return normalizeThemeColor(window.localStorage.getItem(themeColorStorageKey)); } catch { return defaultThemeColor; }
}

export function saveThemeColor(color: string): void {
  try { window.localStorage.setItem(themeColorStorageKey, normalizeThemeColor(color)); } catch { /* Storage is optional. */ }
}

function rgb(color: string): number[] {
  return [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
}

function mix(color: string, target: string, amount: number): string {
  const destination = rgb(target);
  return `#${rgb(color).map((channel, index) => Math.round(channel * (1 - amount) + destination[index] * amount).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

export function createThemePalette(value: string) {
  const primary = normalizeThemeColor(value);
  const surface = mix(primary, '#ffffff', 0.92);
  const onPrimary = contrastRatio(primary, '#ffffff') >= 4.5 ? '#ffffff' : '#000000';
  const hoverTarget = onPrimary === '#ffffff' ? '#000000' : '#ffffff';
  let text = primary;
  for (let step = 0; step <= 20 && contrastRatio(text, surface) < 4.5; step += 1) {
    text = mix(primary, '#000000', (step + 1) / 20);
  }
  return {
    primary, text, onPrimary, surface,
    soft: mix(primary, '#ffffff', 0.95),
    border: mix(primary, '#ffffff', 0.65),
    hover: mix(primary, hoverTarget, 0.12),
    active: mix(primary, hoverTarget, 0.22),
  };
}
