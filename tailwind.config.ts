import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Official Ma'Maria palette — anchored on the brand teal (#00818C, "turquoise blue").
        brand: {
          50: "#E6F2F3",
          100: "#CCE6E8",
          200: "#99CDD1",
          300: "#66B3BA",
          400: "#339AA3",
          500: "#00818C",
          600: "#006F79",
          700: "#005A63",
          800: "#00434A",
          900: "#002E33",
        },
        // Official secondary — "silver grey metallic" (#C3C5C9).
        silver: { 100: "#EDEEEF", 200: "#DADCDE", 300: "#C3C5C9", 500: "#9A9DA3" },
        gold: { 400: "#E8B04B", 500: "#D99A2B", 600: "#B87E1B" },
        ink: "#1E2A2B",
        paper: "#FFFFFF",
        canvas: "#F2F7F7",
      },
      fontFamily: {
        // Self-hosted via next/font (see app/layout.tsx). Fraunces for headings,
        // Inter Tight for body/labels/prices.
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter-tight)", "system-ui", "sans-serif"],
      },
      // Ma'Maria type scale — 30 / 22 / 16 / 14 / 12. Headings tighten tracking;
      // 16/14/12 map to the stock base/sm/xs so the rest of the app is untouched.
      fontSize: {
        display: ["30px", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        title: ["22px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
      },
      borderRadius: { card: "1rem" },
      boxShadow: {
        card: "0 1px 3px rgba(0,67,75,.08), 0 4px 16px rgba(0,67,75,.06)",
      },
    },
  },
  plugins: [],
};
export default config;
