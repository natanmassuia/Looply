import { useState } from "react";
import { initials, avatarColor } from "../../../lib/format";

// Contact avatar used everywhere a conversation contact is shown. Shows the
// manually-set photo when present, otherwise deterministic coloured initials
// (WhatsApp Cloud API never delivers a profile photo).
export default function ContactAvatar({
  name,
  seed,
  avatarUrl,
  sizeClass = "h-10 w-10",
  textClass = "text-xs",
}: {
  name: string;
  seed: string;
  avatarUrl?: string | null;
  sizeClass?: string;
  textClass?: string;
}) {
  const { bg, fg } = avatarColor(seed || name);
  const [failed, setFailed] = useState(false);
  const showImg = avatarUrl && !failed;
  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${textClass}`}
      style={showImg ? undefined : { backgroundColor: bg, color: fg }}
    >
      {showImg ? (
        <img src={avatarUrl} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </div>
  );
}
