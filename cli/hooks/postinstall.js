#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const { ensureSqliteRuntime } = require("./sqliteRuntime");
const { ensureTrayRuntime } = require("./trayRuntime");

// Postinstall: warm-up SQLite deps into ~/.stalirouter/runtime so the first
// `stalirouter` start doesn't need network. Failure here is non-fatal —
// cli.js will retry at runtime if anything is missing.
try {
  ensureSqliteRuntime({ silent: false });
  console.log("[StaliRouter] runtime SQLite deps ready");
} catch (e) {
  console.warn(`[StaliRouter] runtime warm-up skipped: ${e.message}`);
}

try {
  ensureTrayRuntime({ silent: false });
} catch (e) {
  console.warn(`[StaliRouter] tray runtime skipped: ${e.message}`);
}

// Prebuilt dashboard bundle (npm pack tarball) — best-effort on postinstall
try {
  execSync(`node "${path.join(__dirname, "ensureAppBundle.js")}"`, {
    stdio: "inherit",
    timeout: 300000,
  });
} catch {
  console.warn(
    "[StaliRouter] Prebuilt bundle not fetched yet. One-line install:\n" +
    "  curl -fsSL https://api.stali.vn/install/stalirouter.sh | bash\n" +
    "  npm install -g https://api.stali.vn/install/stalirouter-bundle.tgz",
  );
}

process.exit(0);
