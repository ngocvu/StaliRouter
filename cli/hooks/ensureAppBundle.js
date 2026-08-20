#!/usr/bin/env node
/**
 * Ensure cli/app standalone bundle exists (required to run stalirouter).
 * npm install from git omits the built app/ — download prebuilt tarball when missing.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");
const os = require("os");

const cliRoot = path.join(__dirname, "..");
const appDir = path.join(cliRoot, "app");
const pkg = require("../package.json");

const DEFAULT_BUNDLE_URLS = [
  process.env.STALIROUTER_BUNDLE_URL,
  `https://api.stali.vn/install/stalirouter-bundle.tgz`,
  `https://github.com/ngocvu/StaliRouter/releases/download/v${pkg.version}/stalirouter-${pkg.version}.tgz`,
  `https://github.com/ngocvu/StaliRouter/releases/latest/download/stalirouter-bundle.tgz`,
].filter(Boolean);

function hasStandaloneApp() {
  return (
    fs.existsSync(path.join(appDir, "custom-server.js")) ||
    fs.existsSync(path.join(appDir, "server.js"))
  );
}

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    lib.get(url, { timeout: 120000 }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (redirects >= 5) return reject(new Error("Too many redirects"));
        res.resume();
        return resolve(download(res.headers.location, dest, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
      file.on("error", reject);
    }).on("error", reject);
  });
}

function extractNpmPackTarball(tarballPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execSync(`tar -xzf "${tarballPath}" -C "${destDir}"`, { stdio: "pipe" });
  const entries = fs.readdirSync(destDir).filter((e) => e.startsWith("package"));
  if (entries.length !== 1) {
    throw new Error("Unexpected npm pack layout in bundle tarball");
  }
  const extracted = path.join(destDir, entries[0]);
  const srcApp = path.join(extracted, "app");
  if (!fs.existsSync(srcApp)) {
    throw new Error("Downloaded bundle missing app/ standalone");
  }
  if (fs.existsSync(appDir)) fs.rmSync(appDir, { recursive: true, force: true });
  fs.cpSync(srcApp, appDir, { recursive: true });
}

async function ensureAppBundle({ silent = false } = {}) {
  if (hasStandaloneApp()) return { ok: true, source: "bundled" };

  const log = silent ? () => {} : (msg) => console.log(msg);
  const warn = silent ? () => {} : (msg) => console.warn(msg);

  log("[StaliRouter] Standalone app missing — fetching prebuilt bundle…");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stalirouter-bundle-"));
  const tarball = path.join(tmp, "bundle.tgz");

  let lastErr = null;
  for (const url of DEFAULT_BUNDLE_URLS) {
    try {
      log(`[StaliRouter] Trying ${url}`);
      await download(url, tarball);
      extractNpmPackTarball(tarball, tmp);
      if (hasStandaloneApp()) {
        log("[StaliRouter] Prebuilt bundle ready");
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
        return { ok: true, source: url };
      }
    } catch (e) {
      lastErr = e;
      warn(`[StaliRouter] Bundle fetch failed (${url}): ${e.message}`);
    }
  }

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}

  return {
    ok: false,
    error: lastErr?.message || "No bundle available",
    hint: "Run: curl -fsSL https://api.stali.vn/install/stalirouter.sh | bash",
  };
}

if (require.main === module) {
  ensureAppBundle({ silent: false })
    .then((r) => process.exit(r.ok ? 0 : 1))
    .catch((e) => {
      console.error(e?.message || e);
      process.exit(1);
    });
}

module.exports = { ensureAppBundle, hasStandaloneApp };
