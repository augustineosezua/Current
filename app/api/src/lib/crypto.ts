import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

// reads ENCRYPTION_KEY from env, throws if missing or wrong length
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION KEY NOT FOUND");
  }
  return Buffer.from(key, "hex");
}

// encrypts plaintext with AES-256-GCM, returns iv:authTag:ciphertext as hex
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

// decrypts a value from encrypt(), throws if authTag doesn't match or format is wrong
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  // expects exactly iv:authTag:ciphertext
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value — expected format iv:authTag:ciphertext");
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encryptedBytes = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedBytes), decipher.final()]).toString("utf8");
}
