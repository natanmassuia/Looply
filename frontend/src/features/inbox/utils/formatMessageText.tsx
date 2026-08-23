import type { ReactNode } from "react";

export interface FormatOptions {
  searchQuery?: string;
  isSearchActive?: boolean;
}

export function HighlightedText({
  text,
  query,
}: {
  text: string;
  query?: string;
  isActive?: boolean;
}) {
  if (!query || !query.trim()) return <>{text}</>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-300 dark:bg-yellow-500/40 text-black dark:text-white rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

const FORMAT_RE =
  /(https?:\/\/[^\s]+)|(@\d+)|(```[\s\S]+?```|`[^`]+`)|(\*[^*]+\*)|(_[^_]+_)|(~[^~]+~)/g;

export function formatMessageText(
  content: string,
  options: FormatOptions = {},
): ReactNode {
  const { searchQuery = "", isSearchActive = false } = options;

  if (!content) return null;

  const parts = content.split(FORMAT_RE);

  const formattedParts = parts
    .map((part, i) => {
      if (!part) return null;

      // Link formatting
      if (part.startsWith("http://") || part.startsWith("https://")) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--looply-color-text-brand,#2563eb)] hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }

      // Mention formatting (@5511999998888)
      if (part.startsWith("@") && /^\d+$/.test(part.substring(1))) {
        const rawPhone = part.substring(1);
        let displayPhone = part;
        if (rawPhone.length >= 10 && rawPhone.startsWith("55")) {
          displayPhone = `@${rawPhone.replace(
            /(\d{2})(\d{2})(\d{5})(\d{4})/,
            "+$1 $2 $3-$4",
          )}`;
        }
        return (
          <span
            key={i}
            className="text-[var(--looply-color-text-brand,#2563eb)] font-semibold"
          >
            {displayPhone}
          </span>
        );
      }

      // Code blocks
      if (part.startsWith("`")) {
        const isBlock = part.startsWith("```");
        const codeContent = part.replace(/^```|```$|^`|`$/g, "");

        return (
          <code
            key={i}
            className={`bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono text-[12px] text-pink-600 dark:text-pink-400 ${
              isBlock ? "block my-1.5 whitespace-pre overflow-x-auto p-2" : ""
            }`}
          >
            {codeContent}
          </code>
        );
      }

      // Bold (*text*)
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return (
          <strong key={i} className="font-bold">
            {part.slice(1, -1)}
          </strong>
        );
      }

      // Italic (_text_)
      if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
        return (
          <em key={i} className="italic">
            {part.slice(1, -1)}
          </em>
        );
      }

      // Strikethrough (~text~)
      if (part.startsWith("~") && part.endsWith("~") && part.length > 2) {
        return (
          <del key={i} className="line-through opacity-75">
            {part.slice(1, -1)}
          </del>
        );
      }

      // Search highlighting
      if (searchQuery && isSearchActive) {
        return (
          <HighlightedText
            key={i}
            text={part}
            query={searchQuery}
            isActive={isSearchActive}
          />
        );
      }

      return part;
    })
    .filter(Boolean);

  return <>{formattedParts}</>;
}
