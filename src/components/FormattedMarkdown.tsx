import React from 'react';

interface FormattedMarkdownProps {
  content: string;
  className?: string;
}

/**
 * FormattedMarkdown renders Gemini responses cleanly without raw Markdown asterisks.
 * Handles headings, bold/italic tokens, bullet lists, numbered lists, and paragraphs.
 */
export function FormattedMarkdown({ content, className = '' }: FormattedMarkdownProps) {
  if (!content) return null;

  const lines = content.split('\n');

  // Inline formatting parser for bold (**text**), italic (*text*), and code (`code`)
  const parseInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="text-white font-semibold">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(
          <em key={match.index} className="text-cyan-200 not-italic font-medium">
            {token.slice(1, -1)}
          </em>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={match.index} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-cyan-300 font-mono text-[11px]">
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  const renderedElements: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];

  const flushList = (keyPrefix: number) => {
    if (currentListItems.length > 0) {
      renderedElements.push(
        <ul key={`ul-${keyPrefix}`} className="space-y-1.5 my-2 list-none pl-0">
          {currentListItems}
        </ul>
      );
      currentListItems = [];
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    if (!line) {
      flushList(idx);
      return;
    }

    // Header 3 or 4: ### or ####
    if (line.startsWith('### ') || line.startsWith('#### ')) {
      flushList(idx);
      const headingText = line.replace(/^#{3,4}\s+/, '');
      renderedElements.push(
        <h4 key={`h-${idx}`} className="text-xs font-bold font-mono uppercase text-cyan-300 tracking-wider mt-2.5 mb-1 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          {parseInline(headingText)}
        </h4>
      );
      return;
    }

    // Header 2: ##
    if (line.startsWith('## ')) {
      flushList(idx);
      const headingText = line.replace(/^##\s+/, '');
      renderedElements.push(
        <h3 key={`h-${idx}`} className="text-sm font-bold font-mono uppercase text-white tracking-wide mt-3 mb-1.5">
          {parseInline(headingText)}
        </h3>
      );
      return;
    }

    // Bullet list: * or - or •
    const bulletMatch = line.match(/^([*\-•])\s+(.*)/);
    if (bulletMatch) {
      const itemContent = bulletMatch[2];
      currentListItems.push(
        <li key={`li-${idx}`} className="flex items-start gap-2 text-slate-200">
          <span className="text-cyan-400 text-xs leading-5 select-none shrink-0">•</span>
          <span className="leading-relaxed flex-1">{parseInline(itemContent)}</span>
        </li>
      );
      return;
    }

    // Numbered list: 1. or 2.
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      flushList(idx);
      renderedElements.push(
        <div key={`num-${idx}`} className="flex items-start gap-2 text-slate-200 my-1">
          <span className="text-cyan-400 font-mono text-[11px] select-none font-bold shrink-0">{numMatch[1]}.</span>
          <span className="leading-relaxed flex-1">{parseInline(numMatch[2])}</span>
        </div>
      );
      return;
    }

    // Regular line / paragraph
    flushList(idx);
    renderedElements.push(
      <p key={`p-${idx}`} className="leading-relaxed text-slate-200 my-1">
        {parseInline(line)}
      </p>
    );
  });

  flushList(lines.length);

  return <div className={`space-y-1 ${className}`}>{renderedElements}</div>;
}
