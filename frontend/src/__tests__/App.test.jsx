import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App.jsx';
import { renderWithProviders, resetMocks } from './test-utils.jsx';

// Mock main-content to avoid heavy DOM mounts and to observe calls
vi.mock('../main-content', () => ({
  renderPodsMainContent: vi.fn(),
  renderResourceMainContent: vi.fn(),
}));

describe('App (smoke)', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('renders App layout and sidebar toggle', () => {
    const { container } = renderWithProviders(<App />);
    // AppLayout contains #sidebar-toggle button
    const toggle = container.querySelector('#sidebar-toggle');
    expect(toggle).toBeTruthy();
    // maincontent should exist
    const main = container.querySelector('#maincontent');
    expect(main).toBeTruthy();
  });
});
