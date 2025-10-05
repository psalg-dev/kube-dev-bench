import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { EventsOn } from '../../../wailsjs/runtime';
import * as AppAPI from '../../../wailsjs/go/main/App';
import { v4 as uuidv4 } from 'uuid';

export default function TerminalTab({ command, podExec, namespace, podName, shell }) {
  const termRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const sessionIDRef = useRef('');
  const unsubscribersRef = useRef([]);

  useEffect(() => {
    // cleanup any previous session
    unsubscribersRef.current.forEach(off => {
      try { off && off(); } catch { /* ignore */ }
    });
    unsubscribersRef.current = [];

    if (!termRef.current) return;

    if (xtermRef.current) {
      try { xtermRef.current.dispose(); } catch { /* ignore */ }
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
        // send new size to backend
        const cols = xterm.cols;
        const rows = xterm.rows;
        const sid = sessionIDRef.current;
        if (sid) AppAPI.ResizeShellSession(sid, cols, rows).catch(() => {});
      } catch {/* ignore */}
    };
    window.addEventListener('resize', handleResize);

    const sessionID = uuidv4();
    sessionIDRef.current = sessionID;

    const outputEvent = `terminal:${sessionID}:output`;
    const exitEvent = `terminal:${sessionID}:exit`;

    const offOut = EventsOn(outputEvent, data => {
      // Wails may deliver strings or arrays; coerce to string
      const text = Array.isArray(data) ? data.join(' ') : String(data ?? '');
      xterm.write(text);
    });
    const offExit = EventsOn(exitEvent, msg => {
      const text = Array.isArray(msg) ? msg.join(' ') : String(msg ?? '[session closed]');
      xterm.writeln(`\r\n${text}`);
    });
    unsubscribersRef.current.push(offOut, offExit);

    // Start session: local shell or pod exec
    if (podExec && namespace && podName) {
      const sh = shell && shell.trim() ? shell.trim() : 'auto';
      AppAPI.StartPodExecSession(sessionID, namespace, podName, sh).catch(err => {
        xterm.write(`\r\nPod exec error: ${err?.message || err}\r\n`);
      });
    } else {
      AppAPI.StartShellSession(sessionID, command || '').catch(err => {
        xterm.write(`\r\nShell error: ${err?.message || err}\r\n`);
      });
    }

    // Handle input from xterm
    const dataDisp = xterm.onData(data => {
      AppAPI.SendShellInput(sessionID, data).catch(() => {});
    });

    const resizeDisp = xterm.onResize(({ cols, rows }) => {
      const sid = sessionIDRef.current;
      if (sid) AppAPI.ResizeShellSession(sid, cols, rows).catch(() => {});
    });

    // send initial size a moment after render
    setTimeout(() => {
      handleResize();
    }, 100);

    return () => {
      // unsubscribe events
      unsubscribersRef.current.forEach(off => {
        try { off && off(); } catch { /* ignore */ }
      });
      unsubscribersRef.current = [];
      // dispose xterm
      try { dataDisp?.dispose && dataDisp.dispose(); } catch {}
      try { resizeDisp?.dispose && resizeDisp.dispose(); } catch {}
      try { xterm.dispose(); } catch {}
      window.removeEventListener('resize', handleResize);
      // stop backend session
      const sid = sessionIDRef.current;
      if (sid) AppAPI.StopShellSession(sid).catch(() => {});
      sessionIDRef.current = '';
    };
  }, [command, podExec, namespace, podName, shell]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#181c20', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-start', textAlign: 'left' }}>
      <div ref={termRef} style={{ width: '100%', height: '100%', textAlign: 'left' }} />
    </div>
  );
}
