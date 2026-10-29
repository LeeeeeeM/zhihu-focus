import type { ThemeConfig } from 'antd';
import { createThemePalette } from '../services/themePreferences';

export function createAntdTheme(color: string): ThemeConfig {
  const palette = createThemePalette(color);
  return {
  token: {
    colorPrimary: palette.primary,
    colorInfo: palette.primary,
    colorLink: palette.text,
    colorLinkHover: palette.text,
    colorLinkActive: palette.text,
    colorTextLightSolid: palette.onPrimary,
    colorBgLayout: '#f8f8f6',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorText: '#30342e',
    colorTextSecondary: '#858a82',
    colorTextPlaceholder: '#aeb1aa',
    colorBorder: '#e7e8e2',
    colorBorderSecondary: '#ecece8',
    colorFillSecondary: '#f1f2ee',
    controlOutline: `${palette.primary}29`,
    borderRadius: 8,
    fontFamily: "'DM Sans', 'Noto Sans SC', sans-serif",
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    Input: {
      activeBorderColor: palette.border,
      hoverBorderColor: palette.border,
      activeShadow: `0 0 0 2px ${palette.primary}1f`,
    },
  },
  };
}
