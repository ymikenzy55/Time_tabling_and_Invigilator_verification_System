import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Third-party code is split out so app releases don't invalidate the (rarely
// changing) vendor code in the browser cache. Only self-contained libraries
// get their own chunk: splitting React-dependent packages apart creates
// circular chunks that load before React initialises ("createContext of
// undefined"), so everything else stays together in `vendor`.
const STANDALONE_CHUNKS = {
  xlsx: ['xlsx'],
  qr: ['html5-qrcode', 'qrcode'],
};

const chunkFor = (id) => {
  if (!id.includes('node_modules')) return undefined;
  for (const [name, packages] of Object.entries(STANDALONE_CHUNKS)) {
    if (packages.some((pkg) => id.includes(`/node_modules/${pkg}/`))) return `vendor-${name}`;
  }
  return 'vendor';
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolved from this file, not the shell's cwd, so builds work from anywhere.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    rollupOptions: {
      output: { manualChunks: chunkFor },
    },
  },
});
