export type GoogleFont =
  | "Inter"
  | "Merriweather"
  | "Playfair Display"
  | "Lato"
  | "Source Sans Pro"
  | "Montserrat"
  | "EB Garamond"
  | "Raleway"
  | "Crimson Text"
  | "DM Sans";

export type FontDensity = "compact" | "normal" | "spacious";
export type PhotoShape = "circle" | "rounded" | "square";
export type AccentStyle = "line" | "filled" | "minimal";
export type ResumeLayout = "single" | "two-column";

export interface ResumeStyleConfig {
  templateId: string;
  accentColor: string;
  headingFont: GoogleFont;
  bodyFont: GoogleFont;
  density: FontDensity;
  layout: ResumeLayout;
  /** Section keys in sidebar when layout === "two-column" */
  sidebarSections: string[];
  /** Ordered list of all section keys for the main column */
  sectionOrder: string[];
  contactIcons: boolean;
  profilePhoto: {
    url: string | null;
    shape: PhotoShape;
  };
  accentStyle: AccentStyle;
  /** When true, export as clean text-only PDF for ATS parsers */
  atsSafeExport: boolean;
}

export const ACCENT_COLORS = [
  { name: "Terracotta", value: "#D97757" },
  { name: "Forest", value: "#2F6B4F" },
  { name: "Slate", value: "#475569" },
  { name: "Indigo", value: "#4F46E5" },
  { name: "Rose", value: "#E11D48" },
  { name: "Amber", value: "#D97706" },
  { name: "Teal", value: "#0D9488" },
  { name: "Navy", value: "#1E3A5F" },
  { name: "Charcoal", value: "#374151" },
  { name: "Burgundy", value: "#881337" },
  { name: "Olive", value: "#4D7C0F" },
  { name: "Custom", value: "" },
] as const;

export const GOOGLE_FONTS: GoogleFont[] = [
  "Inter",
  "Merriweather",
  "Playfair Display",
  "Lato",
  "Source Sans Pro",
  "Montserrat",
  "EB Garamond",
  "Raleway",
  "Crimson Text",
  "DM Sans",
];

export const DEFAULT_STYLE_CONFIG: ResumeStyleConfig = {
  templateId: "modern-clean",
  accentColor: "#2F6B4F",
  headingFont: "Inter",
  bodyFont: "Inter",
  density: "normal",
  layout: "single",
  sidebarSections: [],
  sectionOrder: ["contact", "summary", "experience", "education", "skills"],
  contactIcons: true,
  profilePhoto: { url: null, shape: "circle" },
  accentStyle: "line",
  atsSafeExport: true,
};

/** Maps density to CSS line-height and font-size values */
export const DENSITY_MAP: Record<FontDensity, { lineHeight: string; fontSize: string }> = {
  compact: { lineHeight: "1.4", fontSize: "10pt" },
  normal: { lineHeight: "1.6", fontSize: "11pt" },
  spacious: { lineHeight: "1.9", fontSize: "12pt" },
};
