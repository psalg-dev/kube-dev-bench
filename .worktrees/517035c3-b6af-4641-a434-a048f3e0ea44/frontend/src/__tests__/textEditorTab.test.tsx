import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cmState = vi.hoisted(() => {
  const views: Array<{
    state: { doc: { toString: () => string } };
    dispatch: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];
  const updateListeners: Array<(update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => void> = [];
  return { views, updateListeners };
});

vi.mock('@codemirror/language', () => ({
  foldGutter: vi.fn(() => ({})),
  foldKeymap: [],
}));

vi.mock('@codemirror/state', () => ({
  Compartment: class {
    of(ext: unknown) {
      return ext;
    }
    reconfigure(ext: unknown) {
      return { reconfigure: ext };
    }
  },
  EditorState: {
    readOnly: { of: vi.fn(() => ({})) },
    create: vi.fn(({ doc }: { doc: string }) => ({ doc: { toString: () => doc || '' } })),
  },
}));

vi.mock('@codemirror/view', () => {
  class MockEditorView {
    static theme = vi.fn(() => ({}));
    static lineWrapping = {};
    static editable = { of: vi.fn(() => ({})) };
    static updateListener = {
      of: vi.fn((listener: (update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => void) => {
        cmState.updateListeners.push(listener);
        return { listener };
      }),
    };

    state: { doc: { toString: () => string } };
    dispatch: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;

    constructor({ state }: { state: { doc: { toString: () => string } } }) {
      this.state = state;
      this.dispatch = vi.fn((payload: { changes?: { from: number; to: number; insert: string } }) => {
        if (payload?.changes) {
          this.state.doc = { toString: () => payload.changes?.insert || '' };
        }
      });
      this.destroy = vi.fn();
      cmState.views.push(this);
    }
  }

  return {
    EditorView: MockEditorView,
    lineNumbers: vi.fn(() => ({})),
    highlightActiveLineGutter: vi.fn(() => ({})),
    keymap: { of: vi.fn(() => ({})) },
  };
});

vi.mock('../utils/codeMirrorLanguage', () => ({
  getCodeMirrorLanguageExtensions: vi.fn(() => []),
}));

import TextEditorTab from '../layout/bottompanel/TextEditorTab';

describe('TextEditorTab', () => {
  beforeEach(() => {
    cmState.views.length = 0;
    cmState.updateListeners.length = 0;
  });

  it('renders loading and error states', () => {
    const { rerender } = render(<TextEditorTab loading loadingLabel="Please wait" />);
    expect(screen.getByText('Please wait')).toBeInTheDocument();

    rerender(<TextEditorTab error="failed" />);
    expect(screen.getByText('Error:')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('creates editor, notifies on changes, reacts to content updates, and destroys on unmount', () => {
    const onChange = vi.fn();
    const { rerender, unmount } = render(<TextEditorTab filename="config.yaml" content="a: 1" onChange={onChange} />);

    const view = cmState.views.at(-1);
    expect(view).toBeDefined();

    const listener = cmState.updateListeners.at(-1);
    listener?.({ docChanged: true, state: { doc: { toString: () => 'a: 2' } } });
    expect(onChange).toHaveBeenCalledWith('a: 2');

    rerender(<TextEditorTab filename="config.yaml" content="a: 3" onChange={onChange} />);
    expect(view?.dispatch).toHaveBeenCalled();

    unmount();
    expect(view?.destroy).toHaveBeenCalled();
  });
});
