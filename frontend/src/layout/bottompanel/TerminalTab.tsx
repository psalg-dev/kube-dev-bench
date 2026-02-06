import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { EventsOn } from '../../../wailsjs/runtime';
import * as AppAPI from '../../../wailsjs/go/main/App';

type TerminalTabProps = {
  command?: string;
  podExec?: boolean;
  namespace?: string;
  podName?: string;
  swarmExec?: boolean;
  swarmTaskId?: string;
  shell?: string;
};

type Unsubscriber = (() => void) | undefined | null;

type XtermResize = { cols: number; rows: number };

type XtermDisposable = { dispose?: () => void };

type OutputPayload = string | string[] | null | undefined;

type OutputHandler = (data: OutputPayload) => void;

type ExitHandler = (msg: OutputPayload) => void;

export default function TerminalTab({
  command,
  podExec,
  namespace,
  podName,
  swarmExec,
  swarmTaskId,
  shell,
}: TerminalTabProps) {
  const termRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIDRef = useRef('');
  const unsubscribersRef = useRef<Unsubscriber[]>([]);

  useEffect(() => {
    unsubscribersRef.current.forEach((off) => {
      try {
        if (off) off();
      } catch {
        /* ignore */
      }
    });
    unsubscribersRef.current = [];

    if (!termRef.current) return;

    if (xtermRef.current) {
      try {
        xtermRef.current.dispose();
      } catch {
        /* ignore */
      }
      xtermRef.current = null;
    }

    const xterm = new Terminal({
      cursorBlink: true,
      fontFamily: 'monospace',
      fontSize: 15,
      theme: {
        background: '#181c20',
        foreground: '#e0e0e0',
      },
      convertEol: true,
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(termRef.current);
    fitAddon.fit();
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      try {
        fitAddon.fit();
        const cols = xterm.cols;
        const rows = xterm.rows;
        const sid = sessionIDRef.current;
        if (sid) AppAPI.ResizeShellSession(sid, cols, rows).catch(() => {});
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('resize', handleResize);

    const sessionID = crypto.randomUUID();
    sessionIDRef.current = sessionID;

    const outputEvent = `terminal:${sessionID}:output`;
    const exitEvent = `terminal:${sessionID}:exit`;

    const offOut = EventsOn(outputEvent, ((data: OutputPayload) => {
      const text = Array.isArray(data) ? data.join(' ') : String(data ?? '');
      xterm.write(text);
    }) as OutputHandler);
    const offExit = EventsOn(exitEvent, ((msg: OutputPayload) => {
      const text = Array.isArray(msg) ? msg.join(' ') : String(msg ?? '[session closed]');
      xterm.writeln(`\r\n${text}`);
    }) as ExitHandler);
    unsubscribersRef.current.push(offOut, offExit);

    if (podExec && namespace && podName) {
      const sh = shell && shell.trim() ? shell.trim() : 'auto';
      AppAPI.StartPodExecSession(sessionID, namespace, podName, sh).catch((err: unknown) => {
        xterm.write(`\r\nPod exec error: ${(err as Error)?.message || err}\r\n`);
      });
    } else if (swarmExec && swarmTaskId) {
      const sh = shell && shell.trim() ? shell.trim() : 'auto';
      AppAPI.StartSwarmTaskExecSession(sessionID, swarmTaskId, sh).catch((err: unknown) => {
        xterm.write(`\r\nSwarm exec error: ${(err as Error)?.message || err}\r\n`);
      });
    } else {
      AppAPI.StartShellSession(sessionID, command || '').catch((err: unknown) => {
        xterm.write(`\r\nShell error: ${(err as Error)?.message || err}\r\n`);
      });
    }

    const dataDisp: XtermDisposable | undefined = xterm.onData((data) => {
      AppAPI.SendShellInput(sessionID, data).catch(() => {});
    });

    const resizeDisp: XtermDisposable | undefined = xterm.onResize(({ cols, rows }: XtermResize) => {
      const sid = sessionIDRef.current;
      if (sid) AppAPI.ResizeShellSession(sid, cols, rows).catch(() => {});
    });

    setTimeout(() => {
      handleResize();
    }, 100);

    return () => {
      unsubscribersRef.current.forEach((off) => {
        try {
          if (off) off();
        } catch {
          /* ignore */
        }
      });
      unsubscribersRef.current = [];
      try {
        dataDisp?.dispose && dataDisp.dispose();
      } catch {}
      try {
        resizeDisp?.dispose && resizeDisp.dispose();
      } catch {}
      try {
        xterm.dispose();
      } catch {}
      window.removeEventListener('resize', handleResize);
      const sid = sessionIDRef.current;
      if (sid) AppAPI.StopShellSession(sid).catch(() => {});
      sessionIDRef.current = '';
    };
  }, [command, podExec, namespace, podName, shell, swarmExec, swarmTaskId]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#181c20',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        textAlign: 'left',
      }}
    >
      <div ref={termRef} style={{ width: '100%', height: '100%', textAlign: 'left' }} />
    </div>
  );
}
