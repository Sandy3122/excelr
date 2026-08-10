import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ExcelR Placement Drive palette (from Figma spec)
        brand: {
          blue: "#3B82F6", // Dodger Blue — primary accent / gradient start
          bright: "#2B7FFF", // Blue (bright)
          cerulean: "#0EA5E9", // secondary accent
          indigo: "#6366F1", // gradient end / glow
          "indigo-light": "#818CF8",
          violet: "#8B5CF6",
        },
        navy: {
          900: "#0F172B",
          800: "#0F2050",
        },
        slate: {
          // extend the specific slate values from the spec (Tailwind defaults are close but pin exact tokens)
          850: "#1D293D",
        },
        ink: "#0F172B", // heading text
        muted: "#62748E", // secondary/body text
        faint: "#90A1B9", // muted text
        page: "#F0F4FF", // section background
        tint2: "#EEF2FF", // alt section bg
        tint3: "#E8EDFF", // icon chip bg / borders
      },
      fontFamily: {
        heading: ["var(--font-poppins)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "24px",
      },
      boxShadow: {
        card: "0 10px 30px rgba(2, 6, 23, 0.08)",
        "card-lg": "0 20px 50px rgba(2, 6, 23, 0.12)",
      },
      maxWidth: {
        content: "1152px",
        faq: "768px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
