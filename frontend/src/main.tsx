import React, { useLayoutEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import 'antd/dist/reset.css';
import { createAntdTheme } from './config/antdTheme';
import { createThemePalette } from './services/themePreferences';
import { useZhihuStore } from './store/useZhihuStore';
import App from './pages/App';
import './style.css';

function ThemedApp() {
  const color = useZhihuStore(state => state.themeColor);
  const palette = useMemo(() => createThemePalette(color), [color]);
  const theme = useMemo(() => createAntdTheme(color), [color]);
  useLayoutEffect(() => {
    for (const [key, value] of Object.entries(palette)) document.documentElement.style.setProperty(`--theme-${key}`, value);
  }, [palette]);
  return <ConfigProvider theme={theme}><BrowserRouter><App/></BrowserRouter></ConfigProvider>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemedApp/></React.StrictMode>);
