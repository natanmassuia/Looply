// Canonical phone normalization for actor authorization lookups.
// Shared utility ONLY — authority never comes from a phone itself.
// V1 rules (Brazil-first, conservative):
//   - strip spaces, parentheses, dots and hyphens;
//   - "+<10..15 digits>" is already canonical E.164-like → returned as-is;
//   - "55" + 10/11 digits (12-13 total) is treated as country-coded → "+55...";
//   - bare 10/11 digits get the "+55" prefix;
//   - anything else is invalid → null. No substring matching anywhere.

export function normalizePhoneNumber(input: string): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return null;
  const hasPlus = cleaned.startsWith("+");
  const digits = hasPlus ? cleaned.slice(1) : cleaned;

  if (hasPlus) {
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  return null;
}

// Mask all but the last 4 digits — for logs and other PII-sensitive output.
export function maskPhone(phone: string): string {
  return `******${phone.slice(-4)}`;
}
