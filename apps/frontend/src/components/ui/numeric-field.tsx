'use client';
import { useState } from 'react';

interface NumericFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
}

/** Campo numérico controlado que aceita vírgula decimal e confirma no blur/Enter. */
export function NumericField({ label, value, onChange, min }: NumericFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft.replace(',', '.'));
    if (draft.trim() !== '' && Number.isFinite(parsed) && parsed >= (min ?? -100000))
      onChange(parsed);
    setDraft(null);
  };
  return (
    <label className="form-row">
      <span className="muted">{label}</span>
      <input
        className="field"
        type="text"
        inputMode="decimal"
        value={draft ?? String(value)}
        onFocus={() => setDraft(String(value))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
