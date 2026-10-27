import { initials } from "../lib/format";

// Single client "badge": the logo when set, otherwise the brand-coloured
// initials. One fallback colour and one initials rule (initials()) so the same
// client looks identical in Dashboard, Demandas, Inbox and the client screens.
export default function ClientAvatar({
  name,
  logoUrl,
  brandColor,
  sizeClass = "h-10 w-10",
  radiusClass = "rounded-xl",
  textClass = "text-xs",
}: {
  name: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  sizeClass?: string;
  radiusClass?: string;
  textClass?: string;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={`${sizeClass} shrink-0 ${radiusClass} border border-[var(--looply-color-border-default)] object-cover`}
      />
    );
  }
  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center ${radiusClass} ${textClass} font-bold text-[var(--looply-color-text-on-brand)]`}
      style={{ backgroundColor: brandColor || "var(--looply-color-action-primary)" }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
