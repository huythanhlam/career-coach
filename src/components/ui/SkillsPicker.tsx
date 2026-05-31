import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { SKILLS_BY_CATEGORY } from "@/lib/profileOptions";

interface Props {
  selected: string[];
  onChange: (skills: string[]) => void;
}

export function SkillsPicker({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(skill: string) {
    onChange(
      selected.includes(skill)
        ? selected.filter((s) => s !== skill)
        : [...selected, skill]
    );
  }

  const q = query.toLowerCase();
  const filtered = Object.entries(SKILLS_BY_CATEGORY).reduce<Record<string, string[]>>(
    (acc, [cat, skills]) => {
      const matches = skills.filter((s) => s.toLowerCase().includes(q));
      if (matches.length) acc[cat] = matches;
      return acc;
    },
    {}
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-xs px-3 py-2 rounded-xl transition-colors"
        style={{
          background: "var(--muted)",
          border: "1px solid var(--border)",
          color: selected.length ? "var(--primary)" : "var(--muted-foreground)",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        <span>
          {selected.length === 0
            ? "Browse common skills…"
            : `${selected.length} skill${selected.length === 1 ? "" : "s"} selected`}
        </span>
        <ChevronDown
          className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute z-50 mt-1 rounded-2xl overflow-hidden"
          style={{
            width: "100%",
            minWidth: 280,
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
            maxHeight: 360,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills…"
              className="flex-1 text-xs outline-none bg-transparent"
              style={{ color: "var(--foreground)", fontFamily: "inherit" }}
            />
          </div>

          {/* Grouped list */}
          <div className="overflow-y-auto flex-1 py-1">
            {Object.keys(filtered).length === 0 && (
              <p className="text-xs px-4 py-3" style={{ color: "var(--muted-foreground)" }}>
                No skills match "{query}"
              </p>
            )}
            {Object.entries(filtered).map(([category, skills]) => (
              <div key={category}>
                <div
                  className="px-3 py-1.5 text-xs font-bold tracking-widest uppercase sticky top-0"
                  style={{
                    color: "var(--muted-foreground)",
                    background: "var(--card)",
                    letterSpacing: "0.06em",
                  }}
                >
                  {category}
                </div>
                {skills.map((skill) => {
                  const checked = selected.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggle(skill)}
                      className="flex items-center gap-2.5 w-full px-3 py-1.5 text-xs text-left transition-colors hover:bg-[var(--muted)]"
                      style={{ color: "var(--foreground)", fontFamily: "inherit" }}
                    >
                      <span
                        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          background: checked ? "var(--primary)" : "var(--muted)",
                          border: checked ? "none" : "1px solid var(--border)",
                        }}
                      >
                        {checked && <Check className="w-2.5 h-2.5" style={{ color: "#fff" }} />}
                      </span>
                      {skill}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          {selected.length > 0 && (
            <div
              className="px-3 py-2 flex items-center justify-between"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {selected.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: "var(--destructive)", fontFamily: "inherit" }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
