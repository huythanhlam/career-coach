import React, { useEffect, useState } from "react";
import { ComboInput } from "./ComboInput";
import { KNOWN_LOCATIONS, normalizeLocation } from "@/lib/locations";

/**
 * Shared location field: a suggestion combo that canonicalizes its value on blur,
 * so "Austin, TX", "Austin, Texas", and "austin tx" all resolve to one stored
 * value. Use this for every place a user types a city/state/country.
 */
export function LocationInput({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  // Local draft lets the user type freely; we snap to canonical form on blur.
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);

  const commit = () => {
    const normalized = normalizeLocation(text);
    setText(normalized);
    if (normalized !== (value ?? "")) onChange(normalized);
  };

  return (
    <ComboInput
      value={text}
      onChange={setText}
      onBlur={commit}
      options={KNOWN_LOCATIONS}
      placeholder={placeholder}
      style={style}
    />
  );
}
