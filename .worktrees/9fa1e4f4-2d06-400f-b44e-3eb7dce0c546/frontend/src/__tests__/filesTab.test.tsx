import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock CodeMirror to avoid JSDOM issues with the editor
vi.mock('@codemirror/view', () => ({
  EditorView: class {
    static theme() { return {}; }
    static lineWrapping = {};
    static editable = { of: () => ({}) };
    state = { doc: { length: 0 } };
    destroy = vi.fn();
    dispatch = vi.fn();
    constructor() {}
  },
  keymap: { of: () => ({}) },
  lineNumbers: () => ({}),
  highlightActiveLineGutter: () => ({}),
}));
vi.mock('@codemirror/state', () => ({
  EditorState: { create: () => ({ doc: { length: 0 } }), readOnly: { of: () => ({}) } },
  Compartment: class { of() { return {}; } reconfigure() { return {}; } },
}));
vi.mock('@codemirror/language', () => ({
  foldGutter: () => ({}),
  foldKeymap: [],
  defaultHighlightStyle: {},
  syntaxHighlighting: () => ({}),
}));
vi.mock('@codemirror/lang-yaml', () => ({ yaml: () => ({}) }));

vi.mock('../../wailsjs/go/main/App', () => ({
  ListPVCFiles: vi.fn(),
  GetPVCFileContent: vi.fn(),
  ArchivePVCPath: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import FilesTab from '../layout/bottompanel/FilesTab';

const listPVCFilesMock = vi.mocked(AppAPI.ListPVCFiles);

const makeDir = (name: string, path = `/${name}`) => ({
  path,
  name,
  isDir: true,
  mode: 'drwxr-xr-x',
  size: 0,
  modified: '2024-01-01T00:00:00Z',
});

const makeFile = (name: string, path = `/${name}`, size = 1024) => ({
  path,
  name,
  isDir: false,
  mode: '-rw-r--r--',
  size,
  modified: '2024-01-02T00:00:00Z',
});

describe('FilesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching', async () => {
    listPVCFilesMock.mockImplementation(() => new Promise(() => {}));
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText(/Loading directory/i)).toBeInTheDocument();
    });
  });

  it('shows error when API fails', async () => {
    listPVCFilesMock.mockRejectedValue(new Error('permission denied'));
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
    });
  });

  it('shows empty directory message when no entries', async () => {
    listPVCFilesMock.mockResolvedValue([]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText(/Empty directory/i)).toBeInTheDocument();
    });
  });

  it('renders file entries', async () => {
    listPVCFilesMock.mockResolvedValue([makeFile('app.log')]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('app.log')).toBeInTheDocument();
    });
  });

  it('renders directory entries', async () => {
    listPVCFilesMock.mockResolvedValue([makeDir('config')]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('config')).toBeInTheDocument();
    });
  });

  it('directory entries render before file entries when names sort dirs first (sort order)', async () => {
    // dirs named 'a-dir', 'b-dir'; files named 'z-file.txt', 'y-file.txt'
    // default sort is by 'name' asc, so dirs come before files alphabetically
    const entries = [
      makeFile('z-file.txt', '/z-file.txt'),
      makeDir('a-dir', '/a-dir'),
      makeFile('y-file.txt', '/y-file.txt'),
      makeDir('b-dir', '/b-dir'),
    ];
    listPVCFilesMock.mockResolvedValue(entries);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('a-dir')).toBeInTheDocument();
    });
    const rows = document.querySelectorAll('tbody tr');
    const rowTexts = Array.from(rows).map(r => r.textContent || '');
    const aDirIdx = rowTexts.findIndex(t => t.includes('a-dir'));
    const zFileIdx = rowTexts.findIndex(t => t.includes('z-file.txt'));
    expect(aDirIdx).toBeLessThan(zFileIdx);
  });

  it('renders table headers: Name, Perms, Size, Modified', async () => {
    listPVCFilesMock.mockResolvedValue([makeFile('test.txt')]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Perms')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });
  });

  it('renders breadcrumb "root" for root path', async () => {
    listPVCFilesMock.mockResolvedValue([]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText('root')).toBeInTheDocument();
    });
  });

  it('shows download dir button', async () => {
    listPVCFilesMock.mockResolvedValue([]);
    render(<FilesTab namespace="default" pvcName="my-pvc" />);
    await waitFor(() => {
      expect(screen.getByText(/Download Dir/i)).toBeInTheDocument();
    });
  });

  it('does not call ListPVCFiles when namespace is missing', () => {
    render(<FilesTab pvcName="my-pvc" />);
    expect(AppAPI.ListPVCFiles).not.toHaveBeenCalled();
  });
});
