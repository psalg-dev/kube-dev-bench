/**
 * Editor Loading Placeholder
 * 
 * Loading skeleton displayed while CodeMirror is being lazy loaded.
 * Matches the visual appearance of the editor to prevent layout shift.
 */
import './EditorLoading.css';

export default function EditorLoading({ 
  height = '100%', 
  showLineNumbers = true,
  message = 'Loading editor...'
}) {
  return (
    <div className="editor-loading" style={{ height }}>
      {showLineNumbers && (
        <div className="editor-loading-gutter">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
            <div key={n} className="editor-loading-line-number">{n}</div>
          ))}
        </div>
      )}
      <div className="editor-loading-content">
        <div className="editor-loading-lines">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
            <div key={n} className="editor-loading-line">
              <div 
                className="editor-loading-skeleton" 
                style={{ width: `${30 + Math.random() * 60}%` }}
              />
            </div>
          ))}
        </div>
        <div className="editor-loading-message">
          <span className="editor-loading-spinner" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}
