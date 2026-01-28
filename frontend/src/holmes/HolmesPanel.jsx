import { useState, useRef, useEffect } from 'react';
import { useHolmes } from './HolmesContext';
import { HolmesResponseRenderer } from './HolmesResponseRenderer';
import './HolmesPanel.css';

/**
 * Checks if an error message indicates a connection/DNS issue that can be fixed by reconnecting
 */
function isConnectionError(error) {
  if (!error) return false;
  const errorLower = error.toLowerCase();
  return (
    errorLower.includes('no such host') ||
    errorLower.includes('connection refused') ||
    errorLower.includes('dial tcp') ||
    errorLower.includes('network is unreachable') ||
    errorLower.includes('port-forward')
  );
}

/**
 * HolmesPanel - Right-side collapsible panel for Holmes AI queries
 */
export function HolmesPanel() {
  const {
    state,
    askHolmes,
    cancelHolmes,
    showConfigModal,
    hidePanel,
    clearResponse,
    showOnboarding,
    reconnectHolmes,
  } = useHolmes();
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [toolsCollapsed, setToolsCollapsed] = useState(true);
  const [panelWidth, setPanelWidth] = useState(400);
  const isResizingRef = useRef(false);
  const inputRef = useRef(null);
  const responseRef = useRef(null);
  const panelRef = useRef(null);
  const lastQueryRef = useRef(null);
  const lastResponseRef = useRef(null);
  const lastErrorRef = useRef(null);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const responseText =
    [
      state.response?.response,
      state.response?.Response,
      state.response?.analysis,
      state.response?.Analysis,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) ||
    '';

  // Focus input when panel opens
  useEffect(() => {
    if (state.showPanel && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.showPanel]);

  // Auto-scroll response into view
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [conversation, state.loading, state.streamingText]);

  useEffect(() => {
    if (!state.loading) {
      setToolsCollapsed(true);
    }
  }, [state.loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || state.loading) return;

    try {
      await askHolmes(question);
      setQuestion(''); // Clear input on success
    } catch (_err) {
      // Error handled in context
    }
  };

  const handleComposerKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (!state.query || !state.queryTimestamp) return;
    if (lastQueryRef.current === state.queryTimestamp) return;

    setConversation((prev) => [
      ...prev,
      { type: 'question', text: state.query, timestamp: state.queryTimestamp },
    ]);
    lastQueryRef.current = state.queryTimestamp;
  }, [state.query, state.queryTimestamp]);

  useEffect(() => {
    if (!responseText || !state.responseTimestamp) return;
    if (lastResponseRef.current === state.responseTimestamp) return;

    setConversation((prev) => [
      ...prev,
      {
        type: 'response',
        data: state.response,
        timestamp: state.responseTimestamp,
      },
    ]);
    lastResponseRef.current = state.responseTimestamp;
  }, [responseText, state.response, state.responseTimestamp]);

  useEffect(() => {
    if (!state.error || state.loading) return;
    if (lastErrorRef.current === state.error) return;

    setConversation((prev) => [
      ...prev,
      { type: 'error', text: state.error, timestamp: new Date().toISOString() },
    ]);
    lastErrorRef.current = state.error;
  }, [state.error, state.loading]);

  const handleClearConversation = () => {
    setConversation([]);
    lastQueryRef.current = null;
    lastResponseRef.current = null;
    lastErrorRef.current = null;
    clearResponse();
  };

  const handleExportConversation = () => {
    const text = conversation
      .map((item) => {
        const time = formatTimestamp(item.timestamp);
        if (item.type === 'question') {
          return `[${time}] You: ${item.text}`;
        }
        if (item.type === 'response') {
          const body = item.data?.response || item.data?.analysis || '';
          return `[${time}] Holmes: ${body}`;
        }
        return `[${time}] Error: ${item.text}`;
      })
      .join('\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `holmes-conversation-${Date.now()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;
      const viewportWidth = window.innerWidth || 0;
      const minWidth = 320;
      const maxWidth = Math.min(Math.round(viewportWidth * 0.6), viewportWidth);
      const nextWidth = Math.max(
        minWidth,
        Math.min(maxWidth, viewportWidth - e.clientX),
      );
      setPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.classList.remove('holmes-resizing');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizeStart = (e) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.classList.add('holmes-resizing');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      hidePanel();
    }
  };

  if (!state.showPanel) return null;

  return (
    <div
      id="holmes-panel"
      className="holmes-panel"
      onKeyDown={handleKeyDown}
      style={{ width: panelWidth }}
      ref={panelRef}
    >
      <div
        className="holmes-resize-handle"
        onMouseDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Holmes panel"
      />
      <div className="holmes-panel-header">
        <div className="holmes-panel-title">
          <span className="holmes-icon">🔍</span>
          <h3>Holmes AI</h3>
        </div>
        <div className="holmes-panel-actions">
          {conversation.length > 0 && (
            <>
              <button
                className="holmes-btn holmes-btn-icon"
                onClick={handleExportConversation}
                title="Export conversation"
              >
                ⬇️
              </button>
              <button
                className="holmes-btn holmes-btn-icon"
                onClick={handleClearConversation}
                title="Clear conversation"
              >
                🧹
              </button>
            </>
          )}
          <button
            id="holmes-config-btn"
            className="holmes-btn holmes-btn-icon"
            onClick={showConfigModal}
            title="Configure Holmes"
          >
            ⚙️
          </button>
          <button
            className="holmes-btn holmes-btn-icon"
            onClick={hidePanel}
            title="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      {!state.configured ? (
        <div className="holmes-unconfigured">
          <div className="holmes-unconfigured-icon">🔍</div>
          <h4>Holmes AI is not configured</h4>
          <p>
            Set up Holmes to get AI-powered troubleshooting for your cluster.
          </p>

          <div className="holmes-unconfigured-actions">
            <button
              className="holmes-btn holmes-btn-primary"
              onClick={showOnboarding}
              id="holmes-deploy-btn"
            >
              🚀 Deploy Holmes
            </button>
            <button
              className="holmes-btn"
              onClick={showConfigModal}
              id="holmes-manual-config-btn"
            >
              ⚙️ Manual Configuration
            </button>
          </div>

          <p className="holmes-unconfigured-hint">
            Use &quot;Deploy Holmes&quot; to automatically install HolmesGPT in
            your cluster, or &quot;Manual Configuration&quot; if you already
            have Holmes running.
          </p>
        </div>
      ) : (
        <>
          <div className="holmes-body">
            <div className="holmes-content" ref={responseRef}>
              <div className="holmes-message-list">
                {state.reasoningText && (
                  <div className="holmes-message holmes-message-insight">
                    <div className="holmes-message-header">Reasoning</div>
                    <div className="holmes-message-body">
                      <div className="holmes-reasoning-text">
                        {state.reasoningText}
                      </div>
                    </div>
                  </div>
                )}

                {state.toolEvents &&
                  state.toolEvents.length > 0 &&
                  (() => {
                    const successCount = state.toolEvents.filter(
                      (t) => t.status === 'success',
                    ).length;
                    const errorCount = state.toolEvents.filter(
                      (t) => t.status === 'error',
                    ).length;
                    const approvalCount = state.toolEvents.filter(
                      (t) => t.status === 'approval_required',
                    ).length;
                    const totalCount = state.toolEvents.length;

                    return (
                      <div
                        className={`holmes-tool-events ${state.loading ? '' : 'holmes-tool-events-collapsed'}`}
                      >
                        <button
                          type="button"
                          className="holmes-tool-events-toggle"
                          onClick={() => setToolsCollapsed((prev) => !prev)}
                          aria-expanded={!toolsCollapsed}
                        >
                          <span className="holmes-tool-events-title">
                            Tool activity
                          </span>
                          <span className="holmes-tool-events-summary">
                            <span className="holmes-tool-summary-count">
                              {totalCount} tools
                            </span>
                            <span className="holmes-tool-summary-indicators">
                              <span className="holmes-tool-indicator holmes-tool-indicator-success">
                                <span className="holmes-tool-dot holmes-tool-dot-success" />
                                {successCount}
                              </span>
                              <span className="holmes-tool-indicator holmes-tool-indicator-error">
                                <span className="holmes-tool-dot holmes-tool-dot-error" />
                                {errorCount}
                              </span>
                              {approvalCount > 0 && (
                                <span className="holmes-tool-indicator holmes-tool-indicator-approval">
                                  <span className="holmes-tool-dot holmes-tool-dot-approval_required" />
                                  {approvalCount}
                                </span>
                              )}
                            </span>
                          </span>
                          <span
                            className="holmes-tool-events-chevron"
                            aria-hidden="true"
                          >
                            {toolsCollapsed ? '▾' : '▴'}
                          </span>
                        </button>

                        {state.loading || !toolsCollapsed ? (
                          <ul className="holmes-tool-events-list">
                            {state.toolEvents.map((tool) => (
                              <li
                                key={tool.id}
                                className={`holmes-tool-event holmes-tool-${tool.status}`}
                              >
                                <span
                                  className={`holmes-tool-dot holmes-tool-dot-${tool.status}`}
                                  aria-hidden="true"
                                />
                                <span className="holmes-tool-name">
                                  {tool.name}
                                </span>
                                <span className="holmes-tool-status">
                                  {tool.status}
                                </span>
                                {tool.description && (
                                  <span className="holmes-tool-desc">
                                    {tool.description}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })()}

                {state.error && !state.loading && (
                  <div className="holmes-message holmes-message-error">
                    <div className="holmes-message-header">Error</div>
                    <div className="holmes-message-body">
                      <div className="holmes-error">
                        <span className="holmes-error-icon">⚠️</span>
                        <span>{state.error}</span>
                      </div>
                      {isConnectionError(state.error) && (
                        <button
                          className="holmes-btn holmes-btn-primary"
                          onClick={async () => {
                            setReconnecting(true);
                            try {
                              await reconnectHolmes();
                            } finally {
                              setReconnecting(false);
                            }
                          }}
                          disabled={reconnecting}
                          style={{ marginTop: 12 }}
                        >
                          {reconnecting ? 'Reconnecting...' : '🔄 Reconnect'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {conversation.map((item, idx) => (
                  <div
                    key={`${item.type}-${item.timestamp || idx}`}
                    className={`holmes-message ${item.type === 'question' ? 'holmes-message-user' : item.type === 'response' ? 'holmes-message-assistant' : 'holmes-message-error'}`}
                  >
                    <div className="holmes-message-header">
                      <span>
                        {item.type === 'question'
                          ? 'You'
                          : item.type === 'response'
                            ? 'Holmes'
                            : 'Error'}
                      </span>
                      <span className="holmes-message-timestamp">
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>
                    <div className="holmes-message-body">
                      {item.type === 'question' && item.text}
                      {item.type === 'response' && (
                        <HolmesResponseRenderer response={item.data} />
                      )}
                      {item.type === 'error' && (
                        <div className="holmes-error">
                          <span className="holmes-error-icon">⚠️</span>
                          <span>{item.text}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {state.loading && (
                  <div className="holmes-message holmes-message-assistant holmes-message-loading">
                    <div className="holmes-message-header">
                      <span>Holmes</span>
                      <span className="holmes-message-timestamp">
                        {formatTimestamp(state.queryTimestamp)}
                      </span>
                    </div>
                    <div className="holmes-message-body">
                      <div className="holmes-loading">
                        <div
                          className="holmes-spinner"
                          data-testid="holmes-spinner"
                        ></div>
                        <span>
                          {state.streamingText ? 'Streaming...' : 'Thinking...'}
                        </span>
                        <button
                          type="button"
                          className="holmes-btn holmes-btn-secondary holmes-cancel-btn"
                          onClick={cancelHolmes}
                        >
                          Cancel
                        </button>
                      </div>
                      {state.streamingText && (
                        <div className="holmes-streaming-text">
                          {state.streamingText}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!state.loading &&
                  !state.error &&
                  conversation.length === 0 && (
                    <div className="holmes-message holmes-message-placeholder">
                      <div className="holmes-message-header">Start here</div>
                      <div className="holmes-message-body holmes-placeholder">
                        <p>
                          Ask Holmes anything about your Kubernetes cluster:
                        </p>
                        <ul>
                          <li>&quot;Why is my pod crashing?&quot;</li>
                          <li>&quot;What pods are running in default?&quot;</li>
                          <li>&quot;Explain the deployment status&quot;</li>
                        </ul>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            <form className="holmes-composer" onSubmit={handleSubmit}>
              <div className="holmes-composer-input-wrapper">
                <textarea
                  ref={inputRef}
                  className="holmes-composer-input"
                  placeholder="Ask about your cluster..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  disabled={state.loading}
                  rows={2}
                />
                <button
                  type="submit"
                  className="holmes-btn holmes-btn-submit"
                  disabled={state.loading || !question.trim()}
                  title="Ask Holmes"
                >
                  {state.loading ? '...' : '→'}
                </button>
              </div>
              <div className="holmes-composer-hint">
                Ctrl+Enter to send, Shift+Enter for a new line.
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export default HolmesPanel;
