import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownText({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text.length > 600;
  const displayedText = isLong && !isExpanded ? text.slice(0, 300) + '...' : text;

  return (
    <div className="markdown-render font-sans text-sm leading-relaxed text-text-main">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {displayedText}
      </ReactMarkdown>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-accent-primary font-bold hover:text-accent-primary/80 bg-transparent border-none cursor-pointer mt-2 underline"
        >
          {isExpanded ? 'Collapse Message' : 'Read Full Message'}
        </button>
      )}
    </div>
  );
}
