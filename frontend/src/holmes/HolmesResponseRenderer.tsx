import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import type { ReactNode, CSSProperties } from 'react';

export type HolmesResponse = {
  response?: string;
  Response?: string;
  analysis?: string;
  Analysis?: string;
  rich_output?: unknown;
  RichOutput?: unknown;
};

export type HolmesResponseRendererProps = {
  text?: string;
  response?: HolmesResponse | null;
};

export function HolmesResponseRenderer({ text, response }: HolmesResponseRendererProps) {
  const renderText =
    text
    || response?.response
    || response?.Response
    || response?.analysis
    || response?.Analysis
    || '';

  if (!renderText) {
    return null;
  }

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard errors in restricted environments
    }
  };

  const components = {
    a({ children, href, ...props }: React.ComponentPropsWithoutRef<'a'>) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    },
    code({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean; children?: ReactNode }) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const inline = (props as { inline?: boolean }).inline;
      const { style: _style, ...restProps } = props;
      void _style;

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
            style={prismTheme}
            language={match ? match[1] : 'text'}
            PreTag="div"
            className="holmes-code-block"
            {...restProps}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    },
  } as Components;

  const richOutput = response?.rich_output ?? response?.RichOutput;
  const prismTheme = vscDarkPlus as unknown as Record<string, CSSProperties>;
  const richText = richOutput !== undefined ? JSON.stringify(richOutput, null, 2) ?? '' : '';

  return (
    <div>
      <div className="holmes-rendered-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={components}
        >
          {renderText}
        </ReactMarkdown>
      </div>

      {richOutput !== undefined && richOutput !== null && (
        <div className="holmes-rich-output">
          <div className="holmes-rich-output-title">Additional Information</div>
          <pre>{richText}</pre>
        </div>
      )}
    </div>
  );
}

export default HolmesResponseRenderer;
