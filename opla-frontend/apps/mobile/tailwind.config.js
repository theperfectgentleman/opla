// tailwind.config.js
module.exports = {
    content: [
        "./App.{js,jsx,ts,tsx}",
        "./app/**/*.{js,jsx,ts,tsx}",
        "../../packages/ui/src/**/*.{js,jsx,ts,tsx}"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["PlusJakartaSans-Regular", "sans-serif"],
                medium: ["PlusJakartaSans-Medium", "sans-serif"],
                semibold: ["PlusJakartaSans-SemiBold", "sans-serif"],
                bold: ["PlusJakartaSans-Bold", "sans-serif"],
                display: ["PlusJakartaSans-Bold", "sans-serif"],
            },
            colors: {
                primary: "#6366f1", // Indigo 500
                secondary: "#ec4899", // Pink 500
                background: "#0f172a", // Slate 900
                surface: "#1e293b", // Slate 800
            },
        },
    },
    plugins: [],
}
