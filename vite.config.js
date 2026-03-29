import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/lacrimosa-opus-card-scanner/' : '/',

  plugins: [
    // Enable .wasm imports (used by @techstark/opencv-js)
    wasm(),
    // Allow top-level await inside the WASM initialisation code
    topLevelAwait(),
  ],

  worker: {
    // Build Web Workers as ES modules so they can use static `import`
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },

  server: {
    headers: {
      // Required for SharedArrayBuffer used by WebAssembly
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
