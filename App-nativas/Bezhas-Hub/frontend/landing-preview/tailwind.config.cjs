module.exports = {
    darkMode: 'class',
    content: [
        './index.html',
        './entry.jsx',
        '../src/components/landing/**/*.jsx',
    ],
    theme: {
        extend: {
            fontFamily: {
                display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
