import '../__tests__/wailsMocks';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ResourceRow } from '../types/resourceConfigs';
import {
  swarmVolumeColumns,
  swarmVolumeTabs,
  renderSwarmVolumePanelContent,
  swarmVolumeConfig,
  getSwarmVolumeRowActions,
} from '../config/resourceConfigs/swarm/volumeConfig';

vi.mock('../docker/swarmApi', () => ({
  GetSwarmVolumes: vi.fn(),
  GetSwarmVolumeUsage: vi.fn(),
  BackupSwarmVolume: vi.fn(),
  CloneSwarmVolume: vi.fn(),
  RemoveSwarmVolume: vi.fn(),
  RestoreSwarmVolume: vi.fn(),
}));

vi.mock('../QuickInfoSection', () => ({
  default: () => <div data-testid="quick-info-section" />,
}));

vi.mock('../layout/bottompanel/SummaryTabHeader', () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="summary-tab-header">{name}</div>
  ),
}));

vi.mock('../docker/resources/SwarmResourceActions', () => ({
  default: () => <div data-testid="swarm-resource-actions" />,
}));

vi.mock('../docker/resources/volumes/VolumeUsedBySection', () => ({
  default: ({ volumeName }: { volumeName: string }) => (
    <div data-testid="volume-used-by-section">{volumeName}</div>
  ),
}));

vi.mock('../docker/resources/volumes/VolumeFilesTab', () => ({
  default: ({ volumeName }: { volumeName: string }) => (
    <div data-testid="volume-files-tab">{volumeName}</div>
  ),
}));

vi.mock('../docker/resources/volumes/VolumeInspectTab', () => ({
  default: ({ volumeName }: { volumeName: string }) => (
    <div data-testid="volume-inspect-tab">{volumeName}</div>
  ),
}));

vi.mock('../components/BaseModal', () => ({
  __esModule: true,
  BaseModal: ({ isOpen, onClose, title, children, footer }: { isOpen: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal-wrapper">
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-content">{children}</div>
        {footer && <div data-testid="modal-footer">{footer}</div>}
        <button data-testid="modal-close" onClick={onClose}>Close</button>
      </div>
    );
  },
  default: ({ isOpen, onClose, title, children, footer }: { isOpen: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal-wrapper">
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-content">{children}</div>
        {footer && <div data-testid="modal-footer">{footer}</div>}
        <button data-testid="modal-close" onClick={onClose}>Close</button>
      </div>
    );
  },
  ModalButton: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <button data-testid="modal-btn" {...props}>{children}</button>,
  ModalPrimaryButton: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <button data-testid="modal-primary-btn" {...props}>{children}</button>,
  ModalDangerButton: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => <button data-testid="modal-danger-btn" {...props}>{children}</button>,
}));

vi.mock('../notification', () => ({
  __esModule: true,
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const mockRow: ResourceRow = {
  name: 'my-volume',
  driver: 'local',
  scope: 'local',
  mountpoint: '/var/lib/docker/volumes/my-volume/_data',
  createdAt: '2024-01-01T00:00:00Z',
  labels: {},
};

describe('swarmVolumeConfig – columns', () => {
  it('has the expected column keys', () => {
    const keys = swarmVolumeColumns.map((c) => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('driver');
    expect(keys).toContain('scope');
    expect(keys).toContain('createdAt');
  });

  it('has labels on all columns', () => {
    for (const col of swarmVolumeColumns) {
      expect(typeof col.label).toBe('string');
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('swarmVolumeConfig – tabs', () => {
  it('has the expected tab keys', () => {
    const keys = swarmVolumeTabs.map((t) => t.key);
    expect(keys).toContain('summary');
    expect(keys).toContain('files');
    expect(keys).toContain('inspect');
  });
});

describe('swarmVolumeConfig – config object', () => {
  it('exposes correct resourceType and resourceKind', () => {
    expect(swarmVolumeConfig.resourceType).toBe('swarm-volume');
    expect(swarmVolumeConfig.resourceKind).toBe('Volume');
  });
});

describe('renderSwarmVolumePanelContent – smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary tab without crashing', () => {
    const node = renderSwarmVolumePanelContent(mockRow, 'summary');
    render(<>{node}</>);
    expect(screen.getByTestId('summary-tab-header')).toBeInTheDocument();
    expect(screen.getByTestId('volume-used-by-section')).toBeInTheDocument();
  });

  it('renders files tab without crashing', () => {
    const node = renderSwarmVolumePanelContent(mockRow, 'files');
    render(<>{node}</>);
    expect(screen.getByTestId('volume-files-tab')).toBeInTheDocument();
  });

  it('renders inspect tab without crashing', () => {
    const node = renderSwarmVolumePanelContent(mockRow, 'inspect');
    render(<>{node}</>);
    expect(screen.getByTestId('volume-inspect-tab')).toBeInTheDocument();
  });

  it('returns null for unknown tab', () => {
    const node = renderSwarmVolumePanelContent(mockRow, 'unknown');
    expect(node).toBeNull();
  });
});

describe('getSwarmVolumeRowActions – clone dialog', () => {
  const mockPanelApi = { refresh: vi.fn() };

  it('does NOT use window.prompt for clone action', () => {
    const windowPromptSpy = vi.spyOn(window, 'prompt');
    const actions = getSwarmVolumeRowActions(mockRow, mockPanelApi);
    const cloneAction = actions.find((a) => a.label === 'Clone…');
    expect(cloneAction).toBeDefined();
    expect(windowPromptSpy).not.toHaveBeenCalled();
    windowPromptSpy.mockRestore();
  });
});

describe('getSwarmVolumeRowActions – delete dialog', () => {
  const mockPanelApi = { refresh: vi.fn() };

  it('does NOT use window.confirm for delete action', () => {
    const windowConfirmSpy = vi.spyOn(window, 'confirm');
    const actions = getSwarmVolumeRowActions(mockRow, mockPanelApi);
    const deleteAction = actions.find((a) => a.label === 'Delete');
    expect(deleteAction).toBeDefined();
    expect(windowConfirmSpy).not.toHaveBeenCalled();
    windowConfirmSpy.mockRestore();
  });
});
