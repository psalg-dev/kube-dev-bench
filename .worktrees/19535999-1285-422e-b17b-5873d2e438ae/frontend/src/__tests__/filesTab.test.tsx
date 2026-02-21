import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FilesTab from '../layout/bottompanel/FilesTab';

vi.mock('../../wailsjs/go/main/App', () => ({
  ListPVCFiles: vi.fn(),
  GetPVCFileContent: vi.fn(),
  ArchivePVCPath: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
const listFilesMock = vi.mocked(AppAPI.ListPVCFiles);

// CodeMirror uses DOM APIs not available in jsdom - mock it
vi.mock('@codemirror/view', () => ({
  EditorView: class {
    static theme = vi.fn().mockReturnValue({});
    static lineWrapping = {};
    static editable = { of: vi.fn().mockReturnValue({}) };
    dispatch = vi.fn();
    destroy = vi.fn();
    get state() { return { doc: { length: 0 } }; }
    constructor() {}
  },
  keymap: { of: vi.fn().mockReturnValue({}) },
  lineNumbers: vi.fn().mockReturnValue({}),
  highlightActiveLineGutter: vi.fn().mockReturnValue({}),
}));

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: vi.fn().mockReturnValue({}),
    readOnly: { of: vi.fn().mockReturnValue({}) },
  },
  Compartment: class {
    of = vi.fn().mockReturnValue({});
    reconfigure = vi.fn().mockReturnValue({});
  },
}));

vi.mock('@codemirror/language', () => ({
  foldGutter: vi.fn().mockReturnValue({}),
  foldKeymap: [],
  defaultHighlightStyle: {},
  syntaxHighlighting: vi.fn().mockReturnValue({}),
}));

vi.mock('@codemirror/lang-yaml', () => ({
  yaml: vi.fn().mockReturnValue({}),
}));

describe('FilesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty directory message when no files returned', async () => {
    listFilesMock.mockResolvedValue([]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText(/Empty directory or not accessible/i)).toBeInTheDocument();
    });
  });

  it('renders column headers', async () => {
    listFilesMock.mockResolvedValue([]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Perms')).toBeInTheDocument();
    });
  });

  it('shows Files label in header', async () => {
    listFilesMock.mockResolvedValue([]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('Files')).toBeInTheDocument();
    });
  });

  it('renders file entries when returned', async () => {
    listFilesMock.mockResolvedValue([
      { path: '/etc/config.yaml', name: 'config.yaml', isDir: false, mode: '-rw-r--r--', size: 1024, modified: '2024-01-01T00:00:00Z' },
    ]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('config.yaml')).toBeInTheDocument();
    });
  });

  it('renders directory entries', async () => {
    listFilesMock.mockResolvedValue([
      { path: '/etc', name: 'etc', isDir: true, mode: 'drwxr-xr-x', size: 0, modified: '2024-01-01T00:00:00Z' },
    ]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('etc')).toBeInTheDocument();
    });
  });

  it('shows download button', async () => {
    listFilesMock.mockResolvedValue([]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download Dir/i })).toBeInTheDocument();
    });
  });

  it('renders file select prompt when no file selected', async () => {
    listFilesMock.mockResolvedValue([]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText(/Select a file to preview/i)).toBeInTheDocument();
    });
  });
});
