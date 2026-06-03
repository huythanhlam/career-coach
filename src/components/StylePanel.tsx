import React, { useState } from 'react';
import { X, LayoutTemplate, ChevronDown, ChevronUp } from 'lucide-react';
import {
  ResumeStyleConfig,
  ACCENT_COLORS,
  GOOGLE_FONTS,
  GoogleFont,
  FontDensity,
  AccentStyle,
} from '@/types/resumeStyle';
import { TEMPLATES } from './TemplateGallery';

interface StylePanelProps {
  styleConfig: ResumeStyleConfig;
  onChange: (patch: Partial<ResumeStyleConfig>) => void;
  onOpenGallery: () => void;
  onClose: () => void;
  /** When true, hides the panel header (used when rendered as a sidebar tab) */
  hideHeader?: boolean;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
          {title}
        </span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
          : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />}
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

export function StylePanel({ styleConfig, onChange, onOpenGallery, onClose, hideHeader = false }: StylePanelProps) {
  const [customHex, setCustomHex] = useState('');
  const currentTemplate = TEMPLATES.find(t => t.id === styleConfig.templateId);

  return (
    <div
      className="flex flex-col h-full"
      style={{ width: 280, background: 'var(--card)', borderLeft: '1px solid var(--border)' }}
    >
      {/* Panel header — hidden when used as a sidebar tab */}
      {!hideHeader && (
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="font-display text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Style
          </div>
          <button
            onClick={onClose}
            aria-label="Close style panel"
            style={{
              width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--muted)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)',
            }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">

        {/* Template */}
        <Section title="Template">
          <button
            type="button"
            onClick={onOpenGallery}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: '2px solid var(--border)', background: 'var(--muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'inherit', textAlign: 'left', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{
              width: 8, height: 32, borderRadius: 3,
              background: styleConfig.accentColor, flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>
                {currentTemplate?.name ?? styleConfig.templateId}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
                {currentTemplate?.description ?? 'Custom'}
              </div>
            </div>
            <LayoutTemplate className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          </button>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 8, lineHeight: 1.5 }}>
            Click above to browse all templates with live previews.
          </p>
        </Section>

        {/* Accent Colour */}
        <Section title="Accent Colour">
          <div
            role="radiogroup"
            aria-label="Accent colour"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}
          >
            {ACCENT_COLORS.filter(c => c.name !== 'Custom').map(c => (
              <button
                key={c.name}
                type="button"
                role="radio"
                aria-label={`Accent colour: ${c.name}`}
                aria-checked={styleConfig.accentColor === c.value}
                onClick={() => onChange({ accentColor: c.value })}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: 8, border: 'none',
                  background: c.value, cursor: 'pointer',
                  outline: styleConfig.accentColor === c.value ? `3px solid ${c.value}` : '2px solid transparent',
                  outlineOffset: 2,
                  transform: styleConfig.accentColor === c.value ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.12s, outline 0.12s',
                }}
                title={c.name}
              />
            ))}
          </div>
          {/* Custom hex */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: customHex.match(/^#[0-9a-f]{6}$/i) ? customHex : styleConfig.accentColor,
              border: '1px solid var(--border)',
            }} />
            <input
              type="text"
              placeholder="#2F6B4F"
              value={customHex}
              onChange={e => {
                setCustomHex(e.target.value);
                if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange({ accentColor: e.target.value });
              }}
              style={{
                flex: 1, height: 32, padding: '0 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--muted)',
                fontSize: 12, color: 'var(--foreground)', fontFamily: 'monospace', outline: 'none',
              }}
              aria-label="Custom hex colour"
            />
          </div>
        </Section>

        {/* Typography */}
        <Section title="Typography">
          {/* Heading font */}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>
            Heading Font
          </label>
          <select
            value={styleConfig.headingFont}
            onChange={e => onChange({ headingFont: e.target.value as GoogleFont })}
            style={{
              width: '100%', height: 34, padding: '0 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--muted)',
              fontSize: 12, color: 'var(--foreground)', fontFamily: 'inherit',
              cursor: 'pointer', outline: 'none', marginBottom: 10,
            }}
            aria-label="Heading font"
          >
            {GOOGLE_FONTS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          {/* Body font */}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>
            Body Font
          </label>
          <select
            value={styleConfig.bodyFont}
            onChange={e => onChange({ bodyFont: e.target.value as GoogleFont })}
            style={{
              width: '100%', height: 34, padding: '0 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--muted)',
              fontSize: 12, color: 'var(--foreground)', fontFamily: 'inherit',
              cursor: 'pointer', outline: 'none',
            }}
            aria-label="Body font"
          >
            {GOOGLE_FONTS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Section>

        {/* Density */}
        <Section title="Density">
          <div style={{ display: 'flex', gap: 6 }}>
            {(['compact', 'normal', 'spacious'] as FontDensity[]).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ density: d })}
                style={{
                  flex: 1, height: 32, borderRadius: 8, fontFamily: 'inherit',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: styleConfig.density === d ? '2px solid var(--primary)' : '2px solid var(--border)',
                  background: styleConfig.density === d ? 'rgba(217,119,87,0.10)' : 'var(--muted)',
                  color: styleConfig.density === d ? 'var(--primary)' : 'var(--muted-foreground)',
                  textTransform: 'capitalize',
                  transition: 'all 0.15s',
                }}
                aria-pressed={styleConfig.density === d}
              >
                {d}
              </button>
            ))}
          </div>
        </Section>

        {/* Heading style (only relevant for modern-clean / minimal) */}
        {(styleConfig.templateId === 'modern-clean' || styleConfig.templateId === 'minimal') && (
          <Section title="Section Dividers" defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([
                { value: 'line', label: 'Underline', desc: 'Thin accent line under headings' },
                { value: 'filled', label: 'Filled bar', desc: 'Subtle colour fill behind headings' },
                { value: 'minimal', label: 'None', desc: 'Colour only, no decorative lines' },
              ] as { value: AccentStyle; label: string; desc: string }[]).map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onChange({ accentStyle: o.value })}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, textAlign: 'left',
                    border: styleConfig.accentStyle === o.value ? '2px solid var(--primary)' : '2px solid var(--border)',
                    background: styleConfig.accentStyle === o.value ? 'rgba(217,119,87,0.08)' : 'var(--muted)',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                  aria-pressed={styleConfig.accentStyle === o.value}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: styleConfig.accentStyle === o.value ? 'var(--primary)' : 'var(--foreground)' }}>
                    {o.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{o.desc}</div>
                </button>
              ))}
            </div>
          </Section>
        )}

      </div>

      {/* Footer — reset */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => {
            onChange({
              accentColor: TEMPLATES.find(t => t.id === styleConfig.templateId)?.accent ?? '#2F6B4F',
              headingFont: 'Inter',
              bodyFont: 'Inter',
              density: 'normal',
              accentStyle: 'line',
            });
            setCustomHex('');
          }}
          style={{
            width: '100%', height: 34, borderRadius: 8, fontFamily: 'inherit',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--muted-foreground)',
          }}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
