import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@codemirror/view', () => {
  const dispatchSpy = vi.fn();
  let ctorCount = 0;
  type EditorStateLike = { doc?: string; extensions?: unknown; length?: number };
  class MockEditorView {
    static theme() {
      return {};
    }
    static editable = { of: () => ({}) };
    static lineWrapping = {};
    state: EditorStateLike;
    destroy: () => void;
    _dispatchSpy: (tr: unknown) => void;
    constructor({ state }: { state: EditorStateLike }) {
      ctorCount++;
      this.state = state;
      this.destroy = vi.fn();
      this._dispatchSpy = dispatchSpy;
    }
    dispatch(tr: unknown) {
      this._dispatchSpy(tr);
    }
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
    create: (cfg: { doc?: string; extensions?: unknown }) => ({
      doc: cfg.doc,
      extensions: cfg.extensions,
      length: (cfg.doc || '').length,
    }),
    readOnly: { of: () => ({}) },
    allowMultipleSelections: { of: () => ({}) },
  },
}));
vi.mock('@codemirror/lang-yaml', () => ({ yaml: () => ({}) }));
vi.mock('@codemirror/language', () => ({
  foldGutter: () => ({}),
  foldKeymap: [],
  syntaxHighlighting: () => ({}),
  defaultHighlightStyle: {},
}));

import YamlTab from '../layout/bottompanel/YamlTab';
import * as View from '@codemirror/view';

const { __dispatchSpy: dispatchSpy, __getCtorCount: getCtorCount } = View as unknown as {
  __dispatchSpy: ReturnType<typeof vi.fn>;
  __getCtorCount: () => number;
};

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

  it('updates editor content on content change (no recreate)', () => {
    const { rerender } = render(<YamlTab content="kind: Pod" />);
    const firstCtor = getCtorCount();
    rerender(<YamlTab content="kind: Deployment" />);
    expect(getCtorCount()).toBe(firstCtor);
    expect(dispatchSpy).toHaveBeenCalled();
  });
});

