import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PVCapacityUsageTab from '../k8s/resources/persistentvolumes/PVCapacityUsageTab';

describe('PVCapacityUsageTab', () => {
  it('displays PV name in message', () => {
    render(<PVCapacityUsageTab pvName="my-nfs-volume" />);

    expect(screen.getByText(/my-nfs-volume/)).toBeInTheDocument();
  });

  it('displays capacity usage not available message', () => {
    render(<PVCapacityUsageTab pvName="test-pv" />);

    expect(
      screen.getByText(/Capacity usage metrics are not available/),
    ).toBeInTheDocument();
  });

  it('displays hint about volume usage metrics', () => {
    render(<PVCapacityUsageTab pvName="test-pv" />);

    expect(
      screen.getByText(/If your cluster exposes volume usage metrics/),
    ).toBeInTheDocument();
  });
});
