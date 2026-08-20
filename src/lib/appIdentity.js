import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const APP_NAME = "stalirouter";
export const LEGACY_APP_NAME = "9router";
export const NPM_PACKAGE_NAME = "stalirouter";
export const LEGACY_NPM_PACKAGE_NAME = "9router";
export const GITHUB_REPO = "ngocvu/StaliRouter";
export const GITHUB_UPSTREAM_REPO = "decolua/9router";

export const PROCESS_IDENTIFIERS = [APP_NAME, LEGACY_APP_NAME, LEGACY_NPM_PACKAGE_NAME];

function defaultDataDirFor(appName) {
  if (process.platform === "win32") {
    const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, appName);
  }
  return path.join(os.homedir(), `.${appName}`);
}

function resolveConfiguredDataDir(configured) {
  if (process.platform === "win32" && /^\//.test(configured)) {
    return null;
  }
  try {
    fs.mkdirSync(configured, { recursive: true });
    return configured;
  } catch (e) {
    if (e?.code === "EACCES" || e?.code === "EPERM") return null;
    throw e;
  }
}

export function getDataDir() {
  const configured = process.env.DATA_DIR;
  if (configured) {
    const resolved = resolveConfiguredDataDir(configured);
    if (resolved) return resolved;
    console.warn(`[StaliRouter] DATA_DIR '${configured}' not writable → fallback`);
  }

  const primary = defaultDataDirFor(APP_NAME);
  const legacy = defaultDataDirFor(LEGACY_APP_NAME);

  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(legacy)) return legacy;
  return primary;
}

export function isAppProcessCmdline(cmd) {
  const lower = String(cmd || "").toLowerCase();
  if (lower.includes("next-server")) return true;
  if (!lower.includes("node")) return false;
  const markers = [
    "cli.js",
    `/${APP_NAME}`,
    `\\${APP_NAME}`,
    `/${LEGACY_APP_NAME}`,
    `\\${LEGACY_APP_NAME}`,
    `/${NPM_PACKAGE_NAME}`,
    `\\${NPM_PACKAGE_NAME}`,
  ];
  const hasMarker = markers.some((m) => lower.includes(m));
  const hasName = PROCESS_IDENTIFIERS.some((id) => lower.includes(id));
  return hasMarker && hasName;
}

export function defaultDataDirForExport(appName) {
  return defaultDataDirFor(appName);
}
