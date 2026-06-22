import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {createReadStream, existsSync, readFileSync} from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// Self-host the ONNX Runtime WASM artifacts that @huggingface/transformers (via
// kokoro-js) would otherwise dynamically import from the jsDelivr CDN at runtime.
// That cross-origin import is blocked in restricted/offline/CSP-locked
// environments and bricks every Kokoro voice — both the WebGPU and the WASM-CPU
// paths need it. We serve the artifacts same-origin under /ort/, matching
// kokoroWasmBase() in src/services/kokoroTts.ts.
//
// NB: ORT loads the .mjs glue via a real dynamic import(), so the files must NOT
// live in /public — Vite refuses to import /public files as modules in dev
// ("can only be referenced via HTML tags"). Instead we serve them straight from
// node_modules via a dev middleware, and emit them into the build output.
function selfHostKokoroWasm(): Plugin {
  // Transformers.js ships only the jsep ("JS Execution Provider") variant and
  // uses it for both WebGPU and WASM, so this one pair covers every voice path.
  const FILES = ['ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs'];
  const URL_PREFIX = '/ort/';
  const srcDir = path.resolve(__dirname, 'node_modules/@huggingface/transformers/dist');
  const sourceFor = (file: string) => {
    const full = path.join(srcDir, file);
    if (!existsSync(full)) {
      throw new Error(
        `[self-host-kokoro-wasm] ${full} not found — run \`npm ci\`. ` +
          `Kokoro voices need this self-hosted to avoid the jsDelivr CDN.`,
      );
    }
    return full;
  };
  return {
    name: 'self-host-kokoro-wasm',
    // Dev: serve the artifacts before Vite's transform/public middleware, so the
    // ORT dynamic import() resolves to a real same-origin module.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        const file = url?.startsWith(URL_PREFIX) ? url.slice(URL_PREFIX.length) : undefined;
        if (!file || !FILES.includes(file)) return next();
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        createReadStream(sourceFor(file)).pipe(res);
      });
    },
    // Build: emit the artifacts as bundle assets at <outDir>/ort/<file>.
    generateBundle() {
      for (const file of FILES) {
        this.emitFile({type: 'asset', fileName: `ort/${file}`, source: readFileSync(sourceFor(file))});
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), selfHostKokoroWasm()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
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
