/**
 * Tests for HelmActions component
 * Covers: upgrade dialog, rollback picker, and uninstall flows
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../wailsjs/go/main/App', () => ({
  UninstallHelmRelease: vi.fn(),
  UpgradeHelmRelease: vi.fn(),
  RollbackHelmRelease: vi.fn(),
  GetHelmReleaseHistory: vi.fn(),
}));

vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────────

import * as AppAPI from '../../wailsjs/go/main/App';
import HelmActions from '../k8s/resources/helmreleases/HelmActions';
import * as notification from '../notification';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const defaultProps = {
  releaseName: 'my-app',
  namespace: 'default',
  chart: 'bitnami/my-app',
};

/** Return the rollback confirm button inside the picker popup (not the outer "Rollback" header btn) */
function getRollbackConfirmButton() {
  // The picker renders with a "Select revision" label; its parent div is the popup container
  const selectRevisionEl = screen.getByText('Select revision');
  const pickerContainer = selectRevisionEl.parentElement!;
  return within(pickerContainer).getByRole('button', { name: /rollback/i });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('HelmActions – Upgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Upgrade, Rollback and Uninstall buttons', () => {
    render(<HelmActions {...defaultProps} />);
    expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rollback/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /uninstall/i })).toBeInTheDocument();
  });

  it('opens upgrade dialog when Upgrade button is clicked', async () => {
    render(<HelmActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /^upgrade$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Upgrade Release: my-app/i)).toBeInTheDocument();
    });
  });

  it('upgrade dialog shows chart reference field and submits to UpgradeHelmRelease', async () => {
    const user = userEvent.setup();
    vi.mocked(AppAPI.UpgradeHelmRelease).mockResolvedValue(undefined as unknown as void);

    const onRefresh = vi.fn();
    render(<HelmActions {...defaultProps} onRefresh={onRefresh} />);

    // Open the upgrade dialog
    fireEvent.click(screen.getByRole('button', { name: /^upgrade$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Upgrade Release: my-app/i)).toBeInTheDocument();
    });

    // Type into the chart reference input
    await user.type(screen.getByPlaceholderText(/bitnami\/nginx/i), 'bitnami/nginx');

    // Click the Upgrade submit button inside the dialog (it's the last "Upgrade" button)
    const allUpgradeBtns = screen.getAllByRole('button', { name: /^upgrade$/i });
    await user.click(allUpgradeBtns[allUpgradeBtns.length - 1]);

    await waitFor(() => {
      expect(AppAPI.UpgradeHelmRelease).toHaveBeenCalledWith(
        expect.objectContaining({
          releaseName: 'my-app',
          namespace: 'default',
          chartRef: 'bitnami/nginx',
        })
      );
    });

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('upgrade dialog shows error if chart ref is empty on submit', async () => {
    render(<HelmActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /^upgrade$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Upgrade Release: my-app/i)).toBeInTheDocument();
    });

    // Click the form submit button without entering a chart ref
    const allUpgradeBtns = screen.getAllByRole('button', { name: /^upgrade$/i });
    fireEvent.click(allUpgradeBtns[allUpgradeBtns.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/chart reference is required/i)).toBeInTheDocument();
    });

    expect(AppAPI.UpgradeHelmRelease).not.toHaveBeenCalled();
  });

  it('upgrade dialog closes when Cancel is clicked', async () => {
    render(<HelmActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /^upgrade$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Upgrade Release: my-app/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Upgrade Release: my-app/i)).not.toBeInTheDocument();
    });
  });

  it('upgrade shows error message when UpgradeHelmRelease rejects', async () => {
    const user = userEvent.setup();
    vi.mocked(AppAPI.UpgradeHelmRelease).mockRejectedValue(new Error('upgrade failed'));

    render(<HelmActions {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /^upgrade$/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/bitnami\/nginx/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/bitnami\/nginx/i), 'bitnami/nginx');

    const allUpgradeBtns = screen.getAllByRole('button', { name: /^upgrade$/i });
    await user.click(allUpgradeBtns[allUpgradeBtns.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/upgrade failed/i)).toBeInTheDocument();
    });
  });
});

describe('HelmActions – Rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens rollback revision picker after loading history', async () => {
    vi.mocked(AppAPI.GetHelmReleaseHistory).mockResolvedValue([
      { revision: 2, status: 'deployed', chart: 'my-app-1.0.2', description: '', updated: '' },
      { revision: 1, status: 'superseded', chart: 'my-app-1.0.1', description: '', updated: '' },
    ] as unknown as Awaited<ReturnType<typeof AppAPI.GetHelmReleaseHistory>>);

    render(<HelmActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /rollback/i }));

    await waitFor(() => {
      expect(screen.getByText('Select revision')).toBeInTheDocument();
    });

    expect(AppAPI.GetHelmReleaseHistory).toHaveBeenCalledWith('default', 'my-app');
  });

  it('executes rollback when revision selected and confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(AppAPI.GetHelmReleaseHistory).mockResolvedValue([
      { revision: 3, status: 'deployed', chart: 'my-app-1.0.3', description: '', updated: '' },
      { revision: 2, status: 'superseded', chart: 'my-app-1.0.2', description: '', updated: '' },
      { revision: 1, status: 'superseded', chart: 'my-app-1.0.1', description: '', updated: '' },
    ] as unknown as Awaited<ReturnType<typeof AppAPI.GetHelmReleaseHistory>>);
    vi.mocked(AppAPI.RollbackHelmRelease).mockResolvedValue(undefined as unknown as void);

    const onRefresh = vi.fn();
    render(<HelmActions {...defaultProps} onRefresh={onRefresh} />);

    // Open the rollback picker
    fireEvent.click(screen.getByRole('button', { name: /rollback/i }));

    await waitFor(() => {
      expect(screen.getByText('Select revision')).toBeInTheDocument();
    });

    // Click the confirm Rollback button inside the picker popup
    const confirmBtn = getRollbackConfirmButton();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(AppAPI.RollbackHelmRelease).toHaveBeenCalled();
    });

    expect(notification.showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Rolled back')
    );
    expect(onRefresh).toHaveBeenCalled();
  });

  it('shows error when only one revision exists (no rollback possible)', async () => {
    vi.mocked(AppAPI.GetHelmReleaseHistory).mockResolvedValue([
      { revision: 1, status: 'deployed', chart: 'my-app-1.0.0', description: '', updated: '' },
    ] as unknown as Awaited<ReturnType<typeof AppAPI.GetHelmReleaseHistory>>);

    render(<HelmActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /rollback/i }));

    await waitFor(() => {
      expect(notification.showError).toHaveBeenCalledWith(
        expect.stringContaining('No previous revision')
      );
    });

    expect(screen.queryByText('Select revision')).not.toBeInTheDocument();
  });

  it('shows error when GetHelmReleaseHistory fails', async () => {
    vi.mocked(AppAPI.GetHelmReleaseHistory).mockRejectedValue(new Error('network error'));

    render(<HelmActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /rollback/i }));

    await waitFor(() => {
      expect(notification.showError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load revisions')
      );
    });
  });

  it('closes rollback picker when inner Cancel is clicked', async () => {
    vi.mocked(AppAPI.GetHelmReleaseHistory).mockResolvedValue([
      { revision: 2, status: 'deployed', chart: 'my-app-1.0.2', description: '', updated: '' },
      { revision: 1, status: 'superseded', chart: 'my-app-1.0.1', description: '', updated: '' },
    ] as unknown as Awaited<ReturnType<typeof AppAPI.GetHelmReleaseHistory>>);

    render(<HelmActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /rollback/i }));

    await waitFor(() => {
      expect(screen.getByText('Select revision')).toBeInTheDocument();
    });

    const selectRevisionEl = screen.getByText('Select revision');
    const pickerContainer = selectRevisionEl.parentElement!;
    const cancelBtn = within(pickerContainer).getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Select revision')).not.toBeInTheDocument();
    });
  });

  it('does NOT rollback when window.confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(AppAPI.GetHelmReleaseHistory).mockResolvedValue([
      { revision: 2, status: 'deployed', chart: 'my-app-1.0.2', description: '', updated: '' },
      { revision: 1, status: 'superseded', chart: 'my-app-1.0.1', description: '', updated: '' },
    ] as unknown as Awaited<ReturnType<typeof AppAPI.GetHelmReleaseHistory>>);

    render(<HelmActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /rollback/i }));

    await waitFor(() => {
      expect(screen.getByText('Select revision')).toBeInTheDocument();
    });

    const confirmBtn = getRollbackConfirmButton();
    await act(async () => { fireEvent.click(confirmBtn); });

    expect(AppAPI.RollbackHelmRelease).not.toHaveBeenCalled();
  });
});

describe('HelmActions – Uninstall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls UninstallHelmRelease after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(AppAPI.UninstallHelmRelease).mockResolvedValue(undefined as unknown as void);

    const onRefresh = vi.fn();
    render(<HelmActions {...defaultProps} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button', { name: /uninstall/i }));

    await waitFor(() => {
      expect(AppAPI.UninstallHelmRelease).toHaveBeenCalledWith('default', 'my-app');
    });

    expect(notification.showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('my-app')
    );
    expect(onRefresh).toHaveBeenCalled();
  });

  it('does NOT call UninstallHelmRelease if user cancels confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<HelmActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /uninstall/i }));

    await act(async () => {});

    expect(AppAPI.UninstallHelmRelease).not.toHaveBeenCalled();
  });

  it('shows error notification when UninstallHelmRelease rejects', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(AppAPI.UninstallHelmRelease).mockRejectedValue(new Error('permission denied'));

    render(<HelmActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /uninstall/i }));

    await waitFor(() => {
      expect(notification.showError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to uninstall')
      );
    });
  });

  it('disables the Uninstall button while uninstalling', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // Never resolves — keeps the component in the "uninstalling" state
    vi.mocked(AppAPI.UninstallHelmRelease).mockImplementation(
      () => new Promise(() => {})
    );

    render(<HelmActions {...defaultProps} />);

    const uninstallBtn = screen.getByRole('button', { name: /uninstall/i });
    fireEvent.click(uninstallBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /uninstalling/i })).toBeDisabled();
    });
  });
});
