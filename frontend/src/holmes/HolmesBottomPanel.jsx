import HolmesResponseRenderer from './HolmesResponseRenderer';
import HolmesResourceButton from './HolmesResourceButton';
import './HolmesBottomPanel.css';

export default function HolmesBottomPanel({
  kind,
  namespace,
  name,
  onAnalyze,
  onCancel,
  response,
  loading,
  error,
  queryTimestamp = null,
  streamingText = '',
  reasoningText = '',
  toolEvents = [],
  contextSteps = [],
}) {
  const title = kind ? `${kind} analysis` : 'Holmes analysis';
  const hasStreamOutput = Boolean(streamingText || reasoningText);
  const startedAt = queryTimestamp ? new Date(queryTimestamp) : null;
  const startedLabel = startedAt ? startedAt.toLocaleTimeString() : '';
  const visibleTools = Array.isArray(toolEvents) ? toolEvents.slice(0, 5) : [];
  const visibleSteps = Array.isArray(contextSteps) ? contextSteps.slice(0, 6) : [];

  return (
    <div className="holmes-bottom-panel">
      <div className="holmes-bottom-panel-header">
        <div className="holmes-bottom-panel-title">{title}</div>
      </div>

      {!loading && !error && !response && (
        <div className="holmes-bottom-panel-empty">
          <HolmesResourceButton
            onClick={onAnalyze}
            loading={loading}
            disabled={!name || !namespace}
            label="Analyze with Holmes"
            prominent
          />
          <p>Get AI-powered insights about this resource</p>
        </div>
      )}

      {loading && (
        <div className="holmes-bottom-panel-state">
          <div className="holmes-bottom-panel-spinner" />
          <div className="holmes-bottom-panel-progress">
            <div className="holmes-bottom-panel-analyzing-row">
              <span className="holmes-bottom-panel-analyzing-tag">
                Analyzing...
                {onCancel && (
                  <button
                    type="button"
                    className="holmes-bottom-panel-stop-btn"
                    onClick={onCancel}
                    title="Stop analysis"
                    aria-label="Stop analysis"
                  >
                    <span className="holmes-bottom-panel-stop-icon" />
                  </button>
                )}
              </span>
            </div>
            <ul className="holmes-bottom-panel-progress-list">
              {startedAt && (
                <li>Request started at {startedLabel}</li>
              )}
              <li>{hasStreamOutput ? 'Receiving response from Holmes' : 'Waiting for first response'}</li>
              {visibleSteps.length > 0 && (
                <li>
                  <div className="holmes-bottom-panel-steps">
                    {visibleSteps.map((step) => (
                      <div key={step.id || step.step} className={`holmes-bottom-panel-step holmes-bottom-panel-step-${step.status || 'running'}`}>
                        <span className="holmes-bottom-panel-step-name">{step.step || step.label}</span>
                        <span className="holmes-bottom-panel-step-status">{step.status || 'running'}</span>
                        {step.detail && (
                          <span className="holmes-bottom-panel-step-desc">{step.detail}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </li>
              )}
              {visibleTools.length > 0 && (
                <li>
                  <div className="holmes-bottom-panel-tools">
                    {visibleTools.map((tool) => (
                      <div key={tool.id} className={`holmes-bottom-panel-tool holmes-bottom-panel-tool-${tool.status || 'running'}`}>
                        <span className="holmes-bottom-panel-tool-name">{tool.name || 'tool'}</span>
                        <span className="holmes-bottom-panel-tool-status">{tool.status || 'running'}</span>
                        {tool.description && (
                          <span className="holmes-bottom-panel-tool-desc">{tool.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </li>
              )}
            </ul>
          </div>
          {/* Show streaming text as it arrives */}
          {streamingText && (
            <div className="holmes-bottom-panel-streaming">
              <HolmesResponseRenderer response={{ response: streamingText }} />
            </div>
          )}
        </div>
      )}

      {!loading && error && (
        <div className="holmes-bottom-panel-error">
          <div className="holmes-bottom-panel-error-title">Analysis failed</div>
          <div className="holmes-bottom-panel-error-text">{error}</div>
        </div>
      )}

      {!loading && !error && response && (
        <div className="holmes-bottom-panel-response">
          <HolmesResponseRenderer response={response} />
        </div>
      )}

    </div>
  );
}
