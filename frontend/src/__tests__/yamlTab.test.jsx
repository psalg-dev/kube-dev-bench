import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Hoisted-safe mocks: define everything inside factory & export spies
vi.mock('@codemirror/view', () => {
  const dispatchSpy = vi.fn();
  let ctorCount = 0;
  class MockEditorView {
    static theme() { return {}; }
    static editable = { of: () => ({}) };
    static lineWrapping = {}; // placeholder
    constructor({ state }) { ctorCount++; this.state = state; this.destroy = vi.fn(); this._dispatchSpy = dispatchSpy; }
    dispatch(tr) { this._dispatchSpy(tr); }
  }
  return {
    EditorView: MockEditorView,
    lineNumbers: () => ({}),
    highlightActiveLineGutter: () => ({}),
    keymap: { of: () => ({}) },
    __dispatchSpy: dispatchSpy,
    __getCtorCount: () => ctorCount,
  };
});

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: (cfg) => ({ doc: cfg.doc, extensions: cfg.extensions, length: (cfg.doc || '').length }),
    readOnly: { of: () => ({}) },
    allowMultipleSelections: { of: () => ({}) }
  }
}));
vi.mock('@codemirror/lang-yaml', () => ({ yaml: () => ({}) }));
vi.mock('@codemirror/language', () => ({
  foldGutter: () => ({}),
  foldKeymap: [],
  syntaxHighlighting: () => ({}),
  defaultHighlightStyle: {},
}));

import YamlTab from '../layout/bottompanel/YamlTab.jsx';
import { __dispatchSpy as dispatchSpy, __getCtorCount as getCtorCount } from '@codemirror/view';

beforeEach(() => {
  dispatchSpy.mockClear();
});

describe('YamlTab', () => {
  it('shows loading state', () => {
    const { getByText } = render(<YamlTab loading content="" />);
    expect(getByText(/loading yaml/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    const { getByText } = render(<YamlTab error="Boom" />);
    expect(getByText('Error loading YAML:')).toBeInTheDocument();
    expect(getByText('Boom')).toBeInTheDocument();
  });

  it('creates editor with initial content', () => {
    const before = getCtorCount();
    render(<YamlTab content="apiVersion: v1" />);
    expect(getCtorCount()).toBe(before + 1);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('recreates editor on content change (current implementation)', () => {
    render(<YamlTab content="kind: Pod" />);
    const firstCtor = getCtorCount();
    render(<YamlTab content="kind: Deployment" />);
    expect(getCtorCount()).toBe(firstCtor + 1); // recreated instead of dispatch
  });
});
