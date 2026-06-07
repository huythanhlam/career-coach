import React, { useEffect, useMemo, useRef } from 'react';
import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { ResumeStyleConfig, DENSITY_MAP, DEFAULT_STYLE_CONFIG } from '@/types/resumeStyle';

interface ResumeRendererProps {
  markdownContent: string;
  templateType: string;
  styleConfig?: ResumeStyleConfig;
  customComponents?: any;
}

/** Inject a Google Fonts <link> into <head> if not already present */
export function loadGoogleFont(font: string) {
  const id = `gf-${font.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

/** Counter for stable unique IDs — avoids useId SSR issues and random flicker */
let _idCounter = 0;

export function ResumeRenderer({
  markdownContent,
  templateType,
  styleConfig,
  customComponents = {},
}: ResumeRendererProps) {
  const cfg = styleConfig ?? DEFAULT_STYLE_CONFIG;
  const density = DENSITY_MAP[cfg.density];

  // Stable ID for scoping injected CSS — created once per mount
  const scopeId = useRef(`rr-${++_idCounter}`);

  // Load Google Fonts for heading + body
  useEffect(() => {
    loadGoogleFont(cfg.headingFont);
    if (cfg.bodyFont !== cfg.headingFont) loadGoogleFont(cfg.bodyFont);
  }, [cfg.headingFont, cfg.bodyFont]);

  // Map templateType (legacy string) → effective templateId
  const effectiveTemplate = cfg.templateId !== 'modern-clean'
    ? cfg.templateId
    : legacyIdMap[templateType] ?? 'modern-clean';

  const getThemeClasses = () => {
    switch (effectiveTemplate) {
      case 'tech-focused':
        return 'prose max-w-none w-full prose-h1:text-3xl prose-h1:font-bold prose-h1:font-mono prose-h1:uppercase prose-h1:tracking-tight prose-h1:mb-2 prose-h2:text-lg prose-h2:font-bold prose-h2:font-mono prose-h2:uppercase prose-h2:border-b prose-h2:pb-1 prose-h2:mt-5 prose-h2:mb-2 prose-h3:text-base prose-h3:font-bold prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1 prose-ul:my-2 prose-li:my-0';
      case 'executive':
        return 'prose max-w-none w-full prose-h1:text-4xl prose-h1:font-normal prose-h1:text-center prose-h1:mb-2 prose-h2:text-lg prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-center prose-h2:border-b-2 prose-h2:pb-2 prose-h2:mt-6 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-bold prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1 prose-ul:my-2 prose-li:my-0';
      case 'creative':
        return 'prose max-w-none w-full prose-h1:text-5xl prose-h1:font-black prose-h1:tracking-tighter prose-h1:mb-3 prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1 prose-ul:my-2 prose-li:my-1';
      case 'photography':
        return 'prose max-w-none w-full prose-h1:text-3xl prose-h1:font-light prose-h1:uppercase prose-h1:tracking-[0.2em] prose-h1:text-center prose-h1:mb-4 prose-h2:text-xl prose-h2:font-medium prose-h2:uppercase prose-h2:tracking-widest prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1 prose-p:my-2 prose-p:font-light prose-p:leading-relaxed prose-ul:my-2 prose-li:my-1';
      case 'academic':
        return 'prose max-w-none w-full prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-2 prose-h2:text-lg prose-h2:font-bold prose-h2:px-2 prose-h2:py-1 prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-base prose-h3:font-bold prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1 prose-ul:my-2 prose-li:my-1';
      case 'minimal':
        return 'prose max-w-none w-full prose-h1:text-3xl prose-h1:font-semibold prose-h1:mb-2 prose-h2:text-base prose-h2:font-semibold prose-h2:uppercase prose-h2:tracking-widest prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-sm prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1 prose-ul:my-2 prose-li:my-0';
      case 'slate':
        return 'prose max-w-none w-full prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-1 prose-h2:text-sm prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-widest prose-h2:mt-5 prose-h2:mb-2 prose-h3:text-base prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1 prose-ul:my-2 prose-li:my-0';
      default: // modern-clean
        return 'prose max-w-none w-full prose-h1:text-4xl prose-h1:font-bold prose-h1:tracking-tight prose-h1:mb-2 prose-h2:text-xl prose-h2:font-semibold prose-h2:border-b-2 prose-h2:pb-1 prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-lg prose-h3:font-medium prose-h3:mt-3 prose-h3:mb-1 prose-p:my-1 prose-ul:my-2 prose-li:my-0';
    }
  };

  // Memoise scoped CSS so the effect only fires when something actually changed
  const scopedStyles = useMemo(() => getScopedStyles(
    scopeId.current,
    effectiveTemplate,
    cfg.accentColor,
    cfg.accentStyle,
    cfg.headingFont,
    cfg.bodyFont,
    density,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [effectiveTemplate, cfg.accentColor, cfg.accentStyle, cfg.headingFont, cfg.bodyFont, density.fontSize, density.lineHeight]);

  // Inject into <head> imperatively — more reliable than inline <style> tags
  // (inline tags can lose to Tailwind prose even with !important in some browsers)
  useEffect(() => {
    const styleId = `${scopeId.current}-style`;
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = scopedStyles;
    return () => { document.getElementById(styleId)?.remove(); };
  }, [scopedStyles]);

  return (
    <div
      id={scopeId.current}
      style={{ fontSize: density.fontSize, lineHeight: density.lineHeight, color: '#1a1a1a' }}
    >
      <div className={getThemeClasses()}>
        <Markdown
          rehypePlugins={[rehypeSanitize]}
          components={{
            ul: ({ node, ...props }) => <ul className="list-disc pl-5" {...props} />,
            ol: ({ node, ...props }) => <ol className="list-decimal pl-5" {...props} />,
            p: ({ node, ...props }) => <p {...props} />,
            ...customComponents,
          }}
        >
          {markdownContent}
        </Markdown>
      </div>
    </div>
  );
}

/** Map legacy templateType strings to new templateId keys */
const legacyIdMap: Record<string, string> = {
  'Modern & Clean': 'modern-clean',
  'Tech Focused': 'tech-focused',
  'Executive': 'executive',
  'Creative / Portfolio': 'creative',
  'Photography / Visual': 'photography',
  'Academic / Research': 'academic',
};

export interface DensityValues { lineHeight: string; fontSize: string; }

/**
 * Scoped CSS — prefixed with `#id` so it wins over Tailwind prose's
 * `:where()` selectors without needing !important on most rules.
 */
export function getScopedStyles(
  id: string,
  templateId: string,
  accent: string,
  accentStyle: string,
  headingFont: string,
  bodyFont: string,
  density: DensityValues,
): string {
  const s = `#${id}`;

  const base = `
    ${s} { font-family: "${bodyFont}", sans-serif; font-size: ${density.fontSize}; line-height: ${density.lineHeight}; }
    ${s} h1, ${s} h2, ${s} h3 { font-family: "${headingFont}", sans-serif; }
  `;

  switch (templateId) {
    case 'tech-focused':
      return `${base}
        ${s} h1 { color: ${accent}; }
        ${s} h2 { border-color: ${accent}55 !important; color: ${accent} !important; }
        ${s} h3 { color: ${accent}cc; }
        ${s} a { color: ${accent}; }
      `;
    case 'executive':
      return `${base}
        ${s} h2 { border-color: ${accent} !important; }
        ${s} hr { border-color: ${accent}44; }
      `;
    case 'creative':
      return `${base}
        ${s} h1 { background: linear-gradient(135deg, ${accent}, ${accent}88); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        ${s} h2 { color: ${accent} !important; }
        ${s} li::marker { color: ${accent}; }
      `;
    case 'slate':
      return `${base}
        ${s} h2 { color: ${accent} !important; border-bottom: 2px solid ${accent} !important; padding-bottom: 4px; }
      `;
    case 'academic':
      return `${base}
        ${s} h2 { background: ${accent}18 !important; border-left: 3px solid ${accent}; padding-left: 8px; }
      `;
    case 'minimal':
      return `${base}
        ${s} h2 { color: ${accent} !important; }
        ${s} hr { border-color: ${accent}33; }
      `;
    case 'photography':
      return `${base}
        ${s} h2 { color: ${accent} !important; }
      `;
    default: { // modern-clean
      if (accentStyle === 'filled') {
        return `${base}
          ${s} h2 { background: ${accent}18 !important; border-bottom: none !important; padding: 4px 8px; border-radius: 4px; color: ${accent} !important; }
          ${s} hr { border-color: ${accent}44; }
        `;
      } else if (accentStyle === 'minimal') {
        return `${base}
          ${s} h2 { border-bottom: none !important; color: ${accent} !important; }
        `;
      } else {
        return `${base}
          ${s} h2 { border-color: ${accent}55 !important; color: ${accent} !important; }
          ${s} hr { border-color: ${accent}33; }
        `;
      }
    }
  }
}
