'use client';

import React from 'react';

// Regex to match citations like [Document Name, Section X: Title]
const CITATION_REGEX = /\[([^\]]+)\]/g;

interface CitationProps {
  text: string;
}

function Citation({ text }: CitationProps) {
  // Determine document type color
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

// Risk flag patterns
const RISK_PATTERNS = {
  HIGH: /\b(HIGH|CRITICAL)\s*(RISK|SEVERITY)/gi,
  MEDIUM: /\bMEDIUM\s*(RISK|SEVERITY)/gi,
  LOW: /\bLOW\s*(RISK|SEVERITY)/gi,
};

function RiskBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const colors = {
    HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    LOW: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[level]}`}>
      {level} RISK
    </span>
  );
}

interface MessageContentProps {
  content: string;
}

export default function MessageContent({ content }: MessageContentProps) {
  // Split content by citations and render appropriately
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  // Reset regex state
  CITATION_REGEX.lastIndex = 0;

  while ((match = CITATION_REGEX.exec(content)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.slice(lastIndex, match.index)}
        </span>
      );
    }

    // Add citation
    parts.push(
      <Citation key={`citation-${match.index}`} text={match[1]} />
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>
        {content.slice(lastIndex)}
      </span>
    );
  }

  return <>{parts}</>;
}
