import React from 'react';
import { createRoot } from 'react-dom/client';
import PodOverviewTable from './PodOverviewTable';
import './style.css';
import './app.css';

export function renderPodOverviewTable({ container, namespace }) {
  const root = createRoot(container);
  root.render(<PodOverviewTable namespace={namespace} />);
  return root;
}

