import "server-only";
import net from "node:net";
import { AppError } from "./context";
export async function scanUpload(buffer: Buffer) {
  return new Promise<string>((resolve, reject) => {
    const socket = net.createConnection({
      host: process.env.CLAMAV_HOST ?? "127.0.0.1",
      port: Number(process.env.CLAMAV_PORT ?? 56331),
    });
    let reply = "";
    let settled = false;
    const fail = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
      socket.destroy();
    };
    socket.setTimeout(45000, () =>
      fail(new AppError("File scanning timed out. Please try again.", 503)),
    );
    socket.on("error", () =>
      fail(
        new AppError(
          "The file scanner is starting or unavailable. Please try again shortly.",
          503,
        ),
      ),
    );
    socket.on("connect", async () => {
      try {
        const write = (chunk: Buffer) =>
          new Promise<void>((done, failed) =>
            socket.write(chunk, (error) => (error ? failed(error) : done())),
          );
        await write(Buffer.from("zINSTREAM\0"));
        for (let offset = 0; offset < buffer.length; offset += 65536) {
          const chunk = buffer.subarray(offset, offset + 65536);
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length);
          await write(size);
          await write(chunk);
        }
        await write(Buffer.alloc(4));
      } catch {
        fail(
          new AppError(
            "The scanner connection was interrupted. Please try again.",
            503,
          ),
        );
      }
    });
    socket.on("data", (chunk) => {
      reply += chunk.toString();
      if (reply.includes("\0") || reply.includes("\n")) {
        if (reply.includes("FOUND"))
          fail(
            new AppError(
              "This file did not pass the security scan. It has not been saved.",
              422,
            ),
          );
        else if (/:\s*OK[\0\n]/.test(reply)) {
          if (!settled) {
            settled = true;
            resolve("ClamAV");
          }
          socket.end();
        } else
          fail(
            new AppError(
              "The file could not be safely scanned. Try a different file.",
              422,
            ),
          );
      }
    });
    socket.on("end", () => {
      if (!settled)
        fail(
          new AppError("The file scan did not finish. Please try again.", 503),
        );
    });
  });
}
