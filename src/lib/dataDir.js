import fs from "node:fs";
import path from "path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadIdentity() {
  const candidates = [
    path.join(__dirname, "../../shared/appIdentity.cjs"),
    path.join(__dirname, "../../../shared/appIdentity.cjs"),
    path.join(__dirname, "../../../../cli/shared/appIdentity.cjs"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error("appIdentity.cjs not found");
}

const { APP_NAME, getDataDir: resolveDataDir } = loadIdentity();

export { APP_NAME };

export function getDataDir() {
  const configured = process.env.DATA_DIR;
  if (!configured) return resolveDataDir();

  if (process.platform === "win32" && /^\//.test(configured)) {
    console.warn(`[DATA_DIR] '${configured}' is a Unix path on Windows → fallback to default`);
    return resolveDataDir();
  }

  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch (e) {
    if (e?.code === "EACCES" || e?.code === "EPERM") {
      console.warn(`[DATA_DIR] '${configured}' not writable → fallback ~/.${APP_NAME}`);
      return resolveDataDir();
    }
    throw e;
  }
}

export const DATA_DIR = getDataDir();
