import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the Wails API calls
const mockGetKubeConfigs = vi.fn();
const mockSelectKubeConfigFile = vi.fn();
const mockSaveCustomKubeConfig = vi.fn();
const mockSetKubeConfigPath = vi.fn();
const mockGetKubeContextsFromFile = vi.fn();
const mockSavePrimaryKubeConfig = vi.fn();
const mockGetKubeContexts = vi.fn();
const mockGetNamespaces = vi.fn();
const mockSetCurrentKubeContext = vi.fn();
const mockSetCurrentNamespace = vi.fn();
const mockGetCurrentConfig = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  GetKubeConfigs: (...args) => mockGetKubeConfigs(...args),
  SelectKubeConfigFile: (...args) => mockSelectKubeConfigFile(...args),
  SaveCustomKubeConfig: (...args) => mockSaveCustomKubeConfig(...args),
  SetKubeConfigPath: (...args) => mockSetKubeConfigPath(...args),
  GetKubeContextsFromFile: (...args) => mockGetKubeContextsFromFile(...args),
  SavePrimaryKubeConfig: (...args) => mockSavePrimaryKubeConfig(...args),
  GetKubeContexts: (...args) => mockGetKubeContexts(...args),
  GetNamespaces: (...args) => mockGetNamespaces(...args),
  SetCurrentKubeContext: (...args) => mockSetCurrentKubeContext(...args),
  SetCurrentNamespace: (...args) => mockSetCurrentNamespace(...args),
  GetCurrentConfig: (...args) => mockGetCurrentConfig(...args),
}));

import ConnectionWizard from '../layout/connection/ConnectionWizard.jsx';

describe('ConnectionWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentConfig.mockResolvedValue({});
    mockGetKubeContexts.mockResolvedValue(['default']);
    mockGetNamespaces.mockResolvedValue(['default']);
    mockSetCurrentKubeContext.mockResolvedValue();
    mockSetCurrentNamespace.mockResolvedValue();
  });

  describe('Empty state (no configs discovered)', () => {
    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue([]);
    });

    it('renders empty state with paste textarea when no configs found', async () => {
      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByText(/Create Your First Kubeconfig/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Kubeconfig Content/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Browse for File/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save & Continue/i })).toBeInTheDocument();
    });

    it('shows error when trying to save empty content', async () => {
      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByText(/Create Your First Kubeconfig/i)).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /Save & Continue/i });
      expect(saveButton).toBeDisabled();
    });

    it('saves primary kubeconfig and completes', async () => {
      mockSavePrimaryKubeConfig.mockResolvedValue('/home/user/.kube/kubeconfig');
      mockGetKubeConfigs.mockResolvedValueOnce([]).mockResolvedValueOnce([
        { path: '/home/user/.kube/kubeconfig', name: 'kubeconfig', contexts: ['test-ctx'] }
      ]);
      mockSetKubeConfigPath.mockResolvedValue();

      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Kubeconfig Content/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/Kubeconfig Content/i);
      fireEvent.change(textarea, { target: { value: 'apiVersion: v1\nkind: Config\ncontexts: []' } });

      const saveButton = screen.getByRole('button', { name: /Save & Continue/i });
      expect(saveButton).not.toBeDisabled();

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSavePrimaryKubeConfig).toHaveBeenCalledWith('apiVersion: v1\nkind: Config\ncontexts: []');
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });
  });

  describe('With discovered configs', () => {
    const mockConfigs = [
      { path: '/home/user/.kube/config', name: 'config (default)', contexts: ['dev', 'prod'] },
      { path: '/home/user/.kube/kubeconfig', name: 'kubeconfig (primary)', contexts: ['test'] },
    ];

    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue(mockConfigs);
    });

    it('renders config selection view when configs are found', async () => {
      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByText(/Select Kubeconfig/i)).toBeInTheDocument();
      });

      expect(screen.getByText('config (default)')).toBeInTheDocument();
      expect(screen.getByText('kubeconfig (primary)')).toBeInTheDocument();
    });

    it('displays contexts for each config', async () => {
      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByText(/Contexts: dev, prod/)).toBeInTheDocument();
        expect(screen.getByText(/Contexts: test/)).toBeInTheDocument();
      });
    });

    it('allows selecting a config and completing', async () => {
      mockSetKubeConfigPath.mockResolvedValue();

      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByText('kubeconfig (primary)')).toBeInTheDocument();
      });

      // Click on the second config
      fireEvent.click(screen.getByText('kubeconfig (primary)'));

      const continueBtn = screen.getByRole('button', { name: /Continue/i });
      fireEvent.click(continueBtn);

      await waitFor(() => {
        expect(mockSetKubeConfigPath).toHaveBeenCalledWith('/home/user/.kube/kubeconfig');
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('shows paste additional config step', async () => {
      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Paste Additional Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Paste Additional Config/i }));

      await waitFor(() => {
        expect(screen.getByText(/Add Custom Kubeconfig/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Configuration Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Kubeconfig Content/i)).toBeInTheDocument();
    });

    it('validates custom config fields before saving', async () => {
      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Paste Additional Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Paste Additional Config/i }));

      await waitFor(() => {
        expect(screen.getByText(/Add Custom Kubeconfig/i)).toBeInTheDocument();
      });

      const saveBtn = screen.getByRole('button', { name: /Save & Use/i });
      expect(saveBtn).toBeDisabled();
    });

    it('saves custom config and returns to selection', async () => {
      mockSaveCustomKubeConfig.mockResolvedValue();

      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Paste Additional Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Paste Additional Config/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Configuration Name/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/Configuration Name/i), { target: { value: 'my-cluster' } });
      fireEvent.change(screen.getByLabelText(/Kubeconfig Content/i), { target: { value: 'apiVersion: v1' } });

      const saveBtn = screen.getByRole('button', { name: /Save & Use/i });
      expect(saveBtn).not.toBeDisabled();

      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockSaveCustomKubeConfig).toHaveBeenCalledWith('my-cluster', 'apiVersion: v1');
      });
    });

    it('navigates back from custom config step', async () => {
      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Paste Additional Config/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Paste Additional Config/i }));

      await waitFor(() => {
        expect(screen.getByText(/Add Custom Kubeconfig/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /← Back/i }));

      await waitFor(() => {
        expect(screen.getByText(/Select Kubeconfig/i)).toBeInTheDocument();
      });
    });
  });

  describe('File browsing', () => {
    beforeEach(() => {
      mockGetKubeConfigs.mockResolvedValue([]);
    });

    it('adds file from browser to discovered configs', async () => {
      const user = userEvent.setup();
      mockSelectKubeConfigFile.mockResolvedValue('/custom/path/kubeconfig');
      mockGetKubeContextsFromFile.mockResolvedValue(['ctx1', 'ctx2']);

      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      const browseButton = await screen.findByRole('button', { name: /Browse for File/i });
      await user.click(browseButton);

      await waitFor(() => {
        expect(mockSelectKubeConfigFile).toHaveBeenCalled();
        expect(mockGetKubeContextsFromFile).toHaveBeenCalledWith('/custom/path/kubeconfig');
      });
    });

    it('handles file selection cancellation', async () => {
      const user = userEvent.setup();
      mockSelectKubeConfigFile.mockResolvedValue(''); // Empty string = cancelled

      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      const browseButton = await screen.findByRole('button', { name: /Browse for File/i });
      await user.click(browseButton);

      await waitFor(() => {
        expect(mockSelectKubeConfigFile).toHaveBeenCalled();
      });

      // Should not call GetKubeContextsFromFile for empty path
      expect(mockGetKubeContextsFromFile).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('displays error when config discovery fails', async () => {
      mockGetKubeConfigs.mockRejectedValue(new Error('Discovery failed'));

      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to discover kubeconfig files/i)).toBeInTheDocument();
      });
    });

    it('displays error when save fails', async () => {
      mockGetKubeConfigs.mockResolvedValue([]);
      mockSavePrimaryKubeConfig.mockRejectedValue(new Error('Save failed'));

      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Kubeconfig Content/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/Kubeconfig Content/i), { target: { value: 'invalid yaml' } });
      fireEvent.click(screen.getByRole('button', { name: /Save & Continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to save primary kubeconfig/i)).toBeInTheDocument();
      });
    });

    it('displays error when file browsing fails', async () => {
      mockGetKubeConfigs.mockResolvedValue([]);
      mockSelectKubeConfigFile.mockRejectedValue(new Error('File dialog error'));

      const onComplete = vi.fn();
      render(<ConnectionWizard onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Browse for File/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Browse for File/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to load kubeconfig file/i)).toBeInTheDocument();
      });
    });
  });
});
