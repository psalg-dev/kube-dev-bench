import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../components/CodeMirrorEditor', () => {
  const MockEditor = ({ value }) => (
    <textarea data-testid="code-mirror-editor" value={value} readOnly />
  );
  return { default: MockEditor, EditorLoading: () => null };
});

import YamlTab from '../layout/bottompanel/YamlTab.jsx';
beforeEach(() => {
  document.body.innerHTML = '';
});

describe('YamlTab', () => {
  it('shows loading state', () => {
    const { getByText } = render(<YamlTab loading content="" />);
    expect(getByText(/loading yaml/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    const { getByText } = render(<YamlTab error="Boom" />);
    expect(getByText('Error loading YAML:')).toBeInTheDocument();
    expect(getByText('Boom')).toBeInTheDocument();
  });

  it('creates editor with initial content', () => {
    render(<YamlTab content="apiVersion: v1" />);
    expect(screen.getByTestId('code-mirror-editor').value).toBe('apiVersion: v1');
  });

  it('updates editor content on content change (no recreate)', () => {
    const { rerender } = render(<YamlTab content="kind: Pod" />);
    expect(screen.getByTestId('code-mirror-editor').value).toBe('kind: Pod');
    rerender(<YamlTab content="kind: Deployment" />);
    expect(screen.getByTestId('code-mirror-editor').value).toBe('kind: Deployment');
  });
});
