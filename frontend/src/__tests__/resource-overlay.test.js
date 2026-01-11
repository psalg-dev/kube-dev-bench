import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal CodeMirror mocks so showResourceOverlay can be tested without real editor DOM complexity.
vi.mock('@codemirror/state', () => {
  const EditorState = {
    allowMultipleSelections: { of: vi.fn(() => ({})) },
    create: vi.fn((opts) => ({
      doc: { toString: () => opts?.doc ?? '' },
      _opts: opts,
    })),
  };
  return { EditorState };
});

vi.mock('@codemirror/view', () => {
  class EditorView {
    constructor({ state, parent }) {
      this.state = state;
      this.parent = parent;
    }
    destroy() {}
    static theme() {
      return {};
    }
  }

  return {
    EditorView,
    crosshairCursor: vi.fn(() => ({})),
    drawSelection: vi.fn(() => ({})),
    dropCursor: vi.fn(() => ({})),
    highlightActiveLine: vi.fn(() => ({})),
    highlightActiveLineGutter: vi.fn(() => ({})),
    highlightSpecialChars: vi.fn(() => ({})),
    keymap: { of: vi.fn(() => ({})) },
    lineNumbers: vi.fn(() => ({})),
    rectangularSelection: vi.fn(() => ({})),
  };
});

vi.mock('@codemirror/language', () => ({
  bracketMatching: vi.fn(() => ({})),
  defaultHighlightStyle: {},
  foldGutter: vi.fn(() => ({})),
  foldKeymap: [],
  indentOnInput: vi.fn(() => ({})),
  syntaxHighlighting: vi.fn(() => ({})),
}));

vi.mock('@codemirror/search', () => ({
  highlightSelectionMatches: vi.fn(() => ({})),
  searchKeymap: [],
}));

vi.mock('@codemirror/lang-yaml', () => ({ yaml: vi.fn(() => ({})) }));
vi.mock('@codemirror/autocomplete', () => ({ closeBracketsKeymap: [], completionKeymap: [] }));
vi.mock('@codemirror/commands', () => ({ defaultKeymap: [], history: vi.fn(() => ({})), historyKeymap: [] }));
vi.mock('@codemirror/lint', () => ({ lintKeymap: [] }));

import { createResourceMock } from './wailsMocks.js';

const notifications = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));
vi.mock('../notification', () => notifications);

async function importOverlay() {
  vi.resetModules();
  return await import('../resource-overlay.js');
}

beforeEach(() => {
  document.body.innerHTML = '';
  createResourceMock.mockReset();
  notifications.showSuccess.mockReset();
  notifications.showError.mockReset();
});

describe('resource-overlay.js', () => {
  it('does nothing for unknown resource type', () => {
    // sync path is fine, but keep consistent import timing
    const modPromise = importOverlay();
    return modPromise.then(({ showResourceOverlay }) => {
      showResourceOverlay('does-not-exist');
      expect(document.querySelector('.overlay')).toBeNull();
      expect(createResourceMock).not.toHaveBeenCalled();
    });
  });

  it('creates overlay and calls CreateResource on success', async () => {
    const { showResourceOverlay } = await importOverlay();
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    createResourceMock.mockResolvedValue(undefined);

    showResourceOverlay('deployment', { namespace: 'ns1', onSuccess, onClose });

    const overlay = document.querySelector('.overlay');
    expect(overlay).toBeTruthy();

    const createBtn = overlay.querySelector('.overlay-create-btn');
    expect(createBtn).toBeTruthy();
    expect(typeof createBtn.onclick).toBe('function');

    await createBtn.onclick();

    expect(createResourceMock).toHaveBeenCalledTimes(1);
    const [ns, yamlText] = createResourceMock.mock.calls[0];
    expect(ns).toBe('ns1');
    expect(String(yamlText)).toContain('kind: Deployment');

    expect(notifications.showSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    expect(document.querySelector('.overlay')).toBeNull();
  });

  it('shows error and keeps overlay when CreateResource fails', async () => {
    const { showResourceOverlay } = await importOverlay();
    const onError = vi.fn();

    createResourceMock.mockRejectedValue(new Error('boom'));

    showResourceOverlay('job', { namespace: 'default', onError });

    const overlay = document.querySelector('.overlay');
    const createBtn = overlay.querySelector('.overlay-create-btn');

    await createBtn.onclick();

    expect(notifications.showError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);

    // still present
    expect(document.querySelector('.overlay')).toBeTruthy();
    // button restored
    expect(createBtn.disabled).toBe(false);
    expect(createBtn.textContent).toBe('Create');
  });

  it('closes overlay via cancel button and overlay background click', () => {
    const modPromise = importOverlay();
    return modPromise.then(({ showResourceOverlay }) => {
    const onClose = vi.fn();

    showResourceOverlay('configmap', { onClose });

    let overlay = document.querySelector('.overlay');
    expect(overlay).toBeTruthy();

    // cancel button
    overlay.querySelector('.overlay-cancel-btn').onclick();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.overlay')).toBeNull();

    // reopen and click on background
    showResourceOverlay('secret', { onClose });
    overlay = document.querySelector('.overlay');
    overlay.onclick({ target: overlay });

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.overlay')).toBeNull();
    });
  });
});
