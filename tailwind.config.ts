import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}", "./types/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "var(--panel-bg)",
        border: "var(--panel-border)",
        gold: "var(--gold)",
        goldSoft: "var(--gold-soft)",
        mutedText: "var(--text-dim)"
      },
      boxShadow: {
        stage: "0 18px 42px rgba(0, 0, 0, .42)",
        frame: "0 22px 60px rgba(0, 0, 0, .62)"
      }
    }
  },
  plugins: []
};

export default config;
