
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import path from "path";

// https://vite.dev/config/
export default defineConfig(() => ({
	build: {
		outDir: 'dist/custom-folder'
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
