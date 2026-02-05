import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import PVBoundPVCTab from '../k8s/resources/persistentvolumes/PVBoundPVCTab';

describe('PVBoundPVCTab', () => {
  it('renders unbound state when claim is empty', () => {
    render(
      <PVBoundPVCTab
        pvName="test-pv"
        claim="-"
      />
    );

    expect(screen.getByText(/no bound pvc/i)).toBeInTheDocument();
    expect(screen.getByText(/not currently bound/i)).toBeInTheDocument();
  });

  it('renders unbound state when claim is null', () => {
    render(
      <PVBoundPVCTab
        pvName="test-pv"
        claim={null as unknown as string}
      />
    );

    expect(screen.getByText(/no bound pvc/i)).toBeInTheDocument();
  });

  it('renders bound PVC info when claim is provided', () => {
    render(
      <PVBoundPVCTab
        pvName="test-pv"
        claim="default/my-pvc"
      />
    );

    expect(screen.getByText('my-pvc')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('default/my-pvc')).toBeInTheDocument();
  });

  it('parses namespace and name from claim correctly', () => {
    render(
      <PVBoundPVCTab
        pvName="data-pv"
        claim="production/database-pvc"
      />
    );

    expect(screen.getByText('database-pvc')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
  });

  it('handles claim without namespace separator', () => {
    render(
      <PVBoundPVCTab
        pvName="legacy-pv"
        claim="legacy-claim-name"
      />
    );

    expect(screen.getAllByText(/legacy-claim-name/).length).toBeGreaterThan(0);
  });

  it('shows PV-PVC binding explanation', () => {
    render(
      <PVBoundPVCTab
        pvName="test-pv"
        claim="default/test-pvc"
      />
    );

    expect(screen.getByText(/about pv-pvc binding/i)).toBeInTheDocument();
    expect(screen.getAllByText(/persistentvolume/i).length).toBeGreaterThan(0);
  });

  it('displays header when PVC is bound', () => {
    render(
      <PVBoundPVCTab
        pvName="bound-pv"
        claim="test-ns/bound-pvc"
      />
    );

    expect(screen.getByText(/bound persistentvolumeclaim/i)).toBeInTheDocument();
  });

  it('shows availability message when not bound', () => {
    render(
      <PVBoundPVCTab
        pvName="available-pv"
        claim="-"
      />
    );

    expect(screen.getByText(/available for binding/i)).toBeInTheDocument();
  });
});
