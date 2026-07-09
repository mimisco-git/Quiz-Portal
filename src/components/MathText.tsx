import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface Props {
  text: string;
  className?: string;
}

// Renders a string that may contain inline $...$ or display $$...$$ math.
export default function MathText({ text, className }: Props) {
  const parts: React.ReactNode[] = [];
  // Split on $$...$$  or  $...$
  const re = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    const raw = match[0];
    const display = raw.startsWith("$$");
    const expr = display ? raw.slice(2, -2).trim() : raw.slice(1, -1).trim();
    try {
      const html = katex.renderToString(expr, { throwOnError: false, displayMode: display });
      parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />);
    } catch {
      parts.push(<span key={key++} className="text-red-400">{raw}</span>);
    }
    last = match.index + raw.length;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return <span className={className}>{parts}</span>;
}
