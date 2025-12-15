import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const isProduction = mode === 'production';

    return {
        plugins: [react()],
        // Base path for GitHub Pages (repo name)
        base: isProduction ? '/vocabulary-app/' : '/',
        server: {
            port: 3000,
            proxy: {
                '/api': {
                    target: 'http://localhost:8002',
                    changeOrigin: true
                },
                '/static': {
                    target: 'http://localhost:8002',
                    changeOrigin: true
                },
                '/tts-audio': {
                    target: 'http://localhost:8002',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/tts-audio/, '/static/tts-audio')
                }
            }
        },
        build: {
            outDir: 'dist',
            sourcemap: false
        },
        define: {
            // Make env available
            'import.meta.env.VITE_STATIC_MODE': JSON.stringify(isProduction ? 'true' : 'false'),
        }
    };
})
