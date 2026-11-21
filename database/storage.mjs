import path from "node:path";
import {
  mkdir,
  open,
  readFile,
  readdir,
  unlink,
  lstat,
} from "node:fs/promises";
import { constants } from "node:fs";
function root() {
  const directory = process.env.PRIVATE_STORAGE_DIR;
  if (!directory || !path.isAbsolute(directory))
    throw new Error("Configure an absolute private storage directory");
  const resolved = path.resolve(directory);
  const forbidden = [
    path.resolve("public"),
    path.resolve("/home/aliyasrealestate/assets.aliyasrealestate.ae"),
  ];
  if (
    resolved.split(path.sep).includes("public_html") ||
    forbidden.some(
      (base) => resolved === base || resolved.startsWith(base + path.sep),
    )
  )
    throw new Error("Private storage must be outside web document roots");
  return resolved;
}
function filePath(key) {
  if (
    !/^[a-f0-9-]{36}\/[a-f0-9-]{36}(?:\.preview)?\.(?:pdf|jpg|png|webp)$/.test(
      key,
    )
  )
    throw new Error("Invalid storage path");
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep))
    throw new Error("Invalid storage path");
  return full;
}
export async function storeFile(key, buffer) {
  const full = filePath(key);
  const parent = path.dirname(full);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  if ((await lstat(parent)).isSymbolicLink())
    throw new Error("Unsafe storage directory");
  const handle = await open(
    full,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      (constants.O_NOFOLLOW || 0),
    0o600,
  );
  try {
    await handle.writeFile(buffer);
  } finally {
    await handle.close();
  }
}
export async function privateFile(key) {
  const full = filePath(key);
  if ((await lstat(full)).isSymbolicLink())
    throw new Error("Unsafe storage file");
  return readFile(full);
}
export async function removeFiles(keys) {
  for (const key of keys)
    try {
      await unlink(filePath(key));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
}
export async function listFiles(workspace) {
  if (!/^[a-f0-9-]{36}$/.test(workspace)) throw new Error("Invalid workspace");
  try {
    return (await readdir(path.join(root(), workspace))).map((name) => ({
      name,
    }));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
