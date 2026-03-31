/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Manrope'", "sans-serif"],
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"]
      },
      colors: {
        ink: {
          50: "#f7fafc",
          100: "#edf2f7",
          200: "#d9e2ec",
          300: "#bcccdc",
          500: "#627d98",
          700: "#334e68",
          900: "#102a43"
        },
        signal: {
          cyan: "#2dd4bf",
          amber: "#f59e0b",
          coral: "#fb7185"
        }
      },
      boxShadow: {
        panel: "0 34px 90px -40px rgba(11, 27, 20, 0.5)",
        soft: "0 22px 54px -34px rgba(11, 27, 20, 0.34)",
        glow: "0 0 0 1px rgba(255,255,255,0.28), 0 26px 80px -40px rgba(35, 122, 83, 0.48)"
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(18px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" }
        },
        pageIn: {
          "0%": { opacity: "0", transform: "translateY(28px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" }
        },
        blink: {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "1" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" }
        },
        floatWide: {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg)" },
          "50%": { transform: "translate3d(0, -14px, 0) rotate(2deg)" }
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "33%": { transform: "translate3d(18px, -14px, 0) scale(1.04)" },
          "66%": { transform: "translate3d(-12px, 10px, 0) scale(0.98)" }
        },
        gridFlow: {
          "0%": { backgroundPosition: "0 0, 0 0" },
          "100%": { backgroundPosition: "34px 34px, 34px 34px" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 50%" },
          "100%": { backgroundPosition: "200% 50%" }
        },
        sweep: {
          "0%": { transform: "translateX(-140%) skewX(-18deg)", opacity: "0" },
          "20%": { opacity: "0.28" },
          "100%": { transform: "translateX(180%) skewX(-18deg)", opacity: "0" }
        },
        spinSlow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" }
        },
        drawLine: {
          "0%": { strokeDashoffset: "320" },
          "100%": { strokeDashoffset: "0" }
        },
        pulseRing: {
          "0%": { transform: "scale(0.92)", opacity: "0.55" },
          "70%": { transform: "scale(1.08)", opacity: "0" },
          "100%": { transform: "scale(1.08)", opacity: "0" }
        }
      },
      animation: {
        rise: "rise 0.45s ease-out",
        "page-in": "pageIn 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
        blink: "blink 1.3s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "float-wide": "floatWide 9s ease-in-out infinite",
        drift: "drift 12s ease-in-out infinite",
        "grid-flow": "gridFlow 16s linear infinite",
        shimmer: "shimmer 7s linear infinite",
        sweep: "sweep 4.8s ease-in-out infinite",
        "spin-slow": "spinSlow 18s linear infinite",
        "draw-line": "drawLine 1.2s ease-out forwards",
        "pulse-ring": "pulseRing 2.8s ease-out infinite"
      }
    }
  },
  plugins: []
};
