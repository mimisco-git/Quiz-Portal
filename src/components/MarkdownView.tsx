import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MarkdownViewProps {
  content: string;
}

export default function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div className="note-body">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f] dark:text-white mt-6 mb-3 pb-2 border-b border-black/[0.08] dark:border-white/[0.10]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[18px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white mt-5 mb-2.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white/90 mt-4 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white/85 mt-3 mb-1.5">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[14px] text-[#3a3a3c] dark:text-white/85 leading-[1.75] mb-4">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 pl-5 space-y-1.5 list-disc marker:text-emerald-500 dark:marker:text-emerald-400">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 pl-5 space-y-1.5 list-decimal marker:text-[#6e6e73] dark:marker:text-white/50 marker:font-semibold">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-[14px] text-[#3a3a3c] dark:text-white/85 leading-relaxed pl-1">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-[#1d1d1f] dark:text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[#3a3a3c] dark:text-white/80">
              {children}
            </em>
          ),
          code: ({ children }) => (
            <code className="font-mono text-[12.5px] bg-[#f2f2f7] dark:bg-white/[0.10] text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded-[5px] border border-black/[0.06] dark:border-white/[0.10]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="font-mono text-[12.5px] bg-[#1d1d1f] dark:bg-black/40 text-emerald-300 dark:text-emerald-300 p-4 rounded-[10px] overflow-x-auto border border-black/[0.10] dark:border-white/[0.08] my-4">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-emerald-500 dark:border-emerald-400 pl-4 py-1 my-4 bg-emerald-50 dark:bg-emerald-500/[0.07] rounded-r-[8px]">
              <div className="text-[13.5px] italic text-[#3a3a3c] dark:text-white/75">{children}</div>
            </blockquote>
          ),
          hr: () => <hr className="my-5 border-black/[0.08] dark:border-white/[0.10]" />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="text-emerald-700 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-600 dark:hover:text-emerald-300">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-[13px] border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-[#1d1d1f] dark:text-white bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-[#3a3a3c] dark:text-white/80 border border-black/[0.06] dark:border-white/[0.08]">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
