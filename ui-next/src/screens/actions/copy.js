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

// Share a survey link out (SharePhone's share-out icon): the OS share sheet where the browser has one (navigator.share, phones),
// else the clipboard. The link goes as text, exactly as the row shows it (no URL is made up from the fixture's short host).
// Resolves "shared", "cancelled" (the person closed the sheet), "copied", or false (neither is available here).
export async function shareText(text, title, nav = globalThis.navigator) {
  if (typeof nav?.share === "function") {
    try {
      await nav.share({ title, text });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  return (await copyText(text, nav)) ? "copied" : false;
}
