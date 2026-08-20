const api = require("./api/client");
const { showMenuWithBack } = require("./utils/menuHelper");
const { showApiKeysMenu } = require("./menus/apiKeys");
const { showSettingsMenu } = require("./menus/settings");
const { runStaliPreset } = require("./menus/staliPreset");

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m"
};

// Cached header (SWR): show last value instantly, refresh in background.
let cachedHeader = "";
let fetchingHeader = false;

function renderHeader(port, keys, tunnel) {
  const tunnelEnabled = tunnel && tunnel.enabled === true;
  const lines = [];
  if (tunnelEnabled && tunnel.publicUrl) {
    lines.push(`Endpoint: ${COLORS.green}${tunnel.publicUrl}/v1${COLORS.reset}`);
    lines.push(`Tunnel:   ${COLORS.green}ON${COLORS.reset} ${COLORS.dim}(${tunnel.shortId})${COLORS.reset}`);
  } else {
    lines.push(`Endpoint: http://localhost:${port}/v1`);
    lines.push(`Tunnel:   ${COLORS.red}OFF${COLORS.reset} ${COLORS.dim}(local only)${COLORS.reset}`);
  }
  if (!keys || keys.length === 0) {
    lines.push(`Key:      ${COLORS.dim}No API keys yet${COLORS.reset}`);
  } else {
    lines.push(`Key:      ${COLORS.cyan}${keys[0].key}${COLORS.reset}`);
    keys.slice(1).forEach(k => lines.push(`          ${COLORS.cyan}${k.key}${COLORS.reset}`));
  }
  return lines.join("\n");
}

async function refreshHeaderBg(port) {
  if (fetchingHeader) return;
  fetchingHeader = true;
  try {
    const [keysResult, tunnelResult] = await Promise.all([
      api.getApiKeys(),
      api.getTunnelStatus()
    ]);
    const keys = keysResult.success ? (keysResult.data.keys || []) : [];
    const tunnel = tunnelResult.success ? (tunnelResult.data || {}) : {};
    cachedHeader = renderHeader(port, keys, tunnel);
  } finally {
    fetchingHeader = false;
  }
}

function getHeader(port) {
  // Kick off background refresh; return cache (or placeholder on first call).
  refreshHeaderBg(port);
  return cachedHeader || `Endpoint: http://localhost:${port}/v1\nTunnel:   ${COLORS.dim}...${COLORS.reset}\nKey:      ${COLORS.dim}...${COLORS.reset}`;
}

/**
 * Start Terminal UI
 * @param {number} port - Server port number
 */
async function startTerminalUI(port) {
  // Configure API client
  api.configure({ port });

  const basePath = ["StaliRouter"];

  // Prime header cache before first render
  await refreshHeaderBg(port);

  const isAdvancedMode = process.env.STALI_ROUTER_ADVANCED === "1";

  // Main menu (Stali-first by default; advanced mode can re-enable full surface)
  const items = [
    {
      label: "Stali preset (1-click)",
      action: async () => {
        await runStaliPreset(port);
        return true;
      }
    },
    {
      label: "API Keys",
      action: async () => {
        await showApiKeysMenu(port, [...basePath, "API Keys"]);
        return true;
      }
    },
    {
      label: "Settings",
      action: async () => {
        await showSettingsMenu([...basePath, "Settings"]);
        return true;
      }
    }
  ];

  if (isAdvancedMode) {
    const { showProvidersMenu } = require("./menus/providers");
    const { showCombosMenu } = require("./menus/combos");
    const { showCliToolsMenu } = require("./menus/cliTools");
    items.push(
      {
        label: "Providers (Advanced)",
        action: async () => {
          await showProvidersMenu([...basePath, "Providers"]);
          return true;
        }
      },
      {
        label: "Combos (Advanced)",
        action: async () => {
          await showCombosMenu([...basePath, "Combos"]);
          return true;
        }
      },
      {
        label: "CLI Tools (Advanced)",
        action: async () => {
          await showCliToolsMenu(port, [...basePath, "CLI Tools"]);
          return true;
        }
      }
    );
  }

  await showMenuWithBack({
    title: "📡 StaliRouter Terminal UI",
    breadcrumb: basePath,
    headerContent: () => getHeader(port),
    items,
    backLabel: "← Back to Interface Menu"
  });
}

module.exports = { startTerminalUI };
