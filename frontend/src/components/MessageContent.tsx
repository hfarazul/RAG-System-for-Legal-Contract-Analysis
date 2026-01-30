'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';

// Regex to match citations like [Document Name, Section X: Title]
const CITATION_REGEX = /\[([^\]]+,\s*Section[^\]]+)\]/g;


interface CitationProps {
  text: string;
}

function Citation({ text }: CitationProps) {
  const getDocTypeColor = (citation: string) => {
    const lower = citation.toLowerCase();
    if (lower.includes('nda')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    if (lower.includes('sla')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    if (lower.includes('dpa')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    if (lower.includes('vsa')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300';
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDocTypeColor(text)}`}
      title={text}
    >
      {text}
    </span>
  );
}

// Process text to replace citations with placeholder and track them
function processCitations(text: string): { processedText: string; citations: Map<string, string> } {
  const citations = new Map<string, string>();
  let counter = 0;

  const processedText = text.replace(CITATION_REGEX, (match, citationText) => {
    // Use a placeholder format that won't conflict with markdown syntax
    // (double underscores would be interpreted as bold)
    const placeholder = `\u2039CITE${counter}\u203a`;
    citations.set(placeholder, citationText);
    counter++;
    return placeholder;
  });

  return { processedText, citations };
}

// Render text with citations
function TextWithCitations({ text, citations }: { text: string; citations: Map<string, string> }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  citations.forEach((citationText, placeholder) => {
    const index = remaining.indexOf(placeholder);
    if (index !== -1) {
      if (index > 0) {
        parts.push(<span key={`text-${keyIndex++}`}>{remaining.slice(0, index)}</span>);
      }
      parts.push(<Citation key={`citation-${keyIndex++}`} text={citationText} />);
      remaining = remaining.slice(index + placeholder.length);
    }
  });

  if (remaining) {
    parts.push(<span key={`text-${keyIndex++}`}>{remaining}</span>);
  }

  return <>{parts}</>;
}

interface MessageContentProps {
  content: string;
}

export default function MessageContent({ content }: MessageContentProps) {
  const { processedText, citations } = processCitations(content);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        components={{
          // Custom paragraph to handle citations
          p: ({ children }) => (
            <p>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return <TextWithCitations text={child} citations={citations} />;
                }
                return child;
              })}
            </p>
          ),
          // Custom list item to handle citations
          li: ({ children }) => (
            <li>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return <TextWithCitations text={child} citations={citations} />;
                }
                return child;
              })}
            </li>
          ),
          // Style code
          code: ({ children }) => (
            <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-sm">
              {children}
            </code>
          ),
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}
