import { MonthYearPicker } from "@/components/ui/MonthYearPicker";

/**
 * End-date input with a "Present" toggle. When "Present" is checked the role is
 * marked ongoing (`current: true`) and the date is cleared — the canonical shape
 * (see `@/lib/workExperience`). Replaces the buried "Present" dropdown option so
 * the choice is explicit everywhere job experience is entered.
 */
export function EndDateField({
  endDate,
  current,
  onChange,
  style,
  id,
}: {
  endDate: string;
  current: boolean;
  onChange: (next: { endDate: string; current: boolean }) => void;
  style?: React.CSSProperties;
  /** Unique-ish id for the checkbox/label association. */
  id?: string;
}) {
  const checkboxId = `${id ?? "enddate"}-present`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {current ? (
        <div
          aria-label="End date: Present"
          style={{
            ...style,
            display: "flex",
            alignItems: "center",
            color: "var(--primary)",
            fontWeight: 600,
            fontSize: 13,
            background: "color-mix(in srgb, var(--primary) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
          }}
        >
          Present
        </div>
      ) : (
        <MonthYearPicker
          value={endDate}
          onChange={(v) => onChange({ endDate: v, current: false })}
          placeholder="End date"
          style={style}
        />
      )}

      <label
        htmlFor={checkboxId}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 12,
          fontWeight: 500,
          color: "var(--muted-foreground)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={current}
          onChange={(e) =>
            onChange({
              // Selecting Present clears any typed end date; clearing it leaves
              // the field blank for the user to fill in.
              endDate: "",
              current: e.target.checked,
            })
          }
          style={{ accentColor: "var(--primary)", width: 15, height: 15, cursor: "pointer" }}
        />
        I currently work here (Present)
      </label>
    </div>
  );
}
