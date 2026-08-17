import { type InputHTMLAttributes } from "react";

// F14.5 — adaptive Brazilian phone input. Display formats for reading;
// canonical value is raw digits (what the backend accepts as a plain string).
// Formatting is UX only — validation stays on the server.

function formatPhoneForDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function normalizePhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

// Serialize the raw digit value for the API (the canonical string).
export function serializePhoneForApi(digits: string): string {
  return digits.replace(/\D/g, "");
}

// Hydrate an existing server value (could already be formatted or raw digits).
export function hydratePhone(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

interface PhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string;
  onChange: (value: string) => void;
}

export default function PhoneInput({ value, onChange, ...rest }: PhoneInputProps) {
  return (
    <input
      {...rest}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      className={rest.className ?? "input w-full"}
      value={formatPhoneForDisplay(value)}
      onChange={(e) => onChange(normalizePhoneInput(e.target.value))}
    />
  );
}
