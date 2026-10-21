// UI Next (v4) actions lane: copy a survey link where the browser allows it. Status: provisional.
// navigator.clipboard needs a secure context (https or localhost); elsewhere, or when the write is refused, resolves false and
// the caller says so on the control. The link text is the one the row shows (fixture data until links are issued: RESULTS debt 1).
export async function copyText(text, nav = globalThis.navigator) {
  try {
    if (!nav?.clipboard?.writeText) return false;
    await nav.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
