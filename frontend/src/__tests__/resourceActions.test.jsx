import React from 'react';
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
      />
    );

    const scaleBtn = screen.getByRole('button', { name: /scale/i });
    fireEvent.click(scaleBtn);

    const input = screen.getByLabelText(/replicas/i);
    expect(input).toHaveValue(3);

    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => expect(scaleSpy).toHaveBeenCalledTimes(1));
    expect(scaleSpy).toHaveBeenCalledWith('deployment', 'test', 'example-deploy', 5);
    expect(showSuccess).toHaveBeenCalledWith("Scaled deployment 'example-deploy' to 5 replicas");
  });

  it('cancels inline scale editor and restores original value', () => {
    render(
      <ResourceActions
        resourceType="statefulset"
        name="example-stateful"
        namespace="test"
        replicaCount={4}
      />
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
      />
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
      />
    );

    const scaleBtn = screen.getByRole('button', { name: /scale/i });
    expect(scaleBtn).toBeDisabled();
    fireEvent.click(scaleBtn);
    expect(screen.queryByLabelText(/replicas/i)).toBeNull();
  });
});
