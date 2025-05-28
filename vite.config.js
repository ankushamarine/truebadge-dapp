import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // Corrected: Using the SWC plugin you have installed
import { nodePolyfills } from 'vite-plugin-node-polyfills'; // Import the polyfills plugin

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), // Enable React plugin with SWC
    nodePolyfills({
      globals: true, // Polyfill Node.js globals like 'Buffer' and 'global' for browser environments
    })
  ],
  // You might need this if some dependencies still rely on Node.js globals in specific contexts,
  // but `nodePolyfills` should cover most cases. Keep it commented unless issues arise.
  // optimizeDeps: {
  //   esbuildOptions: {
  //     define: {
  //       global: 'globalThis'
  //     },
  //   },
  // },
});