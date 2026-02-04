// Entry point: mounts React App with HashRouter for Wails best practices.
// See: https://wails.io/docs/guides/routing/
import './style.css';
import './app.css';
import './layout/footer.css';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import router from './router.jsx';

const el = document.getElementById('app');
const root = createRoot(el);
root.render(createElement(RouterProvider, { router }));
