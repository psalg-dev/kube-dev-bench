/**
 * Tests for GenericInspectTab component
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GenericInspectTab } from '../components/GenericInspectTab';

// Mock TextViewerTab
vi.mock('../layout/bottompanel/TextViewerTab.jsx', () => ({
  default: ({ content, loading, error, loadingLabel, filename }) => (
    <div data-testid="text-viewer-tab">
      {loading && <div data-testid="loading">{loadingLabel}</div>}
      {error && <div data-testid="error">{error}</div>}
      {content && <div data-testid="content">{content}</div>}
      {filename && <div data-testid="filename">{filename}</div>}
    </div>
  ),
}));

describe('GenericInspectTab', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', async () => {
    const fetchFn = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(
      <GenericInspectTab
        id="test-id"
        fetchFn={fetchFn}
        loadingLabel="Loading test..."
      />
    );
    
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading test...');
  });

  it('should render content after successful fetch', async () => {
    const mockData = JSON.stringify({ name: 'test', value: 123 });
    const fetchFn = vi.fn().mockResolvedValue(mockData);
    
    render(
      <GenericInspectTab
        id="test-id"
        fetchFn={fetchFn}
        loadingLabel="Loading..."
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('content')).toHaveTextContent(mockData);
    });
    
    expect(fetchFn).toHaveBeenCalledWith('test-id');
  });

  it('should render error on fetch failure', async () => {
    const errorMessage = 'Failed to fetch data';
    const fetchFn = vi.fn().mockRejectedValue(new Error(errorMessage));
    
    render(
      <GenericInspectTab
        id="test-id"
        fetchFn={fetchFn}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent(errorMessage);
    });
  });

  it('should use default loading label', async () => {
    const fetchFn = vi.fn().mockImplementation(() => new Promise(() => {}));
    
    render(
      <GenericInspectTab
        id="test-id"
        fetchFn={fetchFn}
      />
    );
    
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading...');
  });

  it('should use provided filename', async () => {
    const fetchFn = vi.fn().mockResolvedValue('{}');
    
    render(
      <GenericInspectTab
        id="test-id"
        fetchFn={fetchFn}
        filename="custom-name.json"
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('filename')).toHaveTextContent('custom-name.json');
    });
  });

  it('should use id.json as default filename', async () => {
    const fetchFn = vi.fn().mockResolvedValue('{}');
    
    render(
      <GenericInspectTab
        id="my-resource-id"
        fetchFn={fetchFn}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('filename')).toHaveTextContent('my-resource-id.json');
    });
  });

  it('should handle null/undefined response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);
    
    render(
      <GenericInspectTab
        id="test-id"
        fetchFn={fetchFn}
      />
    );
    
    await waitFor(() => {
      // Content should be empty string
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    });
  });

  it('should refetch when id changes', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce('{"first": true}')
      .mockResolvedValueOnce('{"second": true}');
    
    const { rerender } = render(
      <GenericInspectTab
        id="first-id"
        fetchFn={fetchFn}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('content')).toHaveTextContent('{"first": true}');
    });
    
    rerender(
      <GenericInspectTab
        id="second-id"
        fetchFn={fetchFn}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('content')).toHaveTextContent('{"second": true}');
    });
    
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenNthCalledWith(1, 'first-id');
    expect(fetchFn).toHaveBeenNthCalledWith(2, 'second-id');
  });

  it('should have absolute positioning container', async () => {
    const fetchFn = vi.fn().mockResolvedValue('{}');
    
    const { container } = render(
      <GenericInspectTab
        id="test-id"
        fetchFn={fetchFn}
      />
    );
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ position: 'absolute' });
  });
});
