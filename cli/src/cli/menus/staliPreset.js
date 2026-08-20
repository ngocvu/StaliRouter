const api = require("../api/client");
const { prompt, confirm, pause } = require("../utils/input");
const { clearScreen, showStatus, showHeader } = require("../utils/display");
const { copyToClipboard } = require("../utils/clipboard");

const OPENAI_COMPAT_TYPE = "openai-compatible";
const DEFAULT_API_TYPE = "responses"; // Stali works best with /v1/responses wire

const RECOMMENDED_MODELS = [
  "claude-fable-5",
  "claude-sonnet-5",
  "claude-opus-5",
  "gpt-5.6-sol",
];

const OPTIONAL_MODELS = [
  // Includes a slash, so model alias mapping (shortcuts) can't cover it reliably.
  // Users can still select it by internal model id from the router model picker.
  "req/gpt-5.6-sol",
];

const STALI_NODE_NAME = "Stali API (OpenAI-compatible)";
const STALI_CONNECTION_NAME = "Stali";

function ensureV1BaseUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

function extractModelId(m) {
  if (!m) return null;
  if (typeof m === "string") return m;
  if (typeof m === "object") return m.id || m.model || m.name || null;
  return null;
}

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const s = String(v || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function normalizeBaseForCompare(url) {
  return ensureV1BaseUrl(url).toLowerCase();
}

async function resolveOrCreateStaliNode(baseUrlV1) {
  const target = normalizeBaseForCompare(baseUrlV1);
  const nodesRes = await api.getProviderNodes();
  if (!nodesRes.success) {
    return { ok: false, error: nodesRes.error || "Failed to list provider nodes" };
  }

  const nodes = nodesRes.data?.nodes || [];
  const existing = nodes.find((n) => {
    if (!n || n.type !== OPENAI_COMPAT_TYPE) return false;
    const sameName = String(n.name || "").trim().toLowerCase() === STALI_NODE_NAME.toLowerCase();
    const sameBase = normalizeBaseForCompare(n.baseUrl) === target;
    return sameName || sameBase;
  });

  if (existing?.id) {
    const syncNode = await api.updateProviderNode(existing.id, {
      name: STALI_NODE_NAME,
      type: OPENAI_COMPAT_TYPE,
      apiType: DEFAULT_API_TYPE,
      prefix: existing.id,
      baseUrl: baseUrlV1,
    });
    if (!syncNode.success) {
      return { ok: false, error: syncNode.error || "Failed to sync existing Stali node" };
    }
    return { ok: true, nodeId: existing.id, created: false };
  }

  const nodeCreate = await api.createProviderNode({
    name: STALI_NODE_NAME,
    type: OPENAI_COMPAT_TYPE,
    apiType: DEFAULT_API_TYPE,
    prefix: "tmp-stali",
    baseUrl: baseUrlV1,
  });
  if (!nodeCreate.success) {
    return { ok: false, error: nodeCreate.error || "Failed to create provider node" };
  }

  const node = nodeCreate.data?.node || nodeCreate.data;
  const nodeId = node?.id;
  if (!nodeId) {
    return { ok: false, error: "Provider node created but missing node.id" };
  }

  const nodeUpdate = await api.updateProviderNode(nodeId, {
    name: STALI_NODE_NAME,
    type: OPENAI_COMPAT_TYPE,
    apiType: DEFAULT_API_TYPE,
    prefix: nodeId,
    baseUrl: baseUrlV1,
  });
  if (!nodeUpdate.success) {
    return { ok: false, error: nodeUpdate.error || "Failed to finalize provider node" };
  }

  return { ok: true, nodeId, created: true };
}

async function resolveOrCreateStaliConnection(nodeId, staliKey) {
  const providersRes = await api.getProviders();
  if (!providersRes.success) {
    return { ok: false, error: providersRes.error || "Failed to list providers" };
  }
  const conns = providersRes.data?.connections || [];
  const existing = conns.find((c) => c?.provider === nodeId);

  if (existing?.id) {
    const updateRes = await api.updateConnection(existing.id, {
      name: STALI_CONNECTION_NAME,
      apiKey: staliKey.trim(),
      isActive: true,
    });
    if (!updateRes.success) {
      return { ok: false, error: updateRes.error || "Failed to update existing Stali connection" };
    }
    return { ok: true, connectionId: existing.id, created: false };
  }

  const connCreate = await api.createApiKeyProvider({
    provider: nodeId,
    name: STALI_CONNECTION_NAME,
    apiKey: staliKey.trim(),
  });
  if (!connCreate.success) {
    return { ok: false, error: connCreate.error || "Failed to create Stali connection" };
  }
  const connection = connCreate.data?.connection || connCreate.data;
  const connectionId = connection?.id;
  if (!connectionId) {
    return { ok: false, error: "Connection created but missing connection.id" };
  }
  return { ok: true, connectionId, created: true };
}

async function cleanupDuplicateStaliEntities(activeNodeId, activeConnectionId, baseUrlV1) {
  const targetBase = normalizeBaseForCompare(baseUrlV1);
  const [nodesRes, providersRes] = await Promise.all([api.getProviderNodes(), api.getProviders()]);
  if (!nodesRes.success || !providersRes.success) {
    return {
      ok: false,
      error: nodesRes.error || providersRes.error || "Failed to inspect duplicates",
      removedNodes: 0,
      removedConnections: 0,
    };
  }

  const nodes = nodesRes.data?.nodes || [];
  const connections = providersRes.data?.connections || [];

  const duplicateNodes = nodes.filter((n) => {
    if (!n || n.id === activeNodeId || n.type !== OPENAI_COMPAT_TYPE) return false;
    const sameName = String(n.name || "").trim().toLowerCase() === STALI_NODE_NAME.toLowerCase();
    const sameBase = normalizeBaseForCompare(n.baseUrl) === targetBase;
    return sameName || sameBase;
  });
  const duplicateNodeIds = new Set(duplicateNodes.map((n) => n.id));

  const duplicateConnections = connections.filter((c) => {
    if (!c || c.id === activeConnectionId) return false;
    if (duplicateNodeIds.has(c.provider)) return true;
    const sameName = String(c.name || "").trim().toLowerCase() === STALI_CONNECTION_NAME.toLowerCase();
    return sameName && c.provider === activeNodeId;
  });

  let removedConnections = 0;
  for (const conn of duplicateConnections) {
    const deleted = await api.deleteConnection(conn.id);
    if (deleted.success) removedConnections += 1;
  }

  let removedNodes = 0;
  for (const node of duplicateNodes) {
    const deleted = await api.deleteProviderNode(node.id);
    if (deleted.success) removedNodes += 1;
  }

  return { ok: true, removedNodes, removedConnections };
}

async function testStaliConnection(connectionId) {
  const testRes = await api.testConnection(connectionId);
  if (!testRes.success) {
    return {
      ok: false,
      error: testRes.error || "Connection test request failed",
    };
  }

  const valid = testRes.data?.valid !== false;
  if (!valid) {
    return {
      ok: false,
      error: testRes.data?.error || "Connection is invalid",
    };
  }
  return { ok: true };
}

async function enforceStaliOnlyConnections(activeConnectionId) {
  const providersRes = await api.getProviders();
  if (!providersRes.success) {
    return { ok: false, error: providersRes.error || "Failed to list providers" };
  }
  const conns = providersRes.data?.connections || [];
  let disabled = 0;

  for (const conn of conns) {
    if (!conn?.id || conn.id === activeConnectionId) continue;
    if (conn.isActive === false) continue;
    const res = await api.updateConnection(conn.id, { isActive: false });
    if (res.success) disabled += 1;
  }
  return { ok: true, disabled };
}

async function pickModels(availableModelIds) {
  const available = uniq(availableModelIds).sort((a, b) => a.localeCompare(b));
  const rec = RECOMMENDED_MODELS.filter((m) => available.includes(m));
  const optionalRec = OPTIONAL_MODELS.filter((m) => available.includes(m));

  if (rec.length > 0) {
    const useRecommended = await confirm(`Use recommended Stali models (${rec.join(", ")})?`);
    if (useRecommended) {
      let selected = [...rec];
      if (optionalRec.length > 0) {
        const useOptional = await confirm(`Also include optional model(s) (${optionalRec.join(", ")})?`);
        if (useOptional) selected = selected.concat(optionalRec);
      }
      return uniq(selected);
    }
  }

  clearScreen();
  showHeader("Stali model selection", "Choose model ids from upstream /models");
  if (available.length === 0) {
    showStatus("No models found from Stali /models", "error");
    return [];
  }

  const preview = available.slice(0, 25);
  showStatus(
    `Available models (showing first ${preview.length}/${available.length}):\n` + preview.join(", "),
    "info"
  );

  const raw = await prompt(
    `Enter model ids (comma separated). Leave empty to abort:`
  );
  if (!raw || !raw.trim()) return [];

  const picked = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const filtered = picked.filter((id) => available.includes(id));
  if (filtered.length === 0) {
    showStatus("None of the entered ids match the live model list", "error");
    return [];
  }
  return uniq(filtered);
}

async function ensureRouterApiKey() {
  const keysRes = await api.getApiKeys();
  if (!keysRes.success) {
    return { apiKey: null, created: false, error: keysRes.error || "Failed to load API keys" };
  }

  const keys = keysRes.data?.keys || [];
  if (keys.length > 0 && keys[0]?.key) {
    return { apiKey: keys[0].key, created: false };
  }

  const ok = await confirm("No router API key found. Create one now?");
  if (!ok) return { apiKey: null, created: false };

  const name = "stali-router";
  const created = await api.createApiKey(name);
  if (!created.success) {
    return { apiKey: null, created: false, error: created.error || "Failed to create router API key" };
  }
  const key = created.data?.key || created.data?.apiKey || created.data?.data?.key || null;
  return { apiKey: key, created: true };
}

/**
 * One-click Stali preset:
 * - create OpenAI-compatible provider node
 * - create API key connection to Stali
 * - enable selected upstream models (via providerSpecificData.enabledModels)
 * - add model aliases for slash-free ids so users can use plain model ids
 */
async function runStaliPreset(port) {
  clearScreen();
  showHeader("Stali preset (1-click)", "Base URL + API key + models");

  const baseInput = await prompt("Stali base URL (origin, e.g. https://api.stali.vn). Can omit /v1: ");
  if (!baseInput || !baseInput.trim()) return;

  const baseUrlV1 = ensureV1BaseUrl(baseInput);
  const staliKey = await prompt("Your Stali API key: ");
  if (!staliKey || !staliKey.trim()) return;

  showStatus("Preparing Stali provider node...", "info");
  const nodeResult = await resolveOrCreateStaliNode(baseUrlV1);
  if (!nodeResult.ok) {
    showStatus(`Failed to prepare provider node: ${nodeResult.error}`, "error");
    await pause();
    return;
  }
  const nodeId = nodeResult.nodeId;

  showStatus("Preparing Stali connection...", "info");
  const connResult = await resolveOrCreateStaliConnection(nodeId, staliKey);
  if (!connResult.ok) {
    showStatus(`Failed to prepare Stali connection: ${connResult.error}`, "error");
    await pause();
    return;
  }
  const connectionId = connResult.connectionId;

  showStatus("Testing Stali connection...", "info");
  const testRes = await testStaliConnection(connectionId);
  if (!testRes.ok) {
    showStatus(`Stali connection test failed: ${testRes.error}`, "warning");
    showStatus("You can still continue, but requests may fail until API key/base URL are fixed.", "warning");
  } else {
    showStatus("Stali connection test: OK", "success");
  }

  showStatus("Fetching live model list from Stali...", "info");
  const modelsRes = await api.getProviderModels(connectionId);
  if (!modelsRes.success) {
    showStatus(`Failed to fetch Stali models: ${modelsRes.error}`, "error");
    await pause();
    return;
  }

  const rawModels = modelsRes.data?.models || [];
  const availableModelIds = rawModels.map(extractModelId).filter(Boolean);
  const selectedModelIds = await pickModels(availableModelIds);

  if (!Array.isArray(selectedModelIds) || selectedModelIds.length === 0) {
    showStatus("No models selected. Preset aborted.", "warning");
    await pause();
    return;
  }

  showStatus("Enabling selected models (router-side)...", "info");
  const enableRes = await api.updateConnection(connectionId, {
    providerSpecificData: {
      enabledModels: selectedModelIds,
    },
    defaultModel: selectedModelIds[0] || null,
  });

  if (!enableRes.success) {
    showStatus(`Failed to enable models: ${enableRes.error}`, "error");
    await pause();
    return;
  }

  const doCleanup = await confirm("Cleanup duplicate Stali nodes/connections now?");
  if (doCleanup) {
    const cleanup = await cleanupDuplicateStaliEntities(nodeId, connectionId, baseUrlV1);
    if (!cleanup.ok) {
      showStatus(`Duplicate cleanup skipped: ${cleanup.error}`, "warning");
    } else {
      showStatus(
        `Duplicate cleanup done: removed ${cleanup.removedConnections} connection(s), ${cleanup.removedNodes} node(s)`,
        "success"
      );
    }
  }

  // Add aliases only for slash-free ids because router aliases are only
  // applied when the client model string contains no '/'.
  const aliasable = selectedModelIds.filter((m) => !String(m).includes("/"));
  if (aliasable.length > 0) {
    showStatus("Adding model aliases (plain ids)...", "info");
    for (const modelId of aliasable) {
      const internalModel = `${nodeId}/${modelId}`;
      const aliasRes = await api.setModelAlias({ alias: modelId, model: internalModel });
      if (!aliasRes.success) {
        // Best-effort: don't abort preset on alias failure.
        showStatus(`Alias skipped for ${modelId}: ${aliasRes.error}`, "warning");
      }
    }
  }

  const routerKey = await ensureRouterApiKey();
  if (routerKey?.apiKey) {
    showStatus(`Router API key: ${routerKey.apiKey}`, "success");
    copyToClipboard(routerKey.apiKey);
  }

  showHeader("Preset complete", `Router endpoint: http://localhost:${port}/v1`);
  showStatus(
    `Node: ${nodeResult.created ? "created" : "reused"} | Connection: ${connResult.created ? "created" : "reused"}`,
    "success"
  );
  showStatus(
    `Selected models enabled: ${selectedModelIds.join(", ")}`,
    "info"
  );
  showStatus(
    `For slash-free models, you can now use plain ids (alias): ${aliasable.join(", ") || "(none)"}`,
    "info"
  );

  const enforceStaliOnly = await confirm("Enable Stali-only mode now (disable other active connections)?");
  if (enforceStaliOnly) {
    const staliOnlyRes = await enforceStaliOnlyConnections(connectionId);
    if (!staliOnlyRes.ok) {
      showStatus(`Stali-only mode warning: ${staliOnlyRes.error}`, "warning");
    } else {
      showStatus(`Stali-only mode enabled: disabled ${staliOnlyRes.disabled} non-Stali connection(s)`, "success");
    }
  }

  await pause();
}

module.exports = {
  runStaliPreset,
};

