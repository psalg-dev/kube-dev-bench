import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HolmesBottomPanel from '../holmes/HolmesBottomPanel';

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

    expect(screen.getByRole('button', { name: /Analyze with Holmes/i })).toBeInTheDocument();
    expect(screen.getByText(/AI-powered insights/i)).toBeInTheDocument();
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

    expect(screen.getByText('Waiting for first response')).toBeInTheDocument();
    expect(document.querySelector('.holmes-bottom-panel-analyzing-tag')).toHaveTextContent('Analyzing...');
  });

  it('shows stop button when loading and onCancel provided', () => {
    const onCancel = vi.fn();
    render(
      <HolmesBottomPanel
        kind="Pod"
        namespace="default"
        name="demo"
        onAnalyze={vi.fn()}
        onCancel={onCancel}
        response={null}
        loading={true}
        error={null}
      />
    );

    const stopButton = screen.getByTitle('Stop analysis');
    expect(stopButton).toBeInTheDocument();
    fireEvent.click(stopButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not show stop button when onCancel is not provided', () => {
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

    expect(screen.queryByTitle('Stop analysis')).not.toBeInTheDocument();
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

