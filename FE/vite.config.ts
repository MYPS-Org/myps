import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import path from "path";

export default defineConfig(({ mode }) => {

  const env = loadEnv(mode, process.cwd(), '')
  return {
    optimizeDeps: {
    include: [
        'maplibre-gl',
        'react-resizable',       // add only if installed
        'react-draggable',       // add only if installed
      ],
      esbuildOptions: {
        target: "es2020",
      },
    },
    build: {
      target: 'es2020',
      outDir: '../Main/wwwroot/',
    },	
    server: {
      host: "::",
      port: 8080,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL,
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [
      react(),
      tailwindcss(),
      svgr({
        svgrOptions: {
          exportType: 'default',
        },
        include: '**/*.svg?react',
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
