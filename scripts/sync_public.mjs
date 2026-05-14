import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const srcRaw = path.join(root, "raw");
const destRaw = path.join(root, "public", "raw");

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else if (e.isFile()) await fs.copyFile(s, d);
  }
}

try {
  await fs.access(srcRaw);
} catch {
  console.log("[sync_public] no raw/ directory; skipping");
  process.exit(0);
}

await fs.rm(destRaw, { recursive: true, force: true });
await copyDir(srcRaw, destRaw);
console.log(`[sync_public] copied raw/ → public/raw/`);
