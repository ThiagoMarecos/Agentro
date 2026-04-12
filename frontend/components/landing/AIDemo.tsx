"use client";

import { useState } from "react";

const DEMO_EXCHANGE = {
  user: "How does Nexora work?",
  ai: "Nexora helps you create a store and deploy AI agents that convert conversations into sales. You upload products, configure your AI, and it handles customer questions 24/7.",
};

export function AIDemo() {
  const [input, setInput] = useState("");

  return (
    <div className="bg-surface/60 border border-white/10 rounded-xl overflow-hidden max-w-md mx-auto">
      <div className="px-4 py-3 border-b border-white/10">
        <span className="text-sm font-medium text-text-primary">Chat with Nexora AI</span>
      </div>
      <div className="p-4 space-y-4 min-h-[200px]">
        <div className="flex justify-end">
          <div className="bg-primary/20 text-text-primary text-sm rounded-lg px-4 py-2 max-w-[85%]">
            {DEMO_EXCHANGE.user}
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-white/5 text-text-muted text-sm rounded-lg px-4 py-2 max-w-[85%] border border-white/5">
            {DEMO_EXCHANGE.ai}
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-white/10">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Nexora AI something"
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition"
        />
      </div>
    </div>
  );
}
