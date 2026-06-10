/**
 * Shared pdf.js worker setup. Bundles the worker that ships with our pinned
 * pdfjs-dist (same copy react-pdf resolves to) instead of fetching it from the
 * unpkg CDN at runtime, so PDF rendering works offline and isn't subject to
 * CDN latency/outages.
 */
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/** Point a pdfjs module (react-pdf's re-export or pdfjs-dist itself) at the bundled worker. */
export function configurePdfWorker(pdfjs: { GlobalWorkerOptions: { workerSrc: string } }) {
  if (pdfjs.GlobalWorkerOptions.workerSrc !== workerUrl) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }
}
