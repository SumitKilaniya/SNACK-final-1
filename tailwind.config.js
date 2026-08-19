/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
    darkMode: 'class',
    theme: {
        container: {
            center: true,
            padding: '1rem',
        },
        extend: {
            colors: {
                // Tokens are RGB channel triplets, so the <alpha-value> placeholder
                // lets opacity modifiers (bg-primary/10, shadow-primary/30, …) work.
                background: { DEFAULT: 'rgb(var(--background) / <alpha-value>)' },
                foreground: { DEFAULT: 'rgb(var(--foreground) / <alpha-value>)' },
                primary: {
                    DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
                    foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
                },
                secondary: {
                    DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
                    foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
                },
                accent: {
                    DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
                    foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
                },
                muted: {
                    DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
                    foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
                },
                card: {
                    DEFAULT: 'rgb(var(--card) / <alpha-value>)',
                    foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
                },
                border: { DEFAULT: 'rgb(var(--border) / <alpha-value>)' },
                input: { DEFAULT: 'rgb(var(--input) / <alpha-value>)' },
                ring: { DEFAULT: 'rgb(var(--ring) / <alpha-value>)' },
            },
            borderRadius: {
                sm: 'calc(var(--radius) - 2px)',
                DEFAULT: 'var(--radius)',
                md: 'calc(var(--radius) + 2px)',
                lg: 'calc(var(--radius) + 4px)',
                xl: 'calc(var(--radius) + 8px)',
                '2xl': 'calc(var(--radius) + 12px)',
            },
            fontFamily: {
                sans: ['var(--font-plus-jakarta-sans)', 'sans-serif'],
            },
            animation: {
                'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                'slide-in': 'slideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                'pulse-ring': 'pulse-ring 1.5s ease-out infinite',
                'spin-slow': 'spin 18s linear infinite',
                'spin-reverse': 'spin 20s linear infinite reverse',
                'spin-ring': 'spin 30s linear infinite',
            },
        },
    },
    plugins: [require('@tailwindcss/typography')],
};