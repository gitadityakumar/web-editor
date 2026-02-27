import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const almostnodeDist = path.join(root, "node_modules", "almostnode", "dist");
const publicDir = path.join(root, "public");
const assetsOut = path.join(publicDir, "assets");

if (!fs.existsSync(almostnodeDist)) {
  console.log("[prepare-almostnode-assets] almostnode/dist not found, skipping.");
  process.exit(0);
}

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(assetsOut, { recursive: true });

const distAssets = path.join(almostnodeDist, "assets");
if (fs.existsSync(distAssets)) {
  for (const file of fs.readdirSync(distAssets)) {
    if (!file.startsWith("runtime-worker-")) {
      continue;
    }

    const src = path.join(distAssets, file);
    const dest = path.join(assetsOut, file);
    fs.copyFileSync(src, dest);
    console.log(`[prepare-almostnode-assets] copied ${file}`);
  }
}

const serviceWorkerSrc = path.join(almostnodeDist, "__sw__.js");
const serviceWorkerDest = path.join(publicDir, "__sw__.js");
if (fs.existsSync(serviceWorkerSrc)) {
  fs.copyFileSync(serviceWorkerSrc, serviceWorkerDest);
  console.log("[prepare-almostnode-assets] copied __sw__.js");
}
