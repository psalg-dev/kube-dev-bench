import React from 'react';
import TerminalTab from './Terminal';

// This component wraps TerminalTab and forwards props for either a local command
// or a pod exec session.
export default function Console({ command, podExec = false, namespace, podName, shell = 'auto', onClose }) {
  return (
    <TerminalTab
      command={command}
      podExec={podExec}
      namespace={namespace}
      podName={podName}
      shell={shell}
    />
  );
}
