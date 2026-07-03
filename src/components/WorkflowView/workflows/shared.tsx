import { Loader2, Sparkles } from "lucide-react";
import type { WorkflowConfig } from "@/config/workflows";

interface FormCardProps {
  config: WorkflowConfig;
  formData: Record<string, any>;
  fileData: Record<string, any>;
  isGenerating: boolean;
  handleInputChange: (id: string, value: string) => void;
  handleFileChange: (id: string, file: File | null) => void;
  handleInitialSubmit: (e: React.FormEvent) => void;
}

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header
      style={{
        padding: "20px 32px",
        borderBottom: "1px solid var(--border)",
        background: "var(--background)",
        flexShrink: 0,
      }}
    >
      <h2
        className="font-display"
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.015em",
          color: "var(--foreground)",
          margin: "0 0 4px",
        }}
      >
        {title}
      </h2>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{description}</p>
    </header>
  );
}

export function MentorCard({
  children,
  style = {},
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 24,
        boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function FormCard({
  config,
  formData,
  fileData,
  isGenerating,
  handleInputChange,
  handleFileChange,
  handleInitialSubmit,
}: FormCardProps) {
  const fieldStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--muted)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "0 16px",
    fontFamily: "inherit",
    fontSize: 14,
    color: "var(--foreground)",
    outline: "none",
  };

  return (
    <MentorCard>
      <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>Details</div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
          Provide the info below to get started.
        </div>
      </div>
      <form
        onSubmit={handleInitialSubmit}
        style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}
      >
        {config.fields.map((field: any) => (
          <div key={field.id}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--foreground)",
                marginBottom: 8,
              }}
            >
              {field.label}
              {field.required === false && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: "var(--muted-foreground)",
                    marginLeft: 6,
                  }}
                >
                  (optional)
                </span>
              )}
            </label>
            {field.type === "textarea" ? (
              <textarea
                required={field.required !== false}
                placeholder={field.placeholder}
                value={formData[field.id] || ""}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                style={{
                  ...fieldStyle,
                  height: "auto",
                  minHeight: 120,
                  padding: "12px 16px",
                  resize: "vertical",
                }}
              />
            ) : field.type === "file" ? (
              <input
                type="file"
                accept={field.accept}
                onChange={(e) => handleFileChange(field.id, e.target.files?.[0] || null)}
                style={{ ...fieldStyle, height: 48, cursor: "pointer" }}
              />
            ) : field.type === "select" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <select
                  required={field.required !== false && formData[`${field.id}_select`] !== "Other"}
                  value={formData[`${field.id}_select`] || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    handleInputChange(`${field.id}_select`, v);
                    handleInputChange(field.id, v === "Other" ? "" : v);
                  }}
                  style={{ ...fieldStyle, height: 52, cursor: "pointer" }}
                >
                  <option value="" disabled={field.required !== false}>
                    Select an option…
                  </option>
                  {field.options?.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {field.allowCustom && formData[`${field.id}_select`] === "Other" && (
                  <input
                    type="text"
                    required={field.required !== false}
                    placeholder="Please specify…"
                    value={formData[field.id] || ""}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    style={{ ...fieldStyle, height: 52 }}
                  />
                )}
              </div>
            ) : (
              <input
                type={field.type}
                required={field.required !== false}
                placeholder={field.placeholder}
                value={formData[field.id] || ""}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                style={{ ...fieldStyle, height: 52 }}
              />
            )}
          </div>
        ))}
        <button
          type="submit"
          disabled={isGenerating}
          style={{
            height: 52,
            background: "var(--primary)",
            color: "#FFF",
            border: "1px solid var(--primary)",
            borderRadius: 14,
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 600,
            cursor: isGenerating ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 14px rgba(217,119,87,0.25)",
            opacity: isGenerating ? 0.7 : 1,
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Starting…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Start session
            </>
          )}
        </button>
      </form>
    </MentorCard>
  );
}
