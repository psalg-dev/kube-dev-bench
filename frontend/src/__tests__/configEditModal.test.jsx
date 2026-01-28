import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfigEditModal from '../docker/resources/configs/ConfigEditModal';

// Mock swarmApi
vi.mock('../docker/swarmApi.js', () => ({
  GetSwarmConfigData: vi.fn(),
  UpdateSwarmConfigData: vi.fn(),
}));

// Mock wails runtime
vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  EventsEmit: vi.fn(),
}));

// Mock notification
vi.mock('../notification.js', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

// Mock TextEditorTab
vi.mock('../layout/bottompanel/TextEditorTab.jsx', () => ({
  default: ({ value, onChange, loading }) => (
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

import {
  GetSwarmConfigData,
  UpdateSwarmConfigData,
} from '../docker/swarmApi.js';
import { showError, showSuccess } from '../notification.js';

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
        />,
      );

      expect(screen.queryByText(/Edit Config/)).not.toBeInTheDocument();
    });

    it('renders when open is true', async () => {
      GetSwarmConfigData.mockResolvedValue('config data');

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
        />,
      );

      expect(screen.getByText(/my-config/)).toBeInTheDocument();
    });

    it('displays config name in header', async () => {
      GetSwarmConfigData.mockResolvedValue('');

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="production-config"
        />,
      );

      expect(screen.getByText(/production-config/)).toBeInTheDocument();
    });

    it('displays Cancel and Save buttons', async () => {
      GetSwarmConfigData.mockResolvedValue('');

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
        />,
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('loads config data on open', async () => {
      GetSwarmConfigData.mockResolvedValue('initial config content');

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
        />,
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalledWith('config-123');
      });
    });
  });

  describe('button interactions', () => {
    it('calls onClose when Cancel button clicked', async () => {
      GetSwarmConfigData.mockResolvedValue('');
      const onClose = vi.fn();

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByText('Cancel'));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when clicking overlay', async () => {
      GetSwarmConfigData.mockResolvedValue('');
      const onClose = vi.fn();

      const { container } = render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={onClose}
        />,
      );

      // Click the overlay (outermost div)
      const overlay = container.firstChild;
      fireEvent.click(overlay);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('save action', () => {
    it('calls UpdateSwarmConfigData when content is changed', async () => {
      GetSwarmConfigData.mockResolvedValue('original content');
      UpdateSwarmConfigData.mockResolvedValue({
        newConfigName: 'new-config',
        updated: [],
      });

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalled();
      });

      // Change the content
      const textarea = screen.getByTestId('editor-textarea');
      fireEvent.change(textarea, { target: { value: 'modified content' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(UpdateSwarmConfigData).toHaveBeenCalledWith(
          'config-123',
          'modified content',
        );
      });
    });

    it('shows success notification on successful save', async () => {
      GetSwarmConfigData.mockResolvedValue('original');
      UpdateSwarmConfigData.mockResolvedValue({
        newConfigName: 'new-config',
        updated: ['svc-1'],
      });

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
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
      GetSwarmConfigData.mockResolvedValue('original');
      UpdateSwarmConfigData.mockRejectedValue(new Error('Save failed'));

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={vi.fn()}
        />,
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
      GetSwarmConfigData.mockResolvedValue('original content');

      render(
        <ConfigEditModal
          open={true}
          configId="config-123"
          configName="my-config"
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(GetSwarmConfigData).toHaveBeenCalled();
      });

      // Don't change content, just click save
      fireEvent.click(screen.getByText('Save'));

      // API should not be called for unchanged content
      await new Promise((r) => setTimeout(r, 50));
      expect(UpdateSwarmConfigData).not.toHaveBeenCalled();
    });
  });
});
