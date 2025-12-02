import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import path from "path";

export default defineConfig(() => ({
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
}))
