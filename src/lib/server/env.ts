export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
export function localDemoAllowed(host: string | null): boolean {
  if (process.env.LOCAL_DEMO !== "true" || !host) return false;
  const backend = process.env.DATABASE_URL;
  const frontend = process.env.APP_ORIGIN;
  if (!backend || !frontend) return false;
  try {
    return [backend, frontend, `http://${host}`].every((url) =>
      ["127.0.0.1", "localhost"].includes(new URL(url).hostname),
    );
  } catch {
    return false;
  }
}
