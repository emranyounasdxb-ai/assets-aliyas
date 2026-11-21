import { reminders } from "../database/operations.mjs";
import { closeDatabase } from "../database/sql.mjs";
try {
  await reminders();
  console.log("Due-date notifications refreshed.");
} finally {
  await closeDatabase();
}
