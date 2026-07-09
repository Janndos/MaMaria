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
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["'Instrument Sans'", "system-ui", "sans-serif"],
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
