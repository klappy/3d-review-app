/**
 * Default title of a passage link added without one (0.24.1 persona A: a titleless link showed as "example.org", the
 * bare host, and that is what participants saw). The link's host and path, e.g. "example.org/sample-genesis-1";
 * "Link" when there is no path to show. Never the bare host name.
 */
export function linkTitle(url: string, max = 120): string {
  let u: URL;
  try { u = new URL(url); } catch { return "Link"; }
  let path = u.pathname.replace(/\/+$/, "");
  try { path = decodeURIComponent(path); } catch { /* keep it encoded */ }
  // Review nit on #404: a decoded path can carry control characters (%0A, %00); clean it as passages.ts cleanText does
  // (not imported: passages.ts imports this file).
  path = path.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!path || path === "/") return "Link";
  const title = `${u.hostname.replace(/^www\./i, "")}${path}`;
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}
