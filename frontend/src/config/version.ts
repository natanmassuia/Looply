declare const __APP_VERSION__: string | undefined;
declare const __COMMIT_HASH__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.1.0";
export const COMMIT_HASH = typeof __COMMIT_HASH__ !== "undefined" ? __COMMIT_HASH__ : "dev";
export const BUILD_TIME = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "";

export function formatBuildDate(isoString: string): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "";
  }
}
