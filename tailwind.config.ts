import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "overlay-fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "overlay-fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        // Fade only — transform stays translate(-50%, -50%) so the dialog never moves.
        "dialog-fade-in": {
          from: { opacity: "0", transform: "translate(-50%, -50%)" },
          to: { opacity: "1", transform: "translate(-50%, -50%)" },
        },
        "dialog-fade-out": {
          from: { opacity: "1", transform: "translate(-50%, -50%)" },
          to: { opacity: "0", transform: "translate(-50%, -50%)" },
        },
      },
      animation: {
        "overlay-fade-in": "overlay-fade-in 150ms ease-out",
        "overlay-fade-out": "overlay-fade-out 150ms ease-in",
        "dialog-fade-in": "dialog-fade-in 150ms ease-out",
        "dialog-fade-out": "dialog-fade-out 150ms ease-in",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
