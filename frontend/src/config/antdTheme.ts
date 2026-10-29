import type { ThemeConfig } from 'antd';

// Keep Ant Design controls on the same moss-green and warm-neutral palette as the reader UI.
export const zhihuAntdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#315f4b',
    colorInfo: '#315f4b',
    colorLink: '#66806b',
    colorLinkHover: '#315f4b',
    colorLinkActive: '#254a3a',
    colorBgLayout: '#f8f8f6',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorText: '#30342e',
    colorTextSecondary: '#858a82',
    colorTextPlaceholder: '#aeb1aa',
    colorBorder: '#e7e8e2',
    colorBorderSecondary: '#ecece8',
    colorFillSecondary: '#f1f2ee',
    controlOutline: 'rgba(49, 95, 75, 0.16)',
    borderRadius: 8,
    fontFamily: "'DM Sans', 'Noto Sans SC', sans-serif",
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    Input: {
      activeBorderColor: '#78927b',
      hoverBorderColor: '#a4b1a0',
      activeShadow: '0 0 0 2px rgba(49, 95, 75, 0.12)',
    },
  },
};
