import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { swarmApiMocks, notificationMocks } = vi.hoisted(() => {
  return {
    swarmApiMocks: {
      ListSwarmVolumeFiles: vi.fn(),
      IsSwarmVolumeReadOnly: vi.fn(),
      GetSwarmVolumeFileContent: vi.fn(),
      WriteSwarmVolumeFile: vi.fn(),
      DeleteSwarmVolumeFile: vi.fn(),
      CreateSwarmVolumeDirectory: vi.fn(),
      DownloadFromSwarmVolume: vi.fn(),
      UploadToSwarmVolume: vi.fn(),
    },
    notificationMocks: {
      showSuccess: vi.fn(),
      showError: vi.fn(),
    },
  };
});

vi.mock('../docker/swarmApi', () => swarmApiMocks);
vi.mock('../notification', () => notificationMocks);

// Avoid pulling in CodeMirror / heavy tabs.
vi.mock('../layout/bottompanel/TextViewerTab', () => ({
  default: function TextViewerTabMock({ content, filename }: { content?: string; filename?: string }) {
    return (
      <div data-testid="viewer">
        <div data-testid="viewer-filename">{filename}</div>
        <pre data-testid="viewer-content">{content}</pre>
      </div>
    );
  },
}));
vi.mock('../layout/bottompanel/TextEditorTab', () => ({
  default: function TextEditorTabMock({ content, filename, onChange }: {
    content?: string;
    filename?: string;
    onChange: (_value: string) => void;
  }) {
    return (
      <div data-testid="editor">
        <div data-testid="editor-filename">{filename}</div>
        <textarea
          aria-label="editor-text"
          value={content}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  },
}));

import VolumeFilesTab from '../docker/resources/volumes/VolumeFilesTab';

function rowFor(name: string) {
  const table = screen.getByRole('table');
  const cell = within(table).getByText(new RegExp(String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  return cell.closest('tr');
}

describe('VolumeFilesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    swarmApiMocks.IsSwarmVolumeReadOnly.mockResolvedValue(false);
    swarmApiMocks.ListSwarmVolumeFiles.mockResolvedValue([
      { name: 'dir1', path: '/dir1', isDir: true, mode: 'drwx', size: 0, modified: '2026-01-01T00:00:00Z' },
      { name: 'hello.txt', path: '/hello.txt', isDir: false, mode: '-rw-', size: 5, modified: '2026-01-01T00:00:00Z' },
    ]);

    // btoa/atob are present in jsdom, but make it deterministic.
    const base64 = btoa('hello');
    swarmApiMocks.GetSwarmVolumeFileContent.mockResolvedValue({
      base64,
      isBinary: false,
      size: 5,
      truncated: false,
    });

    swarmApiMocks.WriteSwarmVolumeFile.mockResolvedValue(undefined);
  });

  it('loads root dir and previews a file', async () => {
    render(<VolumeFilesTab volumeName="data" />);

    expect(await screen.findByText(/hello\.txt/)).toBeInTheDocument();

    fireEvent.click(rowFor('hello.txt') as HTMLElement);

    expect(await screen.findByTestId('viewer')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-filename')).toHaveTextContent('/hello.txt');
    expect(screen.getByTestId('viewer-content')).toHaveTextContent('hello');

    expect(swarmApiMocks.ListSwarmVolumeFiles).toHaveBeenCalledWith('data', '/');
    expect(swarmApiMocks.GetSwarmVolumeFileContent).toHaveBeenCalledWith('data', '/hello.txt', 262144);
  });

  it('opens editor and saves edits (writes file and refreshes dir)', async () => {
    render(<VolumeFilesTab volumeName="data" />);
    await screen.findByText(/hello\.txt/);

    fireEvent.click(rowFor('hello.txt') as HTMLElement);
    await screen.findByTestId('viewer');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByTestId('editor')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('editor-text'), { target: { value: 'hello world' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(swarmApiMocks.WriteSwarmVolumeFile).toHaveBeenCalledWith('data', '/hello.txt', 'hello world', 'utf-8')
    );

    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Saved file');

    // refreshDirEntries fetches directory list again
    await waitFor(() => expect(swarmApiMocks.ListSwarmVolumeFiles).toHaveBeenCalledTimes(2));
  });

  it('read-only volumes disable edit/create actions', async () => {
    swarmApiMocks.IsSwarmVolumeReadOnly.mockResolvedValue(true);

    render(<VolumeFilesTab volumeName="data" />);
    await screen.findByText(/hello\.txt/);

    // top bar buttons
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New File' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New Folder' })).toBeDisabled();

    // file preview should still work
    fireEvent.click(rowFor('hello.txt') as HTMLElement);
    expect(await screen.findByTestId('viewer')).toBeInTheDocument();

    // edit button should not appear (readOnly === true)
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('prompts to discard unsaved changes before navigating directories', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));

    swarmApiMocks.ListSwarmVolumeFiles
      .mockResolvedValueOnce([
        { name: 'dir1', path: '/dir1', isDir: true, mode: 'drwx', size: 0, modified: '2026-01-01T00:00:00Z' },
        { name: 'hello.txt', path: '/hello.txt', isDir: false, mode: '-rw-', size: 5, modified: '2026-01-01T00:00:00Z' },
      ])
      .mockResolvedValueOnce([
        { name: 'nested.txt', path: '/dir1/nested.txt', isDir: false, mode: '-rw-', size: 1, modified: '2026-01-01T00:00:00Z' },
      ]);

    render(<VolumeFilesTab volumeName="data" />);
    await screen.findByText(/hello\.txt/);

    fireEvent.click(rowFor('hello.txt') as HTMLElement);
    await screen.findByTestId('viewer');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByTestId('editor');
    fireEvent.change(screen.getByLabelText('editor-text'), { target: { value: 'changed' } });

    // attempt to navigate to dir should prompt; confirm=false means no navigation
    fireEvent.click(rowFor('dir1') as HTMLElement);
    expect(globalThis.confirm).toHaveBeenCalledWith('Discard your unsaved changes?');
    expect(swarmApiMocks.ListSwarmVolumeFiles).not.toHaveBeenCalledWith('data', '/dir1');

    // allow navigation
    (globalThis.confirm as ReturnType<typeof vi.fn>).mockImplementationOnce(() => true);
    fireEvent.click(rowFor('dir1') as HTMLElement);
    expect(await screen.findByText(/nested\.txt/)).toBeInTheDocument();
    expect(swarmApiMocks.ListSwarmVolumeFiles).toHaveBeenCalledWith('data', '/dir1');
  });

  it('supports row download and delete actions', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    swarmApiMocks.DownloadFromSwarmVolume.mockResolvedValueOnce('C:/tmp/file.txt');
    swarmApiMocks.DeleteSwarmVolumeFile.mockResolvedValueOnce(undefined);

    render(<VolumeFilesTab volumeName="data" />);
    await screen.findByText(/hello\.txt/);

    const fileRow = rowFor('hello.txt') as HTMLElement;
    fireEvent.click(within(fileRow).getByRole('button', { name: 'Download' }));

    await waitFor(() => {
      expect(swarmApiMocks.DownloadFromSwarmVolume).toHaveBeenCalledWith('data', '/hello.txt');
    });
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('Downloaded file');

    // open preview then delete the file; should clear preview state
    fireEvent.click(fileRow);
    await screen.findByTestId('viewer');

    fireEvent.click(within(fileRow).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(swarmApiMocks.DeleteSwarmVolumeFile).toHaveBeenCalledWith('data', '/hello.txt', false);
    });
    expect(notificationMocks.showSuccess).toHaveBeenCalledWith('file deleted');
    expect(await screen.findByText(/Select a file to preview/i)).toBeInTheDocument();
  });
});
