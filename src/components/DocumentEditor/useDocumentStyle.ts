import { useEffect } from "react";
import { getScopedStyles, loadGoogleFont } from "@/components/ResumeRenderer";
import { DENSITY } from "./StylePanel";

const TEMPLATE_FONTS: Record<string, { heading: string; body: string }> = {
  "modern-clean": { heading: "Inter", body: "Inter" },
  "tech-focused": { heading: "JetBrains Mono", body: "Inter" },
  executive: { heading: "Playfair Display", body: "Georgia" },
  minimal: { heading: "Inter", body: "Inter" },
  academic: { heading: "Merriweather", body: "Georgia" },
  creative: { heading: "Montserrat", body: "Lato" },
  photography: { heading: "Lato", body: "Lato" },
  slate: { heading: "Inter", body: "Inter" },
};

export { TEMPLATE_FONTS };

interface StyleOptions {
  scopeId: string;
  rawHtmlMode: boolean;
  templateId: string;
  accentColor: string;
  accentStyle: "line" | "filled" | "minimal";
}

/** Injects scoped CSS for the document editor theme. */
export function useDocumentStyle({
  scopeId,
  rawHtmlMode,
  templateId,
  accentColor,
  accentStyle,
}: StyleOptions) {
  useEffect(() => {
    const id = `${scopeId}-theme`;
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    if (rawHtmlMode) {
      const scope = `#${scopeId}`;
      el.textContent = [
        `${scope} { font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1a1a1a; }`,
        `${scope} h1 { font-size: 18pt; font-weight: 700; margin: 0 0 6px; }`,
        `${scope} h2 { font-size: 12pt; font-weight: 700; margin: 16px 0 4px; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; text-transform: uppercase; letter-spacing: 0.05em; }`,
        `${scope} h3 { font-size: 11pt; font-weight: 700; margin: 10px 0 2px; }`,
        `${scope} h4 { font-size: 10.5pt; font-weight: 600; margin: 8px 0 2px; }`,
        `${scope} p  { margin: 2px 0 4px; }`,
        `${scope} ul { margin: 2px 0 6px; padding-left: 18px; }`,
        `${scope} li { margin: 1px 0; }`,
        `${scope} strong, ${scope} b { font-weight: 700; }`,
        `${scope} em, ${scope} i { font-style: italic; }`,
        `${scope} a  { color: inherit; text-decoration: underline; }`,
        `${scope} table { width: 100%; border-collapse: collapse; margin: 6px 0; }`,
        `${scope} td, ${scope} th { padding: 3px 6px; border: 1px solid #e5e7eb; }`,
      ].join("\n");
    } else {
      const fonts = TEMPLATE_FONTS[templateId] ?? { heading: "Inter", body: "Inter" };
      loadGoogleFont(fonts.heading);
      if (fonts.body !== fonts.heading) loadGoogleFont(fonts.body);
      el.textContent = getScopedStyles(
        scopeId,
        templateId,
        accentColor,
        accentStyle,
        fonts.heading,
        fonts.body,
        DENSITY,
      );
    }
    el.textContent += `\n#${scopeId} ::highlight(tailor-revise) { background-color: rgba(232,185,72,0.45); color: var(--foreground); }`;
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [scopeId, rawHtmlMode, templateId, accentColor, accentStyle]);
}
