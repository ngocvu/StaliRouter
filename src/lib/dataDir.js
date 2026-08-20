import fs from "node:fs";
import { APP_NAME, getDataDir as resolveDataDir } from "./appIdentity.js";

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
