import TerminalTab from './TerminalTab';

// This component wraps TerminalTab and forwards props for either a local command
// or a pod exec session.
export default function ConsoleTab({ command, podExec = false, namespace, podName, swarmExec = false, swarmTaskId = '', shell = 'auto', _onClose }) {
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
