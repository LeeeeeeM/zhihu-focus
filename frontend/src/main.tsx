import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import 'antd/dist/reset.css';
import { zhihuAntdTheme } from './config/antdTheme';
import App from './pages/App';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={zhihuAntdTheme}>
      <BrowserRouter><App/></BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
);
