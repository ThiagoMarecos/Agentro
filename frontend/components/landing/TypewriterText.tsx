"use client";

import { useEffect, useState } from "react";

const LINES = [
  { cmd: "agentro.init()", output: "Creating store..." },
  { cmd: "upload_products()", output: "Products ready" },
  { cmd: "deploy_ai_agent()", output: "AI agent online" },
  { cmd: "sales.start()", output: "Customers detected" },
];

export function TypewriterText() {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [showOutput, setShowOutput] = useState(false);

  const line = LINES[lineIndex];
  const cmdComplete = charIndex >= line.cmd.length;

  useEffect(() => {
    if (!cmdComplete) {
      const t = setTimeout(() => setCharIndex((c) => c + 1), 70);
      return () => clearTimeout(t);
    }
    setShowOutput(true);
    const t = setTimeout(() => {
      setLineIndex((i) => (i + 1) % LINES.length);
      setCharIndex(0);
      setShowOutput(false);
    }, 2000);
    return () => clearTimeout(t);
  }, [charIndex, cmdComplete, lineIndex]);

  return (
    <div className="font-mono text-sm text-text-muted bg-surface/80 border border-white/10 rounded-lg p-4 min-h-[120px]">
      <div className="flex flex-col gap-2">
        <div>
          <span className="text-accent">&gt;</span>{" "}
          <span className="text-text-primary">{line.cmd.slice(0, charIndex)}</span>
          {!cmdComplete && <span className="animate-pulse">|</span>}
        </div>
        {showOutput && <div className="text-text-muted/80 pl-2">{line.output}</div>}
      </div>
    </div>
  );
}
