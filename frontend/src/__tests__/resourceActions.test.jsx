import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const scaleSpy = vi.fn();

vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
}));

vi.mock('../k8s/resources/kubeApi', () => ({
  StartJob: vi.fn(),
  SuspendCronJob: vi.fn(),
  ResumeCronJob: vi.fn(),
  StartJobFromCronJob: vi.fn(),
  ScaleResource: (...args) => scaleSpy(...args),
  ResizePersistentVolumeClaim: vi.fn(),
}));

import ResourceActions from '../components/ResourceActions.jsx';
import { showSuccess } from '../notification';

describe('ResourceActions scale control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scaleSpy.mockReset();
  });

  it('prepopulates replica count and applies scale changes', async () => {
    scaleSpy.mockResolvedValueOnce();

    render(
      <ResourceActions
        resourceType="deployment"
        name="example-deploy"
        namespace="test"
        replicaCount={3}
      />,
    );

    const scaleBtn = screen.getByRole('button', { name: /scale/i });
    fireEvent.click(scaleBtn);

    const input = screen.getByLabelText(/replicas/i);
    expect(input).toHaveValue(3);

    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => expect(scaleSpy).toHaveBeenCalledTimes(1));
    expect(scaleSpy).toHaveBeenCalledWith(
      'deployment',
      'test',
      'example-deploy',
      5,
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "Scaled deployment 'example-deploy' to 5 replicas",
    );
  });

  it('cancels inline scale editor and restores original value', () => {
    render(
      <ResourceActions
        resourceType="statefulset"
        name="example-stateful"
        namespace="test"
        replicaCount={4}
      />,
    );

    const scaleBtn = screen.getByRole('button', { name: /scale/i });
    fireEvent.click(scaleBtn);

    let input = screen.getByLabelText(/replicas/i);
    fireEvent.change(input, { target: { value: '9' } });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByLabelText(/replicas/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /scale/i }));
    input = screen.getByLabelText(/replicas/i);
    expect(input).toHaveValue(4);
  });

  it('does not render scale action for unsupported resource types', () => {
    render(
      <ResourceActions
        resourceType="pod"
        name="example-pod"
        namespace="test"
        replicaCount={1}
      />,
    );

    expect(screen.queryByRole('button', { name: /scale/i })).toBeNull();
  });

  it('shows disabled scale button for daemonsets', () => {
    render(
      <ResourceActions
        resourceType="daemonset"
        name="example-ds"
        namespace="test"
        replicaCount={2}
      />,
    );

    const scaleBtn = screen.getByRole('button', { name: /scale/i });
    expect(scaleBtn).toBeDisabled();
    fireEvent.click(scaleBtn);
    expect(screen.queryByLabelText(/replicas/i)).toBeNull();
  });
});

// Need to import these for additional tests
import { showError, showWarning } from '../notification';
import {
  StartJob,
  SuspendCronJob,
  ResumeCronJob,
  StartJobFromCronJob,
  ResizePersistentVolumeClaim,
} from '../k8s/resources/kubeApi';

describe('ResourceActions Job controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders start button for Job resource type', () => {
    render(
      <ResourceActions
        resourceType="job"
        name="example-job"
        namespace="test"
      />,
    );

    const startBtn = screen.getByRole('button', { name: /start/i });
    expect(startBtn).toBeInTheDocument();
  });

  it('calls StartJob when start button clicked for Job', async () => {
    StartJob.mockResolvedValueOnce();

    render(
      <ResourceActions
        resourceType="job"
        name="example-job"
        namespace="test"
      />,
    );

    const startBtn = screen.getByRole('button', { name: /start/i });
    fireEvent.click(startBtn);

    await waitFor(() =>
      expect(StartJob).toHaveBeenCalledWith('test', 'example-job'),
    );
    expect(showSuccess).toHaveBeenCalledWith("Job 'example-job' started");
  });

  it('shows error when StartJob fails', async () => {
    StartJob.mockRejectedValueOnce(new Error('Job failed'));

    render(
      <ResourceActions resourceType="job" name="my-job" namespace="ns1" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining('Job failed'),
      ),
    );
  });
});

describe('ResourceActions CronJob controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders start, suspend, and resume buttons for CronJob', () => {
    render(
      <ResourceActions
        resourceType="cronjob"
        name="example-cronjob"
        namespace="test"
      />,
    );

    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /suspend/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
  });

  it('calls StartJobFromCronJob when start clicked', async () => {
    StartJobFromCronJob.mockResolvedValueOnce();

    render(
      <ResourceActions
        resourceType="cronjob"
        name="my-cronjob"
        namespace="prod"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() =>
      expect(StartJobFromCronJob).toHaveBeenCalledWith('prod', 'my-cronjob'),
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "Job started from CronJob 'my-cronjob'",
    );
  });

  it('calls SuspendCronJob when suspend clicked', async () => {
    SuspendCronJob.mockResolvedValueOnce();

    render(
      <ResourceActions
        resourceType="cronjob"
        name="my-cronjob"
        namespace="prod"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /suspend/i }));

    await waitFor(() =>
      expect(SuspendCronJob).toHaveBeenCalledWith('prod', 'my-cronjob'),
    );
    expect(showSuccess).toHaveBeenCalledWith("CronJob 'my-cronjob' suspended");
  });

  it('calls ResumeCronJob when resume clicked', async () => {
    ResumeCronJob.mockResolvedValueOnce();

    render(
      <ResourceActions
        resourceType="cronjob"
        name="my-cronjob"
        namespace="prod"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /resume/i }));

    await waitFor(() =>
      expect(ResumeCronJob).toHaveBeenCalledWith('prod', 'my-cronjob'),
    );
    expect(showSuccess).toHaveBeenCalledWith("CronJob 'my-cronjob' resumed");
  });

  it('shows error when SuspendCronJob fails', async () => {
    SuspendCronJob.mockRejectedValueOnce(new Error('Suspend failed'));

    render(
      <ResourceActions resourceType="cronjob" name="cron1" namespace="ns" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /suspend/i }));

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining('Suspend failed'),
      ),
    );
  });
});

describe('ResourceActions restart and delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders restart button when onRestart provided', () => {
    render(
      <ResourceActions
        resourceType="deployment"
        name="app"
        namespace="test"
        onRestart={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /restart/i }),
    ).toBeInTheDocument();
  });

  it('renders delete button when onDelete provided', () => {
    render(
      <ResourceActions
        resourceType="deployment"
        name="app"
        namespace="test"
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('requires double-click to restart (confirmation flow)', async () => {
    const onRestart = vi.fn().mockResolvedValue();

    render(
      <ResourceActions
        resourceType="deployment"
        name="my-app"
        namespace="prod"
        onRestart={onRestart}
      />,
    );

    const restartBtn = screen.getByRole('button', { name: /restart/i });

    // First click shows warning
    fireEvent.click(restartBtn);
    expect(showWarning).toHaveBeenCalled();
    expect(onRestart).not.toHaveBeenCalled();

    // Button should now show "Confirm"
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /confirm/i }),
      ).toBeInTheDocument();
    });

    // Second click confirms
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(onRestart).toHaveBeenCalledWith('my-app', 'prod'),
    );
    expect(showSuccess).toHaveBeenCalledWith("deployment 'my-app' restarted");
  });

  it('requires double-click to delete (confirmation flow)', async () => {
    const onDelete = vi.fn().mockResolvedValue();

    render(
      <ResourceActions
        resourceType="pod"
        name="my-pod"
        namespace="default"
        onDelete={onDelete}
      />,
    );

    const deleteBtn = screen.getByRole('button', { name: /delete/i });

    // First click shows warning
    fireEvent.click(deleteBtn);
    expect(showWarning).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();

    // Second click confirms
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(onDelete).toHaveBeenCalledWith('my-pod', 'default'),
    );
    expect(showSuccess).toHaveBeenCalledWith("pod 'my-pod' deleted");
  });

  it('shows error when restart fails', async () => {
    const onRestart = vi.fn().mockRejectedValue(new Error('Restart failed'));

    render(
      <ResourceActions
        resourceType="deployment"
        name="app"
        namespace="ns"
        onRestart={onRestart}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /restart/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining('Restart failed'),
      ),
    );
  });
});

describe('ResourceActions PVC resize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders resize button for PVC resource type', () => {
    render(
      <ResourceActions resourceType="pvc" name="my-pvc" namespace="test" />,
    );

    expect(screen.getByRole('button', { name: /resize/i })).toBeInTheDocument();
  });

  it('shows size input when resize clicked', () => {
    render(
      <ResourceActions resourceType="pvc" name="my-pvc" namespace="test" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /resize/i }));

    expect(screen.getByPlaceholderText(/5gi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('submits resize with entered value', async () => {
    ResizePersistentVolumeClaim.mockResolvedValueOnce();

    render(
      <ResourceActions resourceType="pvc" name="my-pvc" namespace="test" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /resize/i }));

    const input = screen.getByPlaceholderText(/5gi/i);
    fireEvent.change(input, { target: { value: '10Gi' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() =>
      expect(ResizePersistentVolumeClaim).toHaveBeenCalledWith(
        'test',
        'my-pvc',
        '10Gi',
      ),
    );
    expect(showSuccess).toHaveBeenCalledWith(
      "Resize requested for PVC 'my-pvc' to 10Gi",
    );
  });

  it('shows error when resize value is empty', async () => {
    render(
      <ResourceActions resourceType="pvc" name="my-pvc" namespace="test" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /resize/i }));
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining('Enter a size'),
      ),
    );
  });

  it('cancels resize and hides input', () => {
    render(
      <ResourceActions resourceType="pvc" name="my-pvc" namespace="test" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /resize/i }));
    expect(screen.getByPlaceholderText(/5gi/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/5gi/i)).toBeNull();
  });
});

describe('ResourceActions disabled state', () => {
  it('disables all buttons when disabled prop is true', () => {
    render(
      <ResourceActions
        resourceType="deployment"
        name="app"
        namespace="test"
        onRestart={vi.fn()}
        onDelete={vi.fn()}
        replicaCount={3}
        disabled={true}
      />,
    );

    expect(screen.getByRole('button', { name: /restart/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /scale/i })).toBeDisabled();
  });
});
