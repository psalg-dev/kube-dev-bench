import TerminalTab from './TerminalTab';

type ConsoleTabProps = {
  command?: string;
  podExec?: boolean;
  namespace?: string;
  podName?: string;
  swarmExec?: boolean;
  swarmTaskId?: string;
  shell?: string;
  _onClose?: (() => void) | null;
};

export default function ConsoleTab({
  command = '',
  podExec = false,
  namespace = '',
  podName = '',
  swarmExec = false,
  swarmTaskId = '',
  shell = 'auto',
}: ConsoleTabProps) {
  return (
    <TerminalTab
      command={command}
      podExec={podExec}
      namespace={namespace}
      podName={podName}
      swarmExec={swarmExec}
      swarmTaskId={swarmTaskId}
      shell={shell}
    />
  );
}
