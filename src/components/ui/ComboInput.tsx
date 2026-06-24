import { useId } from "react";

/** Searchable dropdown that also accepts free text */
export function ComboInput({
  id,
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  style,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  options: string[];
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const autoId = useId();
  const listId = `combo-${id ?? autoId}`;

  return (
    <>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        list={listId}
        autoComplete="off"
        style={style}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
