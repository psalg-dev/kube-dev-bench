import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickInfoSection from '../QuickInfoSection.jsx';

// Helper freeze time
const NOW = new Date('2025-10-05T12:00:00Z').getTime();

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QuickInfoSection', () => {
  it('shows loading state', () => {
    render(<QuickInfoSection loading data={{}} fields={[]} />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(<QuickInfoSection error="Boom" data={{}} fields={[]} />);
    expect(screen.getByText(/Error: Boom/)).toBeInTheDocument();
  });

  it('shows no data message when empty', () => {
    render(<QuickInfoSection data={{}} fields={[]} />);
    expect(screen.getByText(/No data available/)).toBeInTheDocument();
  });

  it('renders provided fields with special renderers', () => {
    const startedAt = new Date(NOW - 95_000).toISOString(); // 95s ago -> 1m 35s
    const data = {
      name: 'alpha',
      status: 'Running',
      startedAt,
      labels: { app: 'demo', tier: 'backend' },
      pods: ['p1', 'p2'],
      uid: 'abc-123-xyz-999',
    };
    const fields = [
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'startedAt', label: 'Age', type: 'age' },
      { key: 'labels', label: 'Labels', type: 'labels' },
      { key: 'pods', label: 'Pods', type: 'list' },
      { key: 'uid', label: 'UID', type: 'break-word' },
    ];
    render(<QuickInfoSection data={data} fields={fields} />);

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText(/1m 35s/)).toBeInTheDocument();
    expect(screen.getByText('app=demo')).toBeInTheDocument();
    expect(screen.getByText('tier=backend')).toBeInTheDocument();
    expect(screen.getByText('p1')).toBeInTheDocument();
    expect(screen.getByText('p2')).toBeInTheDocument();
    expect(screen.getByText('abc-123-xyz-999')).toBeInTheDocument();
  });

  it('handles refresh button callback', () => {
    const onRefresh = vi.fn();
    const data = { anything: true };
    const fields = [{ key: 'anything', label: 'X' }];
    render(<QuickInfoSection data={data} fields={fields} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalled();
  });
});
