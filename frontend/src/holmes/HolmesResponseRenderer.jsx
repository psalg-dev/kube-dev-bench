import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function HolmesResponseRenderer({ text }) {
  if (!text) {
    return null;
  }

  return (
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
        code({ inline, children, ...props }) {
          if (inline) {
            return (
              <code className="holmes-inline-code" {...props}>
                {children}
              </code>
            );
          }
          return (
            <pre className="holmes-code-block" {...props}>
              <code>{children}</code>
            </pre>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export default HolmesResponseRenderer;
