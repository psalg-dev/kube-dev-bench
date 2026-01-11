import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock CreateManifestOverlay to a lightweight stub
vi.mock('../CreateManifestOverlay', () => ({
  __esModule: true,
  default: ({ open, kind, platform }) => open ? <div data-testid="create-overlay">overlay-{platform}-{kind}</div> : null
}));

vi.mock('../notification.js', () => ({
  __esModule: true,
  showNotification: vi.fn(),
}));

// Import component under test AFTER mocks
import OverviewTableWithPanel from '../layout/overview/OverviewTableWithPanel.jsx';
import { showNotification } from '../notification.js';

function setup(props = {}) {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status' }
  ];
  const data = [
    { name: 'alpha', status: 'Running' },
    { name: 'beta', status: 'Pending' },
  ];
  const tabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'yaml', label: 'YAML' }
  ];
  const renderPanelContent = (row, tab) => <div data-testid="panel-content">{row.name}-{tab}</div>;
  return render(
    <OverviewTableWithPanel
      title="Pods"
      resourceKind="pod"
      namespace="default"
      columns={columns}
      data={data}
      tabs={tabs}
      renderPanelContent={renderPanelContent}
      {...props}
    />
  );
}

beforeEach(() => {
  document.body.innerHTML = ''; // reset DOM listeners
});

describe('OverviewTableWithPanel', () => {
  it('filters rows by search input', () => {
    setup();
    const filter = screen.getByRole('searchbox', { name: /filter/i });
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2); // header + rows
    fireEvent.change(filter, { target: { value: 'bet' } });
    // Only beta row plus header + maybe message
    const bodyRows = screen.getAllByRole('row');
    expect(bodyRows.some(r => r.textContent.includes('alpha'))).toBe(false);
    expect(bodyRows.some(r => r.textContent.includes('beta'))).toBe(true);
  });

  it('shows no-match message when filter excludes all', () => {
    setup();
    const filter = screen.getByRole('searchbox');
    fireEvent.change(filter, { target: { value: 'zzz' } });
    expect(screen.getByText('No rows match the filter.')).toBeInTheDocument();
  });

  it('opens bottom panel on row click with default tab content', () => {
    setup();
    const alphaRow = screen.getAllByRole('row').find(r => r.textContent.includes('alpha'));
    fireEvent.click(alphaRow);
    const content = screen.getByTestId('panel-content');
    expect(content.textContent).toBe('alpha-summary');
    // bottom panel presence
    expect(document.querySelector('.bottom-panel')).not.toBeNull();
  });

  it('switches tabs and updates panel content', () => {
    setup();
    const alphaRow = screen.getAllByRole('row').find(r => r.textContent.includes('alpha'));
    fireEvent.click(alphaRow);
    const yamlTabBtn = screen.getByRole('button', { name: 'YAML' });
    fireEvent.click(yamlTabBtn);
    expect(screen.getByTestId('panel-content').textContent).toBe('alpha-yaml');
  });

  it('closes panel on outside click', () => {
    setup();
    const alphaRow = screen.getAllByRole('row').find(r => r.textContent.includes('alpha'));
    fireEvent.click(alphaRow);
    expect(document.querySelector('.bottom-panel')).not.toBeNull();
    fireEvent.mouseDown(document.body); // outside click
    expect(document.querySelector('.bottom-panel')).toBeNull();
  });

  it('closes panel on Escape key', () => {
    setup();
    const betaRow = screen.getAllByRole('row').find(r => r.textContent.includes('beta'));
    fireEvent.click(betaRow);
    expect(document.querySelector('.bottom-panel')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.bottom-panel')).toBeNull();
  });

  it('resets active tab after closing & reopening', () => {
    setup();
    const alphaRow = screen.getAllByRole('row').find(r => r.textContent.includes('alpha'));
    fireEvent.click(alphaRow);
    fireEvent.click(screen.getByRole('button', { name: 'YAML' }));
    expect(screen.getByTestId('panel-content').textContent).toBe('alpha-yaml');
    // close outside
    fireEvent.mouseDown(document.body);
    // open beta
    const betaRow = screen.getAllByRole('row').find(r => r.textContent.includes('beta'));
    fireEvent.click(betaRow);
    expect(screen.getByTestId('panel-content').textContent).toBe('beta-summary');
  });

  it('opens create manifest overlay when plus button clicked', () => {
    setup();
    const plusBtn = screen.getByRole('button', { name: /create new/i });
    fireEvent.click(plusBtn);
    expect(screen.getByTestId('create-overlay')).toHaveTextContent('overlay-k8s-pod');
  });

  it('shows create notice (warning) before opening overlay', () => {
    setup({
      createNotice: 'This is an informational notice.',
      createButtonTitle: 'Create something',
      createPlatform: 'swarm',
      createKind: 'service',
    });

    const plusBtn = screen.getByRole('button', { name: /create new/i });
    fireEvent.click(plusBtn);

    expect(showNotification).toHaveBeenCalledWith(
      'This is an informational notice.',
      expect.objectContaining({ type: 'warning' })
    );
    expect(screen.getByTestId('create-overlay')).toHaveTextContent('overlay-swarm-service');
  });

  it('opens row actions menu without opening the bottom panel', () => {
    setup();
    const rowActionsButtons = screen.getAllByRole('button', { name: /row actions/i });
    expect(rowActionsButtons.length).toBeGreaterThan(0);
    fireEvent.click(rowActionsButtons[0]);

    // Menu should show default items
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();

    // Clicking the ellipsis should not trigger row click -> bottom panel stays closed
    expect(document.querySelector('.bottom-panel')).toBeNull();
  });

  it('does not show Close action for swarm row menus', () => {
    setup({ createPlatform: 'swarm', createKind: 'service' });
    const rowActionsButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(rowActionsButtons[0]);

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.queryByText('Close')).toBeNull();
  });

  it('closes row actions menu on window blur', () => {
    setup();
    const rowActionsButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(rowActionsButtons[0]);
    expect(screen.getByText('Details')).toBeInTheDocument();

    window.dispatchEvent(new Event('blur'));

    return waitFor(() => {
      expect(document.querySelector('.row-actions-menu')).toBeNull();
    });
  });

  it('supports getRowActions using api.openDetails(tabKey)', () => {
    setup({
      getRowActions: (_row, api) => ([
        { label: 'Open YAML', onClick: () => api.openDetails('yaml') },
      ]),
    });

    const rowActionsButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(rowActionsButtons[0]);
    fireEvent.click(screen.getByText('Open YAML'));

    const content = screen.getByTestId('panel-content');
    expect(content.textContent).toBe('alpha-yaml');
    expect(document.querySelector('.bottom-panel')).not.toBeNull();
  });
});

