/**
 * One home for the SHA-256 and HMAC-SHA256 helpers (audit E7, train 22). Every caller used the same Web Crypto calls,
 * the same UTF-8 encoding of strings, lowercase two-digit hex for digests and unpadded base64url (- and _) for MACs;
 * test/crypto.test.ts pins fixed vectors taken from the copies this module replaced.
 */
const utf8 = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** SHA-256 of the UTF-8 bytes of a string, lowercase hex. */
export async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", utf8.encode(text)));
}
/** SHA-256 of raw bytes, lowercase hex. */
export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", bytes));
}
/** A raw HMAC-SHA256 key from the UTF-8 bytes of a secret (not extractable). */
export function hmacSha256Key(secret: string, usages: ("sign" | "verify")[] = ["sign"]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", utf8.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}
/** HMAC-SHA256 of the UTF-8 bytes of a message, unpadded base64url. */
export async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", await hmacSha256Key(secret), utf8.encode(message)));
}
