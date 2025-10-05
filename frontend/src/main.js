// Entry point: mounts React AppContainer. Restored after corruption.
import './style.css';
import './app.css';
import './layout/footer.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import AppContainer from './layout/AppContainer.jsx';

const el = document.getElementById('app');
const root = createRoot(el);
root.render(React.createElement(AppContainer));
