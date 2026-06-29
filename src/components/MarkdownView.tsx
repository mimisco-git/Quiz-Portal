import ReactMarkdown from "react-markdown";

interface MarkdownViewProps {
  content: string;
}

export default function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div className="prose prose-slate max-w-none dark:prose-invert">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 mt-6 mb-4 font-sans border-b border-gray-100 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold tracking-tight text-gray-800 mt-5 mb-3 font-sans">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium tracking-tight text-gray-800 mt-4 mb-2 font-sans">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-2 mb-4 text-sm text-gray-600 pl-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-2 mb-4 text-sm text-gray-600 pl-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-600 inline-block w-full">
              • <span className="ml-1">{children}</span>
            </li>
          ),
          code: ({ children }) => (
            <code className="font-mono text-xs bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded border border-slate-200">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="font-mono text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto shadow-sm border border-slate-800 my-4 block">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-sm text-gray-500 bg-slate-50 py-2 rounded-r my-4">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
