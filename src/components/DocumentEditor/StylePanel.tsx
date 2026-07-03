import React, { useState, useEffect, useRef } from "react";
import { Palette, X } from "lucide-react";
import { TEMPLATES } from "@/components/TemplateGallery";

// ─── constants ─────────────────────────────────────────────────────────────────

export const DENSITY = { lineHeight: "1.6", fontSize: "11pt" };

export const FONT_FAMILIES = [
  "Inter",
  "Georgia",
  "Arial",
  "Times New Roman",
  "Helvetica",
  "Lato",
  "Montserrat",
  "Merriweather",
  "Playfair Display",
  "Verdana",
];
export const FONT_SIZES = ["8", "9", "10", "11", "12", "14", "16", "18", "20", "24", "28", "36"];

export const PRESET_COLORS = [
  "#000000",
  "#1a1a1a",
  "#434343",
  "#666666",
  "#999999",
  "#cccccc",
  "#ffffff",
  "#ea4335",
  "#e67c0a",
  "#f9ab00",
  "#34a853",
  "#4285f4",
  "#9900cc",
  "#e91e63",
  "#d97757",
  "#2f6b4f",
  "#1d3557",
  "#f0e9dc",
  "#e8dfce",
  "#8b5e3c",
];

export const PAPER_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Cream", value: "#FBF7F1" },
  { name: "Light Gray", value: "#f5f5f5" },
  { name: "Warm Gray", value: "#F0E9DC" },
  { name: "Soft Blue", value: "#EFF6FF" },
  { name: "Soft Green", value: "#F0FDF4" },
  { name: "Soft Yellow", value: "#FEFCE8" },
  { name: "Charcoal", value: "#1a1a1a" },
];

// ─── icon / shape data ─────────────────────────────────────────────────────────

export const ICON_TABS = [
  {
    label: "Contact",
    items: [
      { label: "Email", html: "✉" },
      { label: "Phone", html: "📞" },
      { label: "Mobile", html: "📱" },
      { label: "LinkedIn", html: "🔗" },
      { label: "Website", html: "🌐" },
      { label: "Location", html: "📍" },
      { label: "Home", html: "🏠" },
      { label: "Office", html: "🏢" },
      { label: "Calendar", html: "📅" },
      { label: "GitHub", html: "⌥" },
    ],
  },
  {
    label: "Resume",
    items: [
      { label: "Work", html: "💼" },
      { label: "Education", html: "🎓" },
      { label: "Skills", html: "🛠" },
      { label: "Award", html: "🏆" },
      { label: "Project", html: "📌" },
      { label: "Publish", html: "📄" },
      { label: "Language", html: "🌍" },
      { label: "Code", html: "💻" },
      { label: "Design", html: "🎨" },
      { label: "Research", html: "🔬" },
    ],
  },
  {
    label: "Symbols",
    items: [
      { label: "Bullet", html: "•" },
      { label: "Arrow R", html: "→" },
      { label: "Arrow L", html: "←" },
      { label: "Arrow U", html: "↑" },
      { label: "Chevron", html: "›" },
      { label: "Star", html: "★" },
      { label: "Star out", html: "☆" },
      { label: "Check", html: "✓" },
      { label: "Cross", html: "✗" },
      { label: "Diamond", html: "◆" },
      { label: "Circle", html: "●" },
      { label: "Square", html: "■" },
      { label: "Tri up", html: "▲" },
      { label: "Tri dn", html: "▼" },
      { label: "Dash em", html: "—" },
      { label: "Ornament", html: "✦" },
      { label: "Plus", html: "＋" },
      { label: "Degree", html: "°" },
      { label: "Copyright", html: "©" },
      { label: "Trademark", html: "™" },
    ],
  },
  {
    label: "Shapes",
    items: [
      {
        label: "Circle",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><circle cx="10" cy="10" r="9" fill="currentColor"/></svg>`,
      },
      {
        label: "Circle out",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      },
      {
        label: "Square",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><rect x="1" y="1" width="18" height="18" rx="2" fill="currentColor"/></svg>`,
      },
      {
        label: "Square out",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      },
      {
        label: "Triangle",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><polygon points="10,1 19,19 1,19" fill="currentColor"/></svg>`,
      },
      {
        label: "Diamond",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><polygon points="10,1 19,10 10,19 1,10" fill="currentColor"/></svg>`,
      },
      {
        label: "Arrow R",
        html: `<svg width="28" height="16" viewBox="0 0 28 16" style="display:inline-block;vertical-align:middle;margin:0 2px"><path d="M0 8 H22 M16 2 L24 8 L16 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      },
      {
        label: "Star",
        html: `<svg width="22" height="22" viewBox="0 0 22 22" style="display:inline-block;vertical-align:middle;margin:0 2px"><polygon points="11,1 13.8,8.4 21.5,8.5 15.4,13.4 17.6,21.1 11,16.5 4.4,21.1 6.6,13.4 0.5,8.5 8.2,8.4" fill="currentColor"/></svg>`,
      },
      {
        label: "Line H",
        html: `<svg width="60" height="10" viewBox="0 0 60 10" style="display:inline-block;vertical-align:middle;margin:0 2px"><line x1="0" y1="5" x2="60" y2="5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
      },
      {
        label: "Divider",
        html: `<svg width="120" height="16" viewBox="0 0 120 16" style="display:inline-block;vertical-align:middle;margin:0 2px"><line x1="0" y1="8" x2="48" y2="8" stroke="currentColor" stroke-width="1.5"/><circle cx="60" cy="8" r="4" fill="currentColor"/><line x1="72" y1="8" x2="120" y2="8" stroke="currentColor" stroke-width="1.5"/></svg>`,
      },
    ],
  },
];

// ─── color picker / icon picker / insert menu ─────────────────────────────────

interface ColorPickerPopoverProps {
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
  recentColors: string[];
  label?: string;
}

export function ColorPickerPopover({
  value,
  onChange,
  onClose,
  recentColors,
  label,
}: ColorPickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [customHex, setCustomHex] = useState(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const pick = (c: string) => {
    onChange(c);
    setCustomHex(c);
  };

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        zIndex: 1000,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "12px 14px",
        boxShadow: "0 6px 24px rgba(0,0,0,0.14)",
        width: 228,
      }}
    >
      {label && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--muted-foreground)",
            letterSpacing: "0.07em",
            marginBottom: 8,
          }}
        >
          {label.toUpperCase()}
        </div>
      )}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: 10 }}
      >
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => pick(c)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              border: "none",
              background: c,
              cursor: "pointer",
              outline:
                value === c
                  ? `3px solid var(--primary)`
                  : c === "#ffffff"
                    ? "1px solid var(--border)"
                    : "none",
              outlineOffset: 2,
              boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #e0e0e0" : "none",
            }}
            title={c}
          />
        ))}
      </div>
      {recentColors.length > 0 && (
        <>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              letterSpacing: "0.07em",
              marginBottom: 6,
            }}
          >
            RECENT
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
            {recentColors.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pick(c)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 5,
                  border: "1px solid var(--border)",
                  background: c,
                  cursor: "pointer",
                  outline: value === c ? `3px solid var(--primary)` : "none",
                  outlineOffset: 2,
                }}
                title={c}
              />
            ))}
          </div>
        </>
      )}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--muted-foreground)",
          letterSpacing: "0.07em",
          marginBottom: 6,
        }}
      >
        CUSTOM
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: customHex,
            border: "1px solid var(--border)",
            flexShrink: 0,
          }}
        />
        <input
          type="color"
          value={customHex.match(/^#[0-9a-f]{6}$/i) ? customHex : "#000000"}
          onChange={(e) => {
            setCustomHex(e.target.value);
            onChange(e.target.value);
          }}
          style={{
            width: 28,
            height: 28,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        />
        <input
          type="text"
          value={customHex}
          onChange={(e) => {
            setCustomHex(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value);
          }}
          placeholder="#000000"
          style={{
            flex: 1,
            height: 28,
            padding: "0 8px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--muted)",
            fontSize: 11,
            color: "var(--foreground)",
            fontFamily: "monospace",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

interface IconPickerProps {
  onInsert: (html: string) => void;
  onClose: () => void;
}

export function IconPicker({ onInsert, onClose }: IconPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const tab = ICON_TABS[activeTab];

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        zIndex: 1000,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "0 6px 24px rgba(0,0,0,0.14)",
        width: 280,
      }}
    >
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 8px" }}>
        {ICON_TABS.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveTab(i)}
            style={{
              padding: "9px 10px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 600,
              color: activeTab === i ? "var(--primary)" : "var(--muted-foreground)",
              borderBottom: activeTab === i ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -1,
              transition: "color 0.1s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Grid */}
      <div
        style={{
          padding: "10px 12px 12px",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 4,
        }}
      >
        {tab.items.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.label}
            onClick={() => {
              onInsert(item.html);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "8px 4px",
              borderRadius: 8,
              border: "1px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--muted)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <span
              style={{
                fontSize: activeTab === 3 ? 12 : 18,
                lineHeight: 1,
                color: "var(--foreground)",
              }}
              dangerouslySetInnerHTML={{ __html: item.html }}
            />
            <span
              style={{
                fontSize: 9,
                color: "var(--muted-foreground)",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
      <div style={{ padding: "0 12px 10px" }}>
        <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: 0 }}>
          Click to insert at cursor. Shapes inherit text color.
        </p>
      </div>
    </div>
  );
}

export interface InsertItem {
  label: string;
  hint: string;
  action: () => void;
}
interface InsertMenuProps {
  items: InsertItem[];
  onClose: () => void;
}
export function InsertMenu({ items, onClose }: InsertMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        zIndex: 1000,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "6px 0",
        boxShadow: "0 6px 24px rgba(0,0,0,0.14)",
        minWidth: 210,
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => {
            item.action();
            onClose();
          }}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "8px 14px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>
            {item.label}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
            {item.hint}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── style panel ───────────────────────────────────────────────────────────────

// DocStyle mirrors the type in index.tsx — local to avoid circular import.
interface DocStyle {
  templateId: string;
  accentColor: string;
  accentStyle: "line" | "filled" | "minimal";
  paperBg: string;
}

interface StylePanelInlineProps {
  style: DocStyle;
  onChange: (patch: Partial<DocStyle>) => void;
  extraPanel?: React.ReactNode;
  onClose: () => void;
}

export function StylePanelInline({ style, onChange, extraPanel, onClose }: StylePanelInlineProps) {
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const [showPaperPicker, setShowPaperPicker] = useState(false);
  const [recentColors] = useState<string[]>([]);

  const selectTemplate = (tpl: (typeof TEMPLATES)[0]) => {
    onChange({ templateId: tpl.id, accentColor: tpl.accent });
  };

  return (
    <div
      className="w-full md:w-[268px] h-[45vh] md:h-auto border-b md:border-b-0 md:border-r"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 46,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          borderBottom: "1px solid var(--border)",
          background: "var(--muted)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Palette style={{ width: 14, height: 14, color: "var(--primary)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Style</span>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 24,
            height: 24,
            borderRadius: 5,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--muted-foreground)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Template */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              letterSpacing: "0.06em",
              marginBottom: 10,
            }}
          >
            TEMPLATE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {TEMPLATES.map((tpl) => {
              const active = style.templateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => selectTemplate(tpl)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 9,
                    border: active ? `2px solid var(--primary)` : "2px solid var(--border)",
                    background: active ? "rgba(217,119,87,0.06)" : "var(--muted)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    transition: "all 0.12s",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 32,
                      borderRadius: 3,
                      background: tpl.accent,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: active ? "var(--primary)" : "var(--foreground)",
                      }}
                    >
                      {tpl.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--muted-foreground)",
                        marginTop: 1,
                        lineHeight: 1.3,
                      }}
                    >
                      {tpl.description}
                    </div>
                  </div>
                  {tpl.atsSafe && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: "var(--forest)",
                        background: "rgba(47,107,79,0.1)",
                        padding: "2px 5px",
                        borderRadius: 4,
                        letterSpacing: "0.04em",
                        flexShrink: 0,
                      }}
                    >
                      ATS
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent color */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            ACCENT COLOR
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onChange({ accentColor: tpl.accent })}
                title={tpl.name}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  border: "none",
                  background: tpl.accent,
                  cursor: "pointer",
                  outline:
                    style.accentColor === tpl.accent
                      ? `3px solid ${tpl.accent}`
                      : "2px solid transparent",
                  outlineOffset: 2,
                  transform: style.accentColor === tpl.accent ? "scale(1.15)" : "scale(1)",
                  transition: "transform 0.12s, outline 0.12s",
                }}
              />
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowAccentPicker((v) => !v)}
              style={{
                height: 30,
                padding: "0 12px",
                borderRadius: 7,
                border: "1px solid var(--border)",
                background: "var(--muted)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11,
                color: "var(--foreground)",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <div
                style={{ width: 14, height: 14, borderRadius: 3, background: style.accentColor }}
              />{" "}
              Custom color
            </button>
            {showAccentPicker && (
              <ColorPickerPopover
                value={style.accentColor}
                onChange={(c) => {
                  onChange({ accentColor: c });
                  setShowAccentPicker(false);
                }}
                onClose={() => setShowAccentPicker(false)}
                recentColors={recentColors}
              />
            )}
          </div>
        </div>

        {/* Paper background */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            PAPER BACKGROUND
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 6,
              marginBottom: 8,
            }}
          >
            {PAPER_COLORS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange({ paperBg: p.value })}
                title={p.name}
                style={{
                  height: 34,
                  borderRadius: 7,
                  border:
                    style.paperBg === p.value
                      ? "2px solid var(--primary)"
                      : "1px solid var(--border)",
                  background: p.value,
                  cursor: "pointer",
                  boxShadow: p.value === "#ffffff" ? "inset 0 0 0 1px #e0e0e0" : "none",
                }}
              />
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowPaperPicker((v) => !v)}
              style={{
                height: 30,
                padding: "0 12px",
                borderRadius: 7,
                border: "1px solid var(--border)",
                background: "var(--muted)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11,
                color: "var(--foreground)",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: style.paperBg,
                  border: "1px solid var(--border)",
                }}
              />{" "}
              Custom color
            </button>
            {showPaperPicker && (
              <ColorPickerPopover
                value={style.paperBg}
                onChange={(c) => {
                  onChange({ paperBg: c });
                  setShowPaperPicker(false);
                }}
                onClose={() => setShowPaperPicker(false)}
                recentColors={recentColors}
              />
            )}
          </div>
        </div>

        {/* Section dividers (accent style) */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            SECTION DIVIDERS
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["line", "filled", "minimal"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ accentStyle: s })}
                style={{
                  flex: 1,
                  height: 30,
                  borderRadius: 7,
                  fontFamily: "inherit",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  border:
                    style.accentStyle === s
                      ? "2px solid var(--primary)"
                      : "2px solid var(--border)",
                  background: style.accentStyle === s ? "rgba(217,119,87,0.08)" : "var(--muted)",
                  color: style.accentStyle === s ? "var(--primary)" : "var(--muted-foreground)",
                  textTransform: "capitalize",
                  transition: "all 0.15s",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {extraPanel && (
        <div style={{ borderTop: "1px solid var(--border)", flex: 1 }}>{extraPanel}</div>
      )}
    </div>
  );
}
