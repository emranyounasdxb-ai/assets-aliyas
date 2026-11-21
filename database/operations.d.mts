import type { DatabaseClient } from "./client.mjs";
export function reminders(workspace?: string | null): Promise<void>;
export function operation(
  client: DatabaseClient,
  name: string,
  parameters: Record<string, unknown>,
): Promise<unknown>;
