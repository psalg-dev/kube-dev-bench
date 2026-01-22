import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import HolmesBottomPanel from '../holmes/HolmesBottomPanel.jsx';

describe('HolmesBottomPanel', () => {
  it('shows empty state when no response', () => {
    render(
      <HolmesBottomPanel
        kind="Pod"
        namespace="default"
        name="demo"
        onAnalyze={vi.fn()}
        response={null}
        loading={false}
        error={null}
      />
    );

    expect(screen.getByText(/Analyze with Holmes/i)).toBeInTheDocument();
    expect(screen.getByText(/context-aware report/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <HolmesBottomPanel
        kind="Pod"
        namespace="default"
        name="demo"
        onAnalyze={vi.fn()}
        response={null}
        loading={true}
        error={null}
      />
    );

    expect(screen.getByText(/analyzing this resource/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      <HolmesBottomPanel
        kind="Pod"
        namespace="default"
        name="demo"
        onAnalyze={vi.fn()}
        response={null}
        loading={false}
        error="Boom"
      />
    );

    expect(screen.getByText(/analysis failed/i)).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });

  it('renders response when available', () => {
    render(
      <HolmesBottomPanel
        kind="Pod"
        namespace="default"
        name="demo"
        onAnalyze={vi.fn()}
        response={{ response: 'All good' }}
        loading={false}
        error={null}
      />
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});
