import React, { useState } from "react";
import { inputStyle } from "./styles";

/** Sentinel select value for the "Other…" choice (won't collide with real values). */
const OTHER = "__other__";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * A `<select>` that includes an "Other…" choice. Picking it (or loading a value
 * that isn't one of the options) reveals a free-text input so the user can define
 * their own value, which is stored as-is via `onChange`.
 */
export function SelectWithOther({
  value,
  onChange,
  options,
  placeholder = "Select…",
  otherLabel = "Other…",
  otherPlaceholder = "Please specify",
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
  style?: React.CSSProperties;
}) {
  const valueIsCustom = value !== "" && !options.some((o) => o.value === value);
  // Track an explicit "Other" pick so the text field stays open while it's empty.
  const [otherMode, setOtherMode] = useState(valueIsCustom);

  const showOther = otherMode || valueIsCustom;
  const selectValue = showOther ? OTHER : value;

  const handleSelect = (v: string) => {
    if (v === OTHER) {
      setOtherMode(true);
      onChange("");
    } else {
      setOtherMode(false);
      onChange(v);
    }
  };

  return (
    <>
      <select
        value={selectValue}
        onChange={(e) => handleSelect(e.target.value)}
        style={{ ...inputStyle, cursor: "pointer", ...style }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={OTHER}>{otherLabel}</option>
      </select>
      {showOther && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder}
          aria-label={otherPlaceholder}
          style={{ ...inputStyle, marginTop: 8, ...style }}
        />
      )}
    </>
  );
}
