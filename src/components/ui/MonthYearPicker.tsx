import { MONTHS, yearRange } from "@/lib/profileOptions";

/** Stores value as "Month YYYY" string, e.g. "January 2020" */
export function MonthYearPicker({
  value,
  onChange,
  placeholder,
  allowPresent,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  allowPresent?: boolean;
  style?: React.CSSProperties;
}) {
  const parts = value.split(" ");
  const month = MONTHS.includes(parts[0]) ? parts[0] : "";
  const year = parts[1] ?? "";

  const sStyle: React.CSSProperties = {
    ...style,
    flex: 1,
    appearance: "none",
    WebkitAppearance: "none",
    cursor: "pointer",
  };

  function update(m: string, y: string) {
    if (!m && !y) { onChange(""); return; }
    if (allowPresent && y === "Present") { onChange("Present"); return; }
    onChange([m, y].filter(Boolean).join(" "));
  }

  const years = yearRange();

  return (
    <div style={{ display: "flex", gap: 6, flex: 1 }}>
      <select
        value={month}
        onChange={(e) => update(e.target.value, year)}
        aria-label={placeholder ? `${placeholder} month` : "Month"}
        style={sStyle}
      >
        <option value="">Month</option>
        {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>

      <select
        value={year}
        onChange={(e) => update(month, e.target.value)}
        aria-label={placeholder ? `${placeholder} year` : "Year"}
        style={sStyle}
      >
        <option value="">Year</option>
        {allowPresent && <option value="Present">Present</option>}
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
