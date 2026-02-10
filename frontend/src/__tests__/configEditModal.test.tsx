import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfigEditModal from '../docker/resources/configs/ConfigEditModal';
import type { docker } from '../../wailsjs/go/models';

// Mock swarmApi
vi.mock('../docker/swarmApi', () => ({
  GetSwarmConfigData: vi.fn(),
  UpdateSwarmConfigData: vi.fn(),
}));

// Mock wails runtime
vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsEmit: vi.fn(),
}));

// Mock notification
vi.mock('../notification', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

// Mock TextEditorTab
vi.mock('../layout/bottompanel/TextEditorTab', () => ({
  default: ({ value, onChange, loading }: { value?: string; onChange?: (value: string) => void; loading?: boolean }) => (
    <div data-testid="text-editor">
      {loading && <div>Loading...</div>}
      <textarea
        data-testid="editor-textarea"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  ),
}));

import { GetSwarmConfigData, UpdateSwarmConfigData } from '../docker/swarmApi';
import { showError, showSuccess } from '../notification';

const getSwarmConfigDataMock = vi.mocked(GetSwarmConfigData);
const updateSwarmConfigDataMock = vi.mocked(UpdateSwarmConfigData);
const toUpdateResult = (data: unknown) => data as docker.SwarmConfigUpdateResult;

describe('ConfigEditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('does not render when open is false', () => {
      render(
        <ConfigEditModal
          open={false}
          configId="config-123"
          configName="my-config"
        />
      );

      expect(screen.queryByText(/Edit Config/)).not.toBeInTheDocument();
    });

    it('renders when open is true', async () => {
      getSwarmConfigDataMock.mockResolvedValue('config data');

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
        />
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalledWith('config-123');
      });

      expect(screen.getByText(/my-config/)).toBeInTheDocument();
    });

    it('displays config name in header', async () => {
      getSwarmConfigDataMock.mockResolvedValue('');

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="production-config"
        />
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalledWith('config-123');
      });

      expect(screen.getByText(/production-config/)).toBeInTheDocument();
    });

    it('displays Cancel and Save buttons', async () => {
      getSwarmConfigDataMock.mockResolvedValue('');

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
        />
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalledWith('config-123');
      });

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('loads config data on open', async () => {
      getSwarmConfigDataMock.mockResolvedValue('initial config content');

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
        />
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalledWith('config-123');
      });
    });
  });

  describe('button interactions', () => {
    it('calls onClose when Cancel button clicked', async () => {
      getSwarmConfigDataMock.mockResolvedValue('');
      const onClose = vi.fn();

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={onClose}
        />
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalledWith('config-123');
      });

      fireEvent.click(screen.getByText('Cancel'));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when clicking overlay', async () => {
      getSwarmConfigDataMock.mockResolvedValue('');
      const onClose = vi.fn();

      const { container } = render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={onClose}
        />
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalledWith('config-123');
      });

      // Click the overlay (outermost div)
      const overlay = container.firstChild;
      if (!overlay) throw new Error('Expected overlay element');
      fireEvent.click(overlay);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('save action', () => {
    it('calls UpdateSwarmConfigData when content is changed', async () => {
      getSwarmConfigDataMock.mockResolvedValue('original content');
      updateSwarmConfigDataMock.mockResolvedValue(toUpdateResult({
        newConfigName: 'new-config',
        updated: [] as docker.SwarmServiceRef[],
      }));

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalled();
      });

      // Change the content
      const textarea = screen.getByTestId('editor-textarea');
      fireEvent.change(textarea, { target: { value: 'modified content' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(UpdateSwarmConfigData).toHaveBeenCalledWith('config-123', 'modified content');
      });
    });

    it('shows success notification on successful save', async () => {
      getSwarmConfigDataMock.mockResolvedValue('original');
      updateSwarmConfigDataMock.mockResolvedValue(toUpdateResult({
        newConfigName: 'new-config',
        updated: [{ serviceId: 'svc-1', serviceName: 'svc-1' }],
      }));

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalled();
      });

      const textarea = screen.getByTestId('editor-textarea');
      fireEvent.change(textarea, { target: { value: 'new content' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(showSuccess).toHaveBeenCalled();
      });
    });

    it('shows error notification on save failure', async () => {
      getSwarmConfigDataMock.mockResolvedValue('original');
      updateSwarmConfigDataMock.mockRejectedValue(new Error('Save failed'));

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalled();
      });

      const textarea = screen.getByTestId('editor-textarea');
      fireEvent.change(textarea, { target: { value: 'new content' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(showError).toHaveBeenCalled();
      });
    });
  });

  describe('validation', () => {
    it('does not save if content is unchanged', async () => {
      getSwarmConfigDataMock.mockResolvedValue('original content');

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalled();
      });

      // Don't change content, just click save
      fireEvent.click(screen.getByText('Save'));

      // API should not be called for unchanged content
      await new Promise(r => setTimeout(r, 50));
      expect(UpdateSwarmConfigData).not.toHaveBeenCalled();
    });
  });
});


