import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const APP_NAME = "stalirouter";
export const LEGACY_APP_NAME = "9router";
export const NPM_PACKAGE_NAME = "stalirouter";
export const LEGACY_NPM_PACKAGE_NAME = "9router";
export const GITHUB_REPO = "ngocvu/StaliRouter";
export const GITHUB_UPSTREAM_REPO = "decolua/9router";

export const PROCESS_IDENTIFIERS = [APP_NAME, NPM_PACKAGE_NAME];

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

  if (process.env.STALIROUTER_LEGACY_DATA === "1") {
    const legacy = defaultDataDirFor(LEGACY_APP_NAME);
    if (fs.existsSync(legacy) && !fs.existsSync(primary)) return legacy;
  }

  return primary;
}

export function isAppProcessCmdline(cmd) {
  const lower = String(cmd || "").toLowerCase();
  if (!lower.includes("node") && !lower.includes("next-server")) return false;
  if (/node_modules[/\\]9router[/\\]/.test(lower) && !lower.includes("stalirouter")) {
    return false;
  }
  if (/\b9router[/\\]app\b/.test(lower) && !lower.includes("stalirouter")) {
    return false;
  }
  return lower.includes("stalirouter");
}

export function defaultDataDirForExport(appName) {
  return defaultDataDirFor(appName);
}
