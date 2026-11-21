import assert from "node:assert/strict";
import net from "node:net";
import { setTimeout as pause } from "node:timers/promises";
const service = process.argv[2];
assert.ok(["scanner", "app"].includes(service));
const deadline = Date.now() + (service === "scanner" ? 300000 : 60000);
while (Date.now() < deadline) {
  try {
    if (service === "scanner") {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: "127.0.0.1", port: 56331 });
        socket.setTimeout(2000, () =>
          socket.destroy(new Error("Scanner not ready")),
        );
        socket.on("error", reject);
        socket.on("connect", () => socket.write("zPING\0"));
        socket.on("data", (data) => {
          socket.end();
          data.toString().includes("PONG")
            ? resolve()
            : reject(new Error("Scanner not ready"));
        });
      });
    } else {
      const response = await fetch("http://127.0.0.1:3200/api/health", {
        signal: AbortSignal.timeout(2000),
      });
      assert.equal((await response.json()).application, "aliyas-assets");
    }
    console.log(`${service} ready`);
    process.exit(0);
  } catch {
    await pause(1000);
  }
}
throw new Error(`${service} did not become ready`);
