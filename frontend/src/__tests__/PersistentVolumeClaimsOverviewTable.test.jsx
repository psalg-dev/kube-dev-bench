import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import PersistentVolumeClaimsOverviewTable from '../k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable.jsx';
import { renderWithProviders, mockAppApi, resetMocks, flushPromises } from './test-utils.jsx';

describe('PersistentVolumeClaimsOverviewTable', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('displays PVC rows when API returns data', async () => {
    mockAppApi('GetPersistentVolumeClaims', async (ns) => {
      return [
        { name: 'pvc-1', namespace: ns, status: 'Bound', storage: '1Gi', accessModes: ['ReadWriteOnce'], volumeName: 'pv-1', age: '5m' }
      ];
    });

    const { findByText } = renderWithProviders(<PersistentVolumeClaimsOverviewTable namespaces={["default"]} />);

    // wait for async fetch to complete
    await flushPromises();

    // The table title comes from OverviewTableWithPanel
    expect(await findByText('Persistent Volume Claims')).toBeTruthy();
    // Expect a row with pvc-1 to appear
    expect(await findByText('pvc-1')).toBeTruthy();
  });

  it('shows loading when namespaces empty', async () => {
    // render with empty namespaces -> component remains in loading state due to initial load behavior
    const { findByText, queryByText } = renderWithProviders(<PersistentVolumeClaimsOverviewTable namespaces={[]} />);
    expect(await findByText('Loading Persistent Volume Claims...')).toBeTruthy();
    // no pvc names should be present
    expect(queryByText('pvc-1')).toBeNull();
  });
});
