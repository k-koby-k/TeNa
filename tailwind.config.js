/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#FAF7F1",
        navy: {
          DEFAULT: "#0B2545",
          50: "#E8EDF4",
          100: "#C7D2E2",
          700: "#13315C",
          900: "#08172E",
        },
        petrol: "#1B4965",
        teal: "#2A9D8F",
        emerald: "#10B981",
        amber: "#E0A800",
        ink: "#0F172A",
        muted: "#64748B",
        line: "#E6E1D6",
        card: "#FFFFFF",
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)",
      },
      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
}
