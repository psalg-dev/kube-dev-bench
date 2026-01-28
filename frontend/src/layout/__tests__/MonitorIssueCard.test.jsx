import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MonitorIssueCard from '../MonitorIssueCard.jsx';

const issue = {
  issueID: 'pod-default-crashloop',
  type: 'error',
  resource: 'Pod',
  name: 'crash-pod',
  namespace: 'default',
  reason: 'CrashLoopBackOff',
  message: 'Container keeps crashing',
  containerName: 'app',
  restartCount: 3,
  holmesAnalysis: 'Analysis text',
  holmesAnalyzedAt: new Date().toISOString(),
};

describe('MonitorIssueCard', () => {
  it('renders issue details', () => {
    const onNavigate = vi.fn();
    render(
      <MonitorIssueCard
        issue={issue}
        onNavigate={onNavigate}
        onAnalyze={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByText('CrashLoopBackOff')).toBeInTheDocument();
    expect(screen.getByText('Container keeps crashing')).toBeInTheDocument();
  });

  it('toggles Holmes analysis section', () => {
    render(
      <MonitorIssueCard
        issue={issue}
        onNavigate={() => {}}
        onAnalyze={() => {}}
        onDismiss={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Show Analysis'));
    expect(screen.getByText('Analysis text')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hide Analysis'));
    expect(screen.queryByText('Analysis text')).toBeNull();
  });

  it('calls analyze and dismiss handlers', () => {
    const onAnalyze = vi.fn();
    const onDismiss = vi.fn();
    render(
      <MonitorIssueCard
        issue={issue}
        onNavigate={() => {}}
        onAnalyze={onAnalyze}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByText('Analyze'));
    fireEvent.click(screen.getByText('Dismiss'));

    expect(onAnalyze).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows loading states', () => {
    render(
      <MonitorIssueCard
        issue={issue}
        onNavigate={() => {}}
        onAnalyze={() => {}}
        onDismiss={() => {}}
        analyzing={true}
        dismissing={true}
      />,
    );

    expect(screen.getByText('Analyzing…')).toBeInTheDocument();
    expect(screen.getByText('Dismissing…')).toBeInTheDocument();
  });
});
