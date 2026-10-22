import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: "media",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1200px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        indigo: "hsl(var(--indigo))",
        teal: "hsl(var(--teal))",
        "series-1": "var(--series-1)",
        "series-2": "var(--series-2)",
        grid: "hsl(var(--grid))",
      },
      fontSize: {
        // Escala tipográfica de iOS (Dynamic Type "Large")
        "large-title": ["34px", { lineHeight: "41px", letterSpacing: "0.012em", fontWeight: "700" }],
        "title-2": ["22px", { lineHeight: "28px", fontWeight: "700" }],
        headline: ["17px", { lineHeight: "22px", fontWeight: "600" }],
        body: ["17px", { lineHeight: "22px" }],
        subhead: ["15px", { lineHeight: "20px" }],
        footnote: ["13px", { lineHeight: "18px" }],
        caption: ["12px", { lineHeight: "16px" }],
      },
      keyframes: {
        scan: { "0%,100%": { transform: "translateY(-30%)" }, "50%": { transform: "translateY(230%)" } },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
    },
  },
  plugins: [animate],
};

export default config;
