// Separate 256-bit key, independent of session/confirmation signing.
// Rotation also invalidates keyed lookup for exported but unredeemed codes.
// Retire/revoke all outstanding codes before rotation, or introduce versioned
// lookup keys. Never log the key, code, plaintext, or ciphertext.
import { CapError } from "./handlers/errors";
import { b64url, b64urlDecode } from "./receipt";

const enc = new TextEncoder();
function keyBytes(secret: string | undefined): Uint8Array {
  if (!secret) throw new CapError("RESERVED_NOT_BUILT", "code escrow key is not configured");
  let bytes: Uint8Array;
  try { bytes = b64urlDecode(secret); } catch { throw new CapError("RESERVED_NOT_BUILT", "code escrow key is invalid"); }
  if (bytes.length !== 32) throw new CapError("RESERVED_NOT_BUILT", "code escrow key must contain 256 random bits");
  return bytes;
}
async function key(secret: string | undefined): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes(secret), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function hashKey(secret: string | undefined): Promise<CryptoKey> {
  const material=await crypto.subtle.importKey("raw",keyBytes(secret),"HKDF",false,["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name:"HKDF",hash:"SHA-256",salt:enc.encode("3d-review/code-hash/salt/v1"),info:enc.encode("3d-review/code-hash/hmac/v1")},
    material,{name:"HMAC",hash:"SHA-256",length:256},false,["sign"]);
}
/** Opaque keyed lookup digest. A leaked D1 database alone cannot brute-force short codes. */
export async function codeHash(secret:string|undefined,code:string):Promise<string> {
  const mac=await crypto.subtle.sign("HMAC",await hashKey(secret),enc.encode(code.trim().toUpperCase()));
  return [...new Uint8Array(mac)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function aad(id: string, surveyId: string, batchId: string): Uint8Array {
  return enc.encode(JSON.stringify([id, surveyId, batchId]));
}
export async function encryptCode(secret: string | undefined, code: string, id: string, surveyId: string, batchId: string): Promise<{ciphertext:string;iv:string}> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:aad(id,surveyId,batchId)},await key(secret),enc.encode(code));
  return {ciphertext:b64url(ciphertext),iv:b64url(iv)};
}
export async function decryptCode(secret: string | undefined, ciphertext: string, iv: string, id: string, surveyId: string, batchId: string): Promise<string> {
  try {
    const bytes = await crypto.subtle.decrypt({name:"AES-GCM",iv:b64urlDecode(iv),additionalData:aad(id,surveyId,batchId)},await key(secret),b64urlDecode(ciphertext));
    return new TextDecoder().decode(bytes);
  } catch {
    // Includes wrong key, bad tag, bad AAD. No ciphertext or secret in errors.
    throw new CapError("RESERVED_NOT_BUILT", "code escrow could not be decrypted");
  }
}
