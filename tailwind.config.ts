import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        action: {
          DEFAULT: "#0066cc",
          focus: "#0071e3",
          dark: "#2997ff",
        },
        ink: {
          DEFAULT: "#1d1d1f",
          80: "#333333",
          48: "#7a7a7a",
        },
        parchment: "#f5f5f7",
        pearl: "#fafafc",
        hairline: "#e0e0e0",
        "divider-soft": "#f0f0f0",
        chip: "#d2d2d7",
      },
      fontFamily: {
        display: [
          "var(--font-display)",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "system-ui",
          "Inter",
          "sans-serif",
        ],
        text: [
          "var(--font-text)",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "system-ui",
          "Inter",
          "sans-serif",
        ],
      },
      fontSize: {
        "display-md": [
          "28px",
          { lineHeight: "1.15", letterSpacing: "-0.011em", fontWeight: "600" },
        ],
        "display-sm": [
          "22px",
          { lineHeight: "1.18", letterSpacing: "-0.007em", fontWeight: "600" },
        ],
        body: [
          "16px",
          { lineHeight: "1.45", letterSpacing: "-0.01em", fontWeight: "400" },
        ],
        "body-strong": [
          "16px",
          { lineHeight: "1.35", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
        caption: [
          "13px",
          { lineHeight: "1.4", letterSpacing: "-0.005em", fontWeight: "400" },
        ],
        "caption-strong": [
          "13px",
          { lineHeight: "1.3", letterSpacing: "-0.005em", fontWeight: "600" },
        ],
        pin: [
          "13px",
          { lineHeight: "1", letterSpacing: "-0.005em", fontWeight: "600" },
        ],
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "24px",
        pill: "9999px",
      },
      boxShadow: {
        glass: "0 12px 36px rgba(0, 0, 0, 0.12)",
        pin: "0 2px 8px rgba(0, 0, 0, 0.18)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      backdropBlur: {
        xl: "24px",
      },
    },
  },
  plugins: [],
};

export default config;
