import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Cross-origin isolation headers (security hardening). Kept in sync with
// vercel.json (production).
const COOP_COEP = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Cross-origin isolation (security hardening). COEP "credentialless" (not
      // "require-corp") keeps third-party <img>/fetch working without CORP
      // headers. Mirror these in vercel.json for production.
      headers: COOP_COEP,
    },
    preview: {
      headers: COOP_COEP,
    },
    build: {
      rollupOptions: {
        output: {
          // Keep the heaviest vendors in their own cacheable chunks; combined
          // with the lazy-loaded views they only download when a view needs them.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (id.includes('pdfjs-dist') || id.includes('react-pdf')) return 'pdf';
            if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'charts';
            if (
              /node_modules\/(react-markdown|rehype-|remark-|micromark|mdast-|hast-|unified|unist-|vfile|property-information|space-separated-tokens|comma-separated-tokens|character-entities|trim-lines|bail|trough|devlop|html-url-attributes|estree-util|style-to-(js|object)|zwitch|longest-streak|ccount|escape-string-regexp|markdown-table)/.test(id)
            )
              return 'markdown';
            if (/node_modules\/(docx|mammoth)\//.test(id)) return 'docs';
          },
        },
      },
    },
  };
});
