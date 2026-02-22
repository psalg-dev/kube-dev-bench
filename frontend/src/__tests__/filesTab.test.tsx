import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock CodeMirror before importing FilesTab
vi.mock('@codemirror/state', () => ({
  Compartment: class {
    of(ext: unknown) { return ext; }
    reconfigure(ext: unknown) { return { reconfigure: ext }; }
  },
  EditorState: {
    readOnly: { of: vi.fn(() => ({})) },
    create: vi.fn(() => ({ doc: { length: 0 } })),
  },
}));

vi.mock('@codemirror/view', () => ({
  EditorView: class {
    static theme = vi.fn(() => ({}));
    static lineWrapping = {};
    static editable = { of: vi.fn(() => ({})) };
    dispatch = vi.fn();
    destroy = vi.fn();
    constructor() {}
  },
  lineNumbers: vi.fn(() => ({})),
  highlightActiveLineGutter: vi.fn(() => ({})),
  keymap: { of: vi.fn(() => ({})) },
}));

vi.mock('@codemirror/language', () => ({
  foldGutter: vi.fn(() => ({})),
  foldKeymap: [],
  defaultHighlightStyle: {},
  syntaxHighlighting: vi.fn(() => ({})),
}));

vi.mock('@codemirror/lang-yaml', () => ({
  yaml: vi.fn(() => ({})),
}));

vi.mock('../../wailsjs/go/main/App', () => ({
  ListPVCFiles: vi.fn(),
  GetPVCFileContent: vi.fn(),
  ArchivePVCPath: vi.fn(),
}));

import * as AppAPI from '../../wailsjs/go/main/App';
import FilesTab from '../layout/bottompanel/FilesTab';

const listFilesMock = vi.mocked(AppAPI.ListPVCFiles);
const getFileContentMock = vi.mocked(AppAPI.GetPVCFileContent);

describe('FilesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Files header', () => {
    listFilesMock.mockImplementation(() => new Promise(() => {}));

    render(<FilesTab namespace="default" pvcName="my-pvc" />);

    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('shows breadcrumb "root" by default', () => {
    listFilesMock.mockImplementation(() => new Promise(() => {}));

    render(<FilesTab namespace="default" pvcName="my-pvc" />);

    expect(screen.getByText('root')).toBeInTheDocument();
  });

  it('shows loading state while fetching directory', () => {
    listFilesMock.mockImplementation(() => new Promise(() => {}));

    render(<FilesTab namespace="default" pvcName="my-pvc" />);

    expect(screen.getByText('Loading directory...')).toBeInTheDocument();
  });

  it('renders file rows after successful API call', async () => {
    listFilesMock.mockResolvedValue([
      { name: 'config.yaml', path: '/config.yaml', isDir: false, mode: '-rw-r--r--', size: 1024, modified: '2024-01-01T00:00:00Z' },
      { name: 'data', path: '/data', isDir: true, mode: 'drwxr-xr-x', size: 0, modified: '2024-01-01T00:00:00Z' },
    ]);

    render(<FilesTab namespace="default" pvcName="my-pvc" />);

    await waitFor(() => {
      expect(screen.getByText('config.yaml')).toBeInTheDocument();
      expect(screen.getByText('data')).toBeInTheDocument();
    });
  });

  it('shows error when API call fails', async () => {
    listFilesMock.mockRejectedValue(new Error('PVC not found'));

    render(<FilesTab namespace="default" pvcName="my-pvc" />);

    await waitFor(() => {
      expect(screen.getByText(/Error: PVC not found/)).toBeInTheDocument();
    });
  });

  it('shows column headers: Name, Perms, Size, Modified', async () => {
    listFilesMock.mockResolvedValue([
      { name: 'test.txt', path: '/test.txt', isDir: false, mode: '-rw-r--r--', size: 100, modified: '2024-01-01T00:00:00Z' },
    ]);

    render(<FilesTab namespace="default" pvcName="my-pvc" />);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Perms')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });
  });

  it('clicking root crumb reloads root directory', async () => {
    listFilesMock.mockResolvedValue([
      { name: 'subdir', path: '/subdir', isDir: true, mode: 'drwxr-xr-x', size: 0, modified: '2024-01-01T00:00:00Z' },
    ]);

    render(<FilesTab namespace="default" pvcName="my-pvc" />);

    await waitFor(() => screen.getByText('subdir'));

    const rootCrumb = screen.getByText('root');
    fireEvent.click(rootCrumb);

    await waitFor(() => {
      expect(listFilesMock).toHaveBeenCalledWith('default', 'my-pvc', '/');
    });
  });

  it('calls API with correct namespace and pvcName', async () => {
    listFilesMock.mockResolvedValue([]);

    render(<FilesTab namespace="test-ns" pvcName="test-pvc" />);

    await waitFor(() => {
      expect(listFilesMock).toHaveBeenCalledWith('test-ns', 'test-pvc', '/');
    });
  });

  it('does not call ListPVCFiles if pvcName is missing', () => {
    render(<FilesTab namespace="default" />);

    expect(listFilesMock).not.toHaveBeenCalled();
  });

  it('shows empty directory message when result is empty', async () => {
    listFilesMock.mockResolvedValue([]);

    render(<FilesTab namespace="default" pvcName="my-pvc" />);

    await waitFor(() => {
      expect(screen.getByText(/Empty directory or not accessible/)).toBeInTheDocument();
    });
  });

  it('shows file selection hint in preview panel', async () => {
    listFilesMock.mockResolvedValue([]);

    render(<FilesTab namespace="default" pvcName="my-pvc" />);

    await waitFor(() => {
      expect(screen.getByText(/Select a file to preview/)).toBeInTheDocument();
    });
  });

  it('opens file content preview when file row is clicked', async () => {
    listFilesMock.mockResolvedValue([
      { name: 'readme.txt', path: '/readme.txt', isDir: false, mode: '-rw-r--r--', size: 50, modified: '2024-01-01T00:00:00Z' },
    ]);
    getFileContentMock.mockResolvedValue({
      path: '/readme.txt',
      base64: btoa('hello world'),
      isBinary: false,
      truncated: false,
      size: 11,
    });

    render(<FilesTab namespace="default" pvcName="my-pvc" />);

    await waitFor(() => screen.getByText('readme.txt'));
    fireEvent.click(screen.getByText('readme.txt'));

    await waitFor(() => {
      expect(getFileContentMock).toHaveBeenCalledWith('default', 'my-pvc', '/readme.txt', 262144);
    });
  });
});
