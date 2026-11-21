import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
const expectedNode = (
  await readFile(path.join(projectRoot, ".node-version"), "utf8")
).trim();

assert.equal(
  process.versions.node,
  expectedNode,
  "Use the project Node.js LTS",
);
console.log(`Node.js ${process.versions.node}`);

for (const [name, expected] of Object.entries({
  ...manifest.dependencies,
  ...manifest.devDependencies,
})) {
  const installed = JSON.parse(
    await readFile(
      path.join(projectRoot, "node_modules", name, "package.json"),
      "utf8",
    ),
  );
  assert.equal(
    installed.version,
    expected,
    `${name} must match its pinned version`,
  );
  console.log(`${name} ${installed.version}`);
}

const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
assert.equal(
  renderToStaticMarkup(React.createElement("span", null, "Toolchain ready")),
  "<span>Toolchain ready</span>",
);

const { z } = await import("zod");
assert.equal(z.string().parse("ready"), "ready");

const mysql = await import("mysql2/promise");
assert.equal(typeof mysql.createPool, "function");
await import("@tailwindcss/postcss");

const { default: sharp } = await import("sharp");
const preview = await sharp({
  create: {
    width: 2,
    height: 2,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 1 },
  },
})
  .webp()
  .toBuffer();
const previewMetadata = await sharp(preview).metadata();
assert.equal(previewMetadata.format, "webp");
assert.equal(previewMetadata.width, 2);
console.log(
  "React rendering, validation, MariaDB client and native images: passed",
);

const generatorRequire = createRequire(
  await realpath(path.join(projectRoot, "node_modules/shadcn/package.json")),
);
const { Project } = generatorRequire("ts-morph");
const sourceProject = new Project({ useInMemoryFileSystem: true });
sourceProject.createSourceFile(
  "fixtures/toolchain.ts",
  "export const ready = true;",
);
assert.equal(sourceProject.getSourceFiles("fixtures/**/*.ts").length, 1);
console.log("Component generator glob matching: passed");

const { chromium } = await import("@playwright/test");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto("about:blank");
  assert.equal(await page.evaluate(() => 2 + 2), 4);
  console.log(`Playwright Chromium ${browser.version()}: passed`);
} finally {
  await browser.close();
}
