interface CodeSnippetProps {
  lines: string[];
  className?: string;
}

export function CodeSnippet({ lines, className = "" }: CodeSnippetProps) {
  return (
    <div
      className={`font-mono text-sm text-text-muted bg-surface border border-white/10 rounded-lg p-4 overflow-x-auto ${className}`}
    >
      <pre className="m-0">
        {lines.map((line, i) => (
          <div key={i}>
            <span className="text-accent">&gt;</span>{" "}
            <span className="text-text-primary">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
