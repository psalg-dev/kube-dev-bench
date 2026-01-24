import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export function HolmesResponseRenderer({ text, response }) {
  const renderText = text
    || response?.response
    || response?.Response
    || response?.analysis
    || response?.Analysis
    || '';

  if (!renderText) {
    return null;
  }

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (_err) {
      // ignore clipboard errors in restricted environments
    }
  };

  return (
    <div>
      <ReactMarkdown
        className="holmes-rendered-content"
        remarkPlugins={[remarkGfm]}
        components={{
          a({ children, href, ...props }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
          code({ inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (inline) {
              return (
                <code className="holmes-inline-code" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <div className="holmes-code-block-wrapper">
                <button
                  type="button"
                  className="holmes-code-copy"
                  onClick={() => handleCopy(codeString)}
                >
                  Copy
                </button>
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match ? match[1] : 'text'}
                  PreTag="div"
                  className="holmes-code-block"
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          },
        }}
      >
        {renderText}
      </ReactMarkdown>

      {(response?.rich_output || response?.RichOutput) && (
        <div className="holmes-rich-output">
          <div className="holmes-rich-output-title">Additional Information</div>
          <pre>{JSON.stringify(response?.rich_output || response?.RichOutput, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default HolmesResponseRenderer;
