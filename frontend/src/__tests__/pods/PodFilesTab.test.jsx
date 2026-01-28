import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { vi } from 'vitest';
import PodFilesTab from '../../k8s/resources/pods/PodFilesTab';

// Mock window.go.main.App API
beforeEach(() => {
  const filesMock = vi.fn().mockImplementation((podName, container, path) => {
    if (path === '/') {
      return Promise.resolve([
        { name: 'file1.txt', type: 'file', path: '/file1.txt' },
        { name: 'dir1', type: 'dir', path: '/dir1' },
      ]);
    }
    if (path === '/dir1') {
      return Promise.resolve([
        { name: 'nested.txt', type: 'file', path: '/dir1/nested.txt' },
      ]);
    }
    return Promise.resolve([]);
  });
  window.go = {
    main: {
      App: {
        // Component uses GetPodFileContent (not GetPodFilePreview)
        GetPodFileContent: vi.fn().mockResolvedValue({
          base64: btoa('file content'),
          size: 12,
          truncated: false,
          isBinary: false,
        }),
        GetPodContainers: vi.fn().mockResolvedValue(['container1']),
        GetPodFiles: filesMock,
      },
    },
  };
});

describe('PodFilesTab', () => {
  async function waitForContainerLoaded() {
    // Wait for select to appear and be enabled and for options to be populated
    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).not.toBeDisabled());
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options.some((opt) => opt.value === 'container1')).toBe(true);
    });
  }

  async function waitForFileRows() {
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.some((r) => within(r).queryByText('file1.txt'))).toBe(true);
    });
  }

  it('renders without crashing', async () => {
    render(<PodFilesTab podName="test-pod" />);
    expect(await screen.findByText(/container/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(window.go.main.App.GetPodContainers).toHaveBeenCalled(),
    );
  });

  it('shows directory entries', async () => {
    render(<PodFilesTab podName="test-pod" />);
    await waitForContainerLoaded();
    await waitForFileRows();
  });

  it('navigates into a directory', async () => {
    render(<PodFilesTab podName="test-pod" />);
    await waitForContainerLoaded();
    await waitFor(() => expect(screen.getByText('dir1')).toBeInTheDocument());
    fireEvent.click(screen.getByText('dir1'));
    expect(window.go.main.App.GetPodFiles).toHaveBeenCalled();
  });

  it('previews a file on click', async () => {
    render(<PodFilesTab podName="test-pod" />);
    await waitForContainerLoaded();
    await waitForFileRows();
    const rows = screen.getAllByRole('row');
    const fileRow = rows.find((row) => within(row).queryByText('file1.txt'));
    expect(fileRow).toBeTruthy();
    fireEvent.click(fileRow);
    await waitFor(() =>
      expect(window.go.main.App.GetPodFileContent).toHaveBeenCalled(),
    );
    // The CodeMirror preview should contain the file content text
    await waitFor(() =>
      expect(screen.getByText(/file content/i)).toBeInTheDocument(),
    );
  });

  it('filters entries by search', async () => {
    render(<PodFilesTab podName="test-pod" />);
    await waitForContainerLoaded();
    await waitForFileRows();
    fireEvent.change(screen.getByPlaceholderText(/filter/i), {
      target: { value: 'file1' },
    });
    expect(screen.getByText('file1.txt')).toBeInTheDocument();
    expect(screen.queryByText('dir1')).not.toBeInTheDocument();
  });

  it('handles copy-to-clipboard state', async () => {
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(void 0) },
    });
    render(<PodFilesTab podName="test-pod" />);
    await waitForContainerLoaded();
    await waitForFileRows();
    const fileRow = screen
      .getAllByRole('row')
      .find((r) => within(r).queryByText('file1.txt'));
    fireEvent.click(fileRow);
    await waitFor(() =>
      expect(window.go.main.App.GetPodFileContent).toHaveBeenCalled(),
    );
    const copyBtn = await screen.findByRole('button', { name: /copy/i });
    fireEvent.click(copyBtn);
    await waitFor(() => expect(copyBtn).toHaveTextContent(/copied/i));
  });

  it('shows loading and error states', async () => {
    window.go.main.App.GetPodFiles.mockRejectedValueOnce(
      new Error('Failed to load'),
    );
    render(<PodFilesTab podName="test-pod" />);
    await waitFor(() =>
      expect(screen.getByText(/error: failed to load/i)).toBeInTheDocument(),
    );
  });
});
