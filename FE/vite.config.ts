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
        // es2022+ has native class fields, so esbuild doesn't need to downlevel
        // them to __publicField() helper calls. At es2020, that downleveling can
        // split a dep's helper-defining chunk from its helper-calling chunk during
        // optimizeDeps pre-bundling, producing "__publicField is not defined" at
        // runtime (hit with maplibre-gl, which is class-field-heavy).
        target: "es2022",
      },
    },
    build: {
      target: 'es2020',
      outDir: '../Main/wwwroot/',
    },	
    server: {
      host: "::",
      port: 8080,
      // Allow Vite's dev server to read files under Main/Resources/Internal
      // (one level up from FE/) so that @MainResource imports resolve.
      fs: {
        allow: [
          path.resolve(__dirname),
          path.resolve(__dirname, "../Main/Resources/Internal"),
        ],
      },
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
        // Central asset registry — see Main/Resources/Internal/index.ts
        // Import anywhere with: `import { MainResource } from '@MainResource';`
        "@MainResource": path.resolve(__dirname, "../Main/Resources/Internal/index.ts"),
      },
    },
  }
})
