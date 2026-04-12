import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#6366F1",
        secondary: "#8B5CF6",
        accent: "#22C55E",
        background: "#0F172A",
        surface: "#1E293B",
        "text-primary": "#F8FAFC",
        "text-muted": "#94A3B8",
      },
      backgroundImage: {
        "gradient-nexora": "linear-gradient(135deg, #6366F1, #8B5CF6)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        "glow-primary": "0 0 40px -10px rgba(99, 102, 241, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
