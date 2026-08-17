import { useState } from "react";
import { IconCheck, IconPlus, IconX } from "./Icons";

// Structured channel selection (F14). Values are stored as human-readable
// labels in Client.channels (existing String[]). "Outro" is a UI affordance:
// its custom values are stored as their own entries, never the literal "Outro".
export const CHANNEL_OPTIONS = [
  "Instagram",
  "TikTok",
  "Facebook",
  "LinkedIn",
  "YouTube",
  "WhatsApp",
  "E-mail",
  "Site",
] as const;

export const OTHER_LABEL = "Outro";

export function splitChannels(selected: string[]): { predefined: string[]; custom: string[] } {
  const predefined = selected.filter((c) => (CHANNEL_OPTIONS as readonly string[]).includes(c));
  const custom = selected.filter((c) => !(CHANNEL_OPTIONS as readonly string[]).includes(c));
  return { predefined, custom };
}

export default function ChannelPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { predefined, custom } = splitChannels(value);
  const [draft, setDraft] = useState("");
  const [otherOpen, setOtherOpen] = useState(custom.length > 0);

  const togglePredefined = (label: string) => {
    onChange(
      predefined.includes(label)
        ? value.filter((c) => c !== label)
        : [...value, label],
    );
  };

  const toggleOther = () => {
    if (otherOpen) {
      // Closing "Outro" discards custom entries ("Outro" itself is never stored).
      onChange(value.filter((c) => (CHANNEL_OPTIONS as readonly string[]).includes(c)));
    }
    setOtherOpen(!otherOpen);
  };

  const addCustom = () => {
    const name = draft.trim().slice(0, 60);
    if (!name) return;
    if (value.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    if (value.length >= 10) return;
    onChange([...value, name]);
    setDraft("");
  };

  const removeCustom = (name: string) => onChange(value.filter((c) => c !== name));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Canais">
        {CHANNEL_OPTIONS.map((label) => {
          const active = predefined.includes(label);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              onClick={() => togglePredefined(label)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                active
                  ? "border-[var(--looply-color-text-brand)] bg-[var(--looply-color-text-brand)]/10 text-[var(--looply-color-text-brand)]"
                  : "border-[var(--looply-color-border-default)] text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
              }`}
            >
              {active && <IconCheck className="h-3.5 w-3.5" />}
              {label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={otherOpen}
          onClick={toggleOther}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
            otherOpen
              ? "border-[var(--looply-color-text-brand)] bg-[var(--looply-color-text-brand)]/10 text-[var(--looply-color-text-brand)]"
              : "border-[var(--looply-color-border-default)] text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
          }`}
        >
          {otherOpen && <IconCheck className="h-3.5 w-3.5" />}
          {OTHER_LABEL}
        </button>
      </div>

      {otherOpen && (
        <div className="space-y-1.5">
          <label className="label" htmlFor="custom-channel-input">
            Qual canal?
          </label>
          <div className="flex gap-1.5">
            <input
              id="custom-channel-input"
              className="input flex-1"
              value={draft}
              maxLength={60}
              placeholder="Ex.: Pinterest, Telegram…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button type="button" className="btn-secondary btn-sm shrink-0" onClick={addCustom} aria-label="Adicionar canal personalizado">
              <IconPlus className="h-4 w-4" />
            </button>
          </div>
          {custom.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {custom.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--looply-color-text-primary)]"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => removeCustom(name)}
                    aria-label={`Remover ${name}`}
                    className="rounded-full p-0.5 text-[var(--looply-color-text-muted)] transition-colors hover:text-[var(--looply-color-status-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
                  >
                    <IconX className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
