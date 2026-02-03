/**
 * GenericResourceTable Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GenericResourceTable } from '../components/GenericResourceTable';

// Mock the hooks
vi.mock('../hooks/useResourceData', () => ({
  useResourceData: vi.fn(() => ({
    data: [
      { name: 'test-deployment', namespace: 'default', replicas: 3, ready: 3, age: '1d' },
    ],
    loading: false,
    refresh: vi.fn(),
  })),
}));

vi.mock('../hooks/useHolmesAnalysis', () => ({
  useHolmesAnalysis: vi.fn(() => ({
    state: {
      loading: false,
      response: null,
      error: null,
      key: null,
      streamId: null,
      streamingText: '',
      reasoningText: '',
      queryTimestamp: null,
      contextSteps: [],
      toolEvents: [],
    },
    analyze: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
  })),
}));

// Mock OverviewTableWithPanel
vi.mock('../layout/overview/OverviewTableWithPanel', () => ({
  default: ({ columns, data, title, loading }) => (
    <div data-testid="overview-table">
      <h2>{title}</h2>
      {loading && <span>Loading...</span>}
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col.key}>{row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}));

// Mock notification
vi.mock('../notification', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

describe('GenericResourceTable', () => {
  const defaultProps = {
    resourceType: 'deployment',
    resourceKind: 'Deployment',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'namespace', label: 'Namespace' },
      { key: 'replicas', label: 'Replicas' },
    ],
    tabs: [
      { key: 'summary', label: 'Summary' },
      { key: 'yaml', label: 'YAML' },
    ],
    fetchFn: vi.fn(),
    eventName: 'deployments:update',
    renderPanelContent: vi.fn(() => <div>Panel content</div>),
    namespace: 'default',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the table with correct title', async () => {
    render(<GenericResourceTable {...defaultProps} title="Deployments" />);
    
    await waitFor(() => {
      expect(screen.getByText('Deployments')).toBeInTheDocument();
    });
  });

  it('renders table columns', async () => {
    render(<GenericResourceTable {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Namespace')).toBeInTheDocument();
      expect(screen.getByText('Replicas')).toBeInTheDocument();
    });
  });

  it('renders data rows', async () => {
    render(<GenericResourceTable {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('test-deployment')).toBeInTheDocument();
      expect(screen.getByText('default')).toBeInTheDocument();
    });
  });

  it('uses resourceKind for default title', async () => {
    const props = { ...defaultProps };
    delete props.title;
    
    render(<GenericResourceTable {...props} />);
    
    await waitFor(() => {
      // Default title should be resourceKind + 's'
      expect(screen.getByText('Deployments')).toBeInTheDocument();
    });
  });

  it('passes columns to OverviewTableWithPanel', () => {
    render(<GenericResourceTable {...defaultProps} />);
    
    // The mock renders column headers
    defaultProps.columns.forEach((col) => {
      expect(screen.getByText(col.label)).toBeInTheDocument();
    });
  });
});
