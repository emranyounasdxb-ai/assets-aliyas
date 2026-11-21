import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  tokenHash,
} from "../../database/passwords.mjs";
import { privateFile } from "../../database/storage.mjs";
describe("Self-hosted credential and file boundaries", () => {
  it("accepts a ten-character password and rejects passwords outside the supported length", async () => {
    await expect(hashPassword("a".repeat(9))).rejects.toThrow(
      "between 10 and 200",
    );
    await expect(hashPassword("a".repeat(201))).rejects.toThrow(
      "between 10 and 200",
    );
    const password = "a".repeat(10);
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword(password.slice(0, 9), hash)).toBe(false);
  });
  it("uses salted password hashes and verifies the complete password", async () => {
    const password = "Verification password with 28 characters";
    const first = await hashPassword(password),
      second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(`${password}!`, first)).toBe(false);
  });
  it("rejects unsupported password costs and hashes session tokens", async () => {
    expect(await verifyPassword("test", "scrypt:999999999:8:1:salt:hash")).toBe(
      false,
    );
    expect(tokenHash("a private session")).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash("a private session")).not.toBe(
      tokenHash("another session"),
    );
  });
  it("rejects file traversal before accessing disk", async () => {
    for (const key of [
      "../.env.local",
      "/etc/passwd",
      "workspace/../../file.pdf",
      "C:\\private.pdf",
    ])
      await expect(privateFile(key)).rejects.toThrow("Invalid storage path");
  });
});
