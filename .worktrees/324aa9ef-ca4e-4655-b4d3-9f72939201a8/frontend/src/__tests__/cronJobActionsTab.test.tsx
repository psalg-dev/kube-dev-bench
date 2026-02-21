import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock the App API
const mockStartJobFromCronJob = vi.fn();
const mockSuspendCronJob = vi.fn();
const mockResumeCronJob = vi.fn();

vi.mock('../../wailsjs/go/main/App', () => ({
  StartJobFromCronJob: (...args: unknown[]) => mockStartJobFromCronJob(...args),
  SuspendCronJob: (...args: unknown[]) => mockSuspendCronJob(...args),
  ResumeCronJob: (...args: unknown[]) => mockResumeCronJob(...args),
}));

import CronJobActionsTab from '../k8s/resources/cronjobs/CronJobActionsTab';

describe('CronJobActionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Trigger Now action', () => {
    render(
      <CronJobActionsTab
        namespace="default"
        cronJobName="test-cronjob"
        suspend={false}
      />
    );

    expect(screen.getByText(/trigger now/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trigger job now/i })).toBeInTheDocument();
  });

  it('renders Suspend action when CronJob is active', () => {
    render(
      <CronJobActionsTab
        namespace="default"
        cronJobName="test-cronjob"
        suspend={false}
      />
    );

    expect(screen.getByText(/suspend cronjob/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^suspend$/i })).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('renders Resume action when CronJob is suspended', () => {
    render(
      <CronJobActionsTab
        namespace="default"
        cronJobName="test-cronjob"
        suspend={true}
      />
    );

    expect(screen.getByText(/resume cronjob/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^resume$/i })).toBeInTheDocument();
    expect(screen.getByText(/suspended/i)).toBeInTheDocument();
  });

  it('calls StartJobFromCronJob when Trigger Now is clicked', async () => {
    mockStartJobFromCronJob.mockResolvedValue(undefined);

    render(
      <CronJobActionsTab
        namespace="my-namespace"
        cronJobName="my-cronjob"
        suspend={false}
      />
    );

    const triggerBtn = screen.getByRole('button', { name: /trigger job now/i });
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(mockStartJobFromCronJob).toHaveBeenCalledWith('my-namespace', 'my-cronjob');
    });
  });

  it('shows success message after triggering job', async () => {
    mockStartJobFromCronJob.mockResolvedValue(undefined);

    render(
      <CronJobActionsTab
        namespace="default"
        cronJobName="test-cronjob"
        suspend={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /trigger job now/i }));

    await waitFor(() => {
      expect(screen.getByText(/triggered successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error message when trigger fails', async () => {
    mockStartJobFromCronJob.mockRejectedValue(new Error('Failed to trigger job'));

    render(
      <CronJobActionsTab
        namespace="default"
        cronJobName="test-cronjob"
        suspend={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /trigger job now/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to trigger job/i)).toBeInTheDocument();
    });
  });

  it('calls SuspendCronJob when Suspend is clicked', async () => {
    mockSuspendCronJob.mockResolvedValue(undefined);

    render(
      <CronJobActionsTab
        namespace="prod"
        cronJobName="scheduled-job"
        suspend={false}
      />
    );

    const suspendBtn = screen.getByRole('button', { name: /^suspend$/i });
    fireEvent.click(suspendBtn);

    await waitFor(() => {
      expect(mockSuspendCronJob).toHaveBeenCalledWith('prod', 'scheduled-job');
    });
  });

  it('calls ResumeCronJob when Resume is clicked', async () => {
    mockResumeCronJob.mockResolvedValue(undefined);

    render(
      <CronJobActionsTab
        namespace="staging"
        cronJobName="paused-job"
        suspend={true}
      />
    );

    const resumeBtn = screen.getByRole('button', { name: /^resume$/i });
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(mockResumeCronJob).toHaveBeenCalledWith('staging', 'paused-job');
    });
  });

  it('shows success message after suspending', async () => {
    mockSuspendCronJob.mockResolvedValue(undefined);

    render(
      <CronJobActionsTab
        namespace="default"
        cronJobName="test-cronjob"
        suspend={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^suspend$/i }));

    await waitFor(() => {
      expect(screen.getByText(/suspended successfully/i)).toBeInTheDocument();
    });
  });

  it('shows success message after resuming', async () => {
    mockResumeCronJob.mockResolvedValue(undefined);

    render(
      <CronJobActionsTab
        namespace="default"
        cronJobName="test-cronjob"
        suspend={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^resume$/i }));

    await waitFor(() => {
      expect(screen.getByText(/resumed successfully/i)).toBeInTheDocument();
    });
  });

  it('disables buttons while loading', async () => {
    let resolvePromise: (() => void) | undefined;
    mockStartJobFromCronJob.mockImplementation(() => new Promise<void>((resolve) => { resolvePromise = resolve; }));

    render(
      <CronJobActionsTab
        namespace="default"
        cronJobName="test-cronjob"
        suspend={false}
      />
    );

    const triggerBtn = screen.getByRole('button', { name: /trigger job now/i });
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(screen.getByText(/triggering/i)).toBeInTheDocument();
    });

    // Both buttons should be disabled during loading
    expect(triggerBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: /^suspend$/i })).toBeDisabled();

    // Resolve the promise
    await act(async () => {
      if (!resolvePromise) throw new Error('Expected resolve callback');
      resolvePromise();
    });
  });

  it('shows current status badge', () => {
    const { rerender } = render(
      <CronJobActionsTab
        namespace="default"
        cronJobName="test-cronjob"
        suspend={false}
      />
    );

    expect(screen.getByText(/active/i)).toBeInTheDocument();

    rerender(
      <CronJobActionsTab
        namespace="default"
        cronJobName="test-cronjob"
        suspend={true}
      />
    );

    expect(screen.getByText(/suspended/i)).toBeInTheDocument();
  });
});