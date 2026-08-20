/**
 * Canonical StaliRouter identity — bundled inside npm package (cli/shared).
 * Repo root shared/appIdentity.cjs re-exports this file for dev/monorepo paths.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const APP_NAME = "stalirouter";
const LEGACY_APP_NAME = "9router";
const NPM_PACKAGE_NAME = "stalirouter";
const LEGACY_NPM_PACKAGE_NAME = "9router";
const GITHUB_REPO = "ngocvu/StaliRouter";
const GITHUB_UPSTREAM_REPO = "decolua/9router";

const PROCESS_IDENTIFIERS = [APP_NAME, LEGACY_APP_NAME, LEGACY_NPM_PACKAGE_NAME];

function defaultDataDirFor(appName) {
  if (process.platform === "win32") {
    const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, appName);
  }
  return path.join(os.homedir(), `.${appName}`);
}

function resolveDataDir(configured) {
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

function getDataDir() {
  const configured = process.env.DATA_DIR;
  if (configured) {
    const resolved = resolveDataDir(configured);
    if (resolved) return resolved;
    console.warn(`[StaliRouter] DATA_DIR '${configured}' not writable → fallback`);
  }

  const primary = defaultDataDirFor(APP_NAME);
  const legacy = defaultDataDirFor(LEGACY_APP_NAME);

  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(legacy)) return legacy;
  return primary;
}

function isAppProcessCmdline(cmd) {
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

module.exports = {
  APP_NAME,
  LEGACY_APP_NAME,
  NPM_PACKAGE_NAME,
  LEGACY_NPM_PACKAGE_NAME,
  GITHUB_REPO,
  GITHUB_UPSTREAM_REPO,
  PROCESS_IDENTIFIERS,
  getDataDir,
  isAppProcessCmdline,
  defaultDataDirFor,
};
