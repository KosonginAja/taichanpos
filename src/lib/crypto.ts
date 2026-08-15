import crypto from "crypto";

const ITERATIONS = 10000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";
const SECRET_KEY = process.env.BETTER_AUTH_SECRET || "pos-gweh-super-secret-key-32-chars-long!"; // Must be 32 bytes for aes-256-cbc

// Ensure secret key is exactly 32 bytes
function getSecretKey() {
  return crypto.createHash("sha256").update(SECRET_KEY).digest();
}

/**
 * Hash a password using PBKDF2
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return hash === originalHash;
}

/**
 * Encrypt data into a secure token
 */
export function encryptToken(data: object): string {
  const text = JSON.stringify(data);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getSecretKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a secure token
 */
export function decryptToken<T>(token: string): T | null {
  try {
    const [ivHex, encryptedHex] = token.split(":");
    if (!ivHex || !encryptedHex) return null;
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getSecretKey(), iv);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted) as T;
  } catch (error) {
    return null;
  }
}
