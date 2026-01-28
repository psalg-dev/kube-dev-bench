import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import ConsoleTab from '../layout/bottompanel/ConsoleTab';

// Mock TerminalTab
vi.mock('../layout/bottompanel/TerminalTab', () => ({
  default: function MockTerminalTab({
    command,
    podExec,
    namespace,
    podName,
    swarmExec,
    swarmTaskId,
    shell,
  }) {
    return (
      <div data-testid="mock-terminal-tab">
        <div data-testid="command">{command}</div>
        <div data-testid="pod-exec">{String(podExec)}</div>
        <div data-testid="namespace">{namespace}</div>
        <div data-testid="pod-name">{podName}</div>
        <div data-testid="swarm-exec">{String(swarmExec)}</div>
        <div data-testid="swarm-task-id">{swarmTaskId}</div>
        <div data-testid="shell">{shell}</div>
      </div>
    );
  },
}));

describe('ConsoleTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders TerminalTab component', () => {
      const { getByTestId } = render(<ConsoleTab />);

      expect(getByTestId('mock-terminal-tab')).toBeInTheDocument();
    });
  });

  describe('prop forwarding', () => {
    it('forwards command prop', () => {
      const { getByTestId } = render(<ConsoleTab command="ls -la" />);

      expect(getByTestId('command').textContent).toBe('ls -la');
    });

    it('forwards podExec prop', () => {
      const { getByTestId } = render(<ConsoleTab podExec={true} />);

      expect(getByTestId('pod-exec').textContent).toBe('true');
    });

    it('defaults podExec to false', () => {
      const { getByTestId } = render(<ConsoleTab />);

      expect(getByTestId('pod-exec').textContent).toBe('false');
    });

    it('forwards namespace prop', () => {
      const { getByTestId } = render(<ConsoleTab namespace="default" />);

      expect(getByTestId('namespace').textContent).toBe('default');
    });

    it('forwards podName prop', () => {
      const { getByTestId } = render(<ConsoleTab podName="my-pod" />);

      expect(getByTestId('pod-name').textContent).toBe('my-pod');
    });

    it('forwards swarmExec prop', () => {
      const { getByTestId } = render(<ConsoleTab swarmExec={true} />);

      expect(getByTestId('swarm-exec').textContent).toBe('true');
    });

    it('defaults swarmExec to false', () => {
      const { getByTestId } = render(<ConsoleTab />);

      expect(getByTestId('swarm-exec').textContent).toBe('false');
    });

    it('forwards swarmTaskId prop', () => {
      const { getByTestId } = render(<ConsoleTab swarmTaskId="task-123" />);

      expect(getByTestId('swarm-task-id').textContent).toBe('task-123');
    });

    it('defaults swarmTaskId to empty string', () => {
      const { getByTestId } = render(<ConsoleTab />);

      expect(getByTestId('swarm-task-id').textContent).toBe('');
    });

    it('forwards shell prop', () => {
      const { getByTestId } = render(<ConsoleTab shell="/bin/bash" />);

      expect(getByTestId('shell').textContent).toBe('/bin/bash');
    });

    it('defaults shell to auto', () => {
      const { getByTestId } = render(<ConsoleTab />);

      expect(getByTestId('shell').textContent).toBe('auto');
    });
  });

  describe('combined props for pod exec', () => {
    it('forwards all pod exec related props', () => {
      const { getByTestId } = render(
        <ConsoleTab
          podExec={true}
          namespace="production"
          podName="web-pod-123"
          shell="/bin/sh"
        />,
      );

      expect(getByTestId('pod-exec').textContent).toBe('true');
      expect(getByTestId('namespace').textContent).toBe('production');
      expect(getByTestId('pod-name').textContent).toBe('web-pod-123');
      expect(getByTestId('shell').textContent).toBe('/bin/sh');
    });
  });

  describe('combined props for swarm exec', () => {
    it('forwards all swarm exec related props', () => {
      const { getByTestId } = render(
        <ConsoleTab
          swarmExec={true}
          swarmTaskId="task-abc123"
          shell="/bin/ash"
        />,
      );

      expect(getByTestId('swarm-exec').textContent).toBe('true');
      expect(getByTestId('swarm-task-id').textContent).toBe('task-abc123');
      expect(getByTestId('shell').textContent).toBe('/bin/ash');
    });
  });

  describe('combined props for local command', () => {
    it('forwards command without exec flags', () => {
      const { getByTestId } = render(<ConsoleTab command="echo Hello World" />);

      expect(getByTestId('command').textContent).toBe('echo Hello World');
      expect(getByTestId('pod-exec').textContent).toBe('false');
      expect(getByTestId('swarm-exec').textContent).toBe('false');
    });
  });
});
