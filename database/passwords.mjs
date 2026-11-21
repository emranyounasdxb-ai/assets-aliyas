import { scrypt, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200
  )
    throw new Error("Use a password between 12 and 200 characters");
  const salt = randomBytes(24).toString("hex");
  const hash = await derive(password, salt, 64, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  return `scrypt:131072:8:1:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password, encoded) {
  const [algorithm, cost, block, parallel, salt, stored] = encoded.split(":");
  if (
    algorithm !== "scrypt" ||
    cost !== "131072" ||
    block !== "8" ||
    parallel !== "1"
  )
    return false;
  const actual = await derive(password, salt, 64, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  const expected = Buffer.from(stored, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export const tokenHash = (value) =>
  createHash("sha256").update(value).digest("hex");
