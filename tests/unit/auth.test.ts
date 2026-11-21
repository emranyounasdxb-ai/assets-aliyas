import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  tokenHash,
} from "../../database/passwords.mjs";
import { privateFile } from "../../database/storage.mjs";
describe("Self-hosted credential and file boundaries", () => {
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
