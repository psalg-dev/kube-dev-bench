import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PVCBoundPVTab from '../k8s/resources/persistentvolumeclaims/PVCBoundPVTab';

describe('PVCBoundPVTab', () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatchSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  describe('when no PV is bound', () => {
    it('shows not bound message when pvName is empty', () => {
      render(<PVCBoundPVTab namespace="default" pvcName="my-pvc" pvName="" />);

      expect(screen.getByText(/No bound PersistentVolume/i)).toBeInTheDocument();
      expect(screen.getByText(/default\/my-pvc/)).toBeInTheDocument();
    });

    it('shows not bound message when pvName is dash', () => {
      render(<PVCBoundPVTab namespace="default" pvcName="my-pvc" pvName="-" />);

      expect(screen.getByText(/No bound PersistentVolume/i)).toBeInTheDocument();
    });

    it('shows not bound message when pvName is undefined', () => {
      render(
        <PVCBoundPVTab
          namespace="default"
          pvcName="my-pvc"
          pvName={undefined as unknown as string}
        />
      );

      expect(screen.getByText(/No bound PersistentVolume/i)).toBeInTheDocument();
    });

    it('shows not bound message when pvName is null', () => {
      render(
        <PVCBoundPVTab
          namespace="default"
          pvcName="my-pvc"
          pvName={null as unknown as string}
        />
      );

      expect(screen.getByText(/No bound PersistentVolume/i)).toBeInTheDocument();
    });
  });

  describe('when PV is bound', () => {
    it('displays bound PV name', () => {
      render(<PVCBoundPVTab namespace="default" pvcName="my-pvc" pvName="pv-data-001" />);

      expect(screen.getByText('pv-data-001')).toBeInTheDocument();
      expect(screen.getByText('Bound PersistentVolume')).toBeInTheDocument();
    });

    it('shows PV Name label', () => {
      render(<PVCBoundPVTab namespace="default" pvcName="my-pvc" pvName="pv-data-001" />);

      expect(screen.getByText('PV Name')).toBeInTheDocument();
    });

    it('displays Open PV button', () => {
      render(<PVCBoundPVTab namespace="default" pvcName="my-pvc" pvName="pv-data-001" />);

      const button = screen.getByRole('button', { name: /Open PV/i });
      expect(button).toBeInTheDocument();
    });

    it('shows help text about navigation', () => {
      render(<PVCBoundPVTab namespace="default" pvcName="my-pvc" pvName="pv-data-001" />);

      expect(screen.getByText(/Clicking.*Open PV.*switches/i)).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('dispatches navigate-to-resource event when Open PV is clicked', () => {
      render(<PVCBoundPVTab namespace="default" pvcName="my-pvc" pvName="pv-data-001" />);

      const button = screen.getByRole('button', { name: /Open PV/i });
      fireEvent.click(button);

      expect(dispatchSpy).toHaveBeenCalled();
      const dispatchedEvent = dispatchSpy.mock.calls[0][0] as CustomEvent<{
        resource: string;
        name: string;
        namespace: string;
      }>;
      expect(dispatchedEvent.type).toBe('navigate-to-resource');
      expect(dispatchedEvent.detail).toEqual({
        resource: 'PersistentVolume',
        name: 'pv-data-001',
        namespace: '',
      });
    });

    it('does not dispatch event when clicking button if no PV', () => {
      render(<PVCBoundPVTab namespace="default" pvcName="my-pvc" pvName="-" />);

      expect(screen.queryByRole('button', { name: /Open PV/i })).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles long PV names', () => {
      const longName = 'very-long-persistent-volume-name-that-exceeds-normal-length-limits-for-testing-purposes';
      render(<PVCBoundPVTab namespace="default" pvcName="my-pvc" pvName={longName} />);

      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('handles special characters in PV name', () => {
      render(<PVCBoundPVTab namespace="default" pvcName="my-pvc" pvName="pv-data.v1.2024" />);

      expect(screen.getByText('pv-data.v1.2024')).toBeInTheDocument();
    });
  });
});
