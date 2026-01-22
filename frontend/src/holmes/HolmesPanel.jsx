import React, { useState, useRef, useEffect } from 'react';
import { useHolmes } from './HolmesContext';
import './HolmesPanel.css';

/**
 * HolmesPanel - Right-side collapsible panel for Holmes AI queries
 */
export function HolmesPanel() {
  const { state, askHolmes, showConfigModal, hidePanel, clearResponse } = useHolmes();
  const [question, setQuestion] = useState('');
  const inputRef = useRef(null);
  const responseRef = useRef(null);

  // Focus input when panel opens
  useEffect(() => {
    if (state.showPanel && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.showPanel]);

  // Auto-scroll response into view
  useEffect(() => {
    if (state.response && responseRef.current) {
      responseRef.current.scrollTop = 0;
    }
  }, [state.response]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || state.loading) return;

    try {
      await askHolmes(question);
      setQuestion(''); // Clear input on success
    } catch (err) {
      // Error handled in context
    }
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
    >
      <div className="holmes-panel-header">
        <div className="holmes-panel-title">
          <span className="holmes-icon">🔍</span>
          <h3>Holmes AI</h3>
        </div>
        <div className="holmes-panel-actions">
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
          <p>Holmes AI is not configured.</p>
          <button 
            className="holmes-btn holmes-btn-primary"
            onClick={showConfigModal}
          >
            Configure Holmes
          </button>
        </div>
      ) : (
        <>
          <form className="holmes-form" onSubmit={handleSubmit}>
            <div className="holmes-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                className="holmes-input"
                placeholder="Ask about your cluster..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={state.loading}
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
          </form>

          <div className="holmes-content" ref={responseRef}>
            {state.loading && (
              <div className="holmes-loading">
                <div className="holmes-spinner" data-testid="holmes-spinner"></div>
                <span>Thinking...</span>
              </div>
            )}

            {state.error && !state.loading && (
              <div className="holmes-error">
                <span className="holmes-error-icon">⚠️</span>
                <span>{state.error}</span>
              </div>
            )}

            {state.response && !state.loading && (
              <div className="holmes-response">
                {state.query && (
                  <div className="holmes-query-display">
                    <strong>Q:</strong> {state.query}
                  </div>
                )}
                <div className="holmes-answer">
                  <strong>A:</strong>
                  <div className="holmes-answer-text">
                    {state.response.response || state.response.Response || 'No response received.'}
                  </div>
                </div>
                <button
                  className="holmes-btn holmes-btn-secondary"
                  onClick={clearResponse}
                  style={{ marginTop: 16 }}
                >
                  Clear
                </button>
              </div>
            )}

            {!state.loading && !state.error && !state.response && (
              <div className="holmes-placeholder">
                <p>Ask Holmes anything about your Kubernetes cluster:</p>
                <ul>
                  <li>"Why is my pod crashing?"</li>
                  <li>"What pods are running in default?"</li>
                  <li>"Explain the deployment status"</li>
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default HolmesPanel;
