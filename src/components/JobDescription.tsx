import React, { useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { Loader2, ExternalLink } from "lucide-react";
import { importJobFromUrl } from "@/services/jobScanService";
import { toMarkdown } from "@/lib/formatJobDescription";

// Renders a job description as formatted Markdown (headings, bullet lists, bold,
// links). If the description is missing — common for ATS feeds that only list
// jobs (Greenhouse/Workable/SmartRecruiters) — it lazily fetches the full posting
// from its URL so the user still gets the complete description, benefits,
// requirements, etc., without leaving the app.

const headingStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: "16px 0 6px", lineHeight: 1.35 };
const subHeadingStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "var(--foreground)", margin: "12px 0 4px", lineHeight: 1.35 };

const MD_COMPONENTS = {
  h1: (p: any) => <h3 style={headingStyle} {...p} />,
  h2: (p: any) => <h3 style={headingStyle} {...p} />,
  h3: (p: any) => <h4 style={subHeadingStyle} {...p} />,
  h4: (p: any) => <h4 style={subHeadingStyle} {...p} />,
  p: (p: any) => <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.6, color: "var(--foreground)" }} {...p} />,
  ul: (p: any) => <ul style={{ margin: "0 0 10px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }} {...p} />,
  ol: (p: any) => <ol style={{ margin: "0 0 10px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }} {...p} />,
  li: (p: any) => <li style={{ fontSize: 13, lineHeight: 1.55, color: "var(--foreground)" }} {...p} />,
  strong: (p: any) => <strong style={{ fontWeight: 700 }} {...p} />,
  em: (p: any) => <em style={{ fontStyle: "italic" }} {...p} />,
  a: (p: any) => <a style={{ color: "var(--primary)", textDecoration: "underline" }} target="_blank" rel="noreferrer" {...p} />,
  hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "14px 0" }} />,
};

export function JobDescription({
  description, url, onLoaded,
}: {
  description?: string;
  url?: string;
  /** Called with the fetched text when a missing description is lazily loaded (e.g. to persist it). */
  onLoaded?: (text: string) => void;
}) {
  const [text, setText] = useState(description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setText(description ?? "");
    setError("");
    const missing = !description || !description.trim();
    if (!missing || !url) return;

    let cancelled = false;
    setLoading(true);
    importJobFromUrl(url)
      .then((d) => { if (!cancelled) { const t = (d.description ?? "").trim(); setText(t); if (t) onLoaded?.(t); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load the full description."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, url]);

  const md = useMemo(() => toMarkdown(text), [text]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted-foreground)" }}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading the full description…
      </div>
    );
  }

  if (md) {
    return <div style={{ fontSize: 13, color: "var(--foreground)" }}>
      <Markdown rehypePlugins={[rehypeSanitize]} components={MD_COMPONENTS}>{md}</Markdown>
    </div>;
  }

  return (
    <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
      {error || "No description preview is available for this posting."}
      {url && (
        <>
          {" "}
          <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 3 }}>
            Open the original posting <ExternalLink className="w-3 h-3" />
          </a>
        </>
      )}
    </div>
  );
}
