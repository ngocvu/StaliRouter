import {
  createApiKey,
  getApiKeys,
  getModelAliases,
  getProviderConnections,
  getProviderNodes,
  createProviderConnection,
  createProviderNode,
  updateProviderConnection,
  updateProviderNode,
  setModelAlias,
} from "@/models";
import {
  getDefaultRecommendedModels,
  isAllowedStaliBaseUrl,
  normalizeBaseUrlV1,
  resolveLocalEndpoint,
} from "@/lib/staliOnly";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { OPENAI_COMPATIBLE_PREFIX } from "@/shared/constants/providers";
import { generateId } from "@/shared/utils";

const STALI_NODE_NAME = "Stali API (OpenAI-compatible)";
const STALI_CONNECTION_NAME = "Stali";
const OPENAI_COMPAT_TYPE = "openai-compatible";
const DEFAULT_API_TYPE = "responses";

function toModelId(m) {
  if (!m) return null;
  if (typeof m === "string") return m.trim() || null;
  if (typeof m === "object") return (m.id || m.model || "").trim() || null;
  return null;
}

function uniqModels(list) {
  const out = [];
  const seen = new Set();
  for (const v of list || []) {
    const s = toModelId(v);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

async function fetchStaliLiveModels(baseUrlV1, apiKey) {
  try {
    const res = await fetch(`${baseUrlV1}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data?.data || data?.models || [];
    return uniqModels(raw);
  } catch {
    return [];
  }
}

/**
 * One-click Stali preset — shared by web UI and POST /api/stali/setup.
 */
export async function runStaliSetup({
  baseUrl,
  apiKey,
  models = getDefaultRecommendedModels(),
}) {
  const normalizedBase = normalizeBaseUrlV1(baseUrl);
  const trimmedKey = String(apiKey || "").trim();

  if (!normalizedBase || !trimmedKey) {
    return { ok: false, error: "Base URL and API key are required." };
  }
  if (!isAllowedStaliBaseUrl(normalizedBase)) {
    return {
      ok: false,
      error: "Base URL host is not allowed in Stali-only mode.",
    };
  }

  const nodes = await getProviderNodes();
  let node = (nodes || []).find(
    (n) => n?.type === OPENAI_COMPAT_TYPE && isAllowedStaliBaseUrl(n?.baseUrl),
  );

  if (!node) {
    node = await createProviderNode({
      id: `${OPENAI_COMPATIBLE_PREFIX}${DEFAULT_API_TYPE}-${generateId()}`,
      name: STALI_NODE_NAME,
      prefix: "stali",
      apiType: DEFAULT_API_TYPE,
      baseUrl: normalizedBase,
      type: OPENAI_COMPAT_TYPE,
    });
  } else {
    node = await updateProviderNode(node.id, {
      name: STALI_NODE_NAME,
      prefix: node.prefix || node.id,
      apiType: DEFAULT_API_TYPE,
      baseUrl: normalizedBase,
    });
  }

  const connections = await getProviderConnections();
  let conn = (connections || []).find((c) => c?.provider === node.id);

  if (!conn) {
    conn = await createProviderConnection({
      provider: node.id,
      name: STALI_CONNECTION_NAME,
      apiKey: trimmedKey,
      authType: "apikey",
      isActive: true,
    });
  } else {
    conn = await updateProviderConnection(conn.id, {
      name: STALI_CONNECTION_NAME,
      apiKey: trimmedKey,
      isActive: true,
    });
  }

  const requested = uniqModels(models);
  const liveModels = await fetchStaliLiveModels(normalizedBase, trimmedKey);
  const finalModels =
    requested.length > 0
      ? requested.filter((m) => liveModels.includes(m))
      : getDefaultRecommendedModels().filter((m) => liveModels.includes(m));

  if (finalModels.length === 0) {
    return {
      ok: false,
      error: "No selected models are available on this Stali key.",
      liveModels,
    };
  }

  conn = await updateProviderConnection(conn.id, {
    providerSpecificData: {
      ...(conn.providerSpecificData || {}),
      enabledModels: finalModels,
    },
    defaultModel: finalModels[0],
    isActive: true,
  });

  for (const modelId of finalModels.filter((m) => !m.includes("/"))) {
    await setModelAlias(modelId, `${node.id}/${modelId}`);
  }

  const keys = await getApiKeys();
  let routerKey = keys?.[0]?.key || null;
  if (!routerKey) {
    const machineId = await getConsistentMachineId();
    const created = await createApiKey("stali-router", machineId);
    routerKey = created?.key || null;
  }

  const aliases = await getModelAliases();

  return {
    ok: true,
    activeBaseUrl: normalizedBase,
    activeProviderNodeId: node.id,
    activeConnectionId: conn.id,
    enabledModels: finalModels,
    recommendedModels: finalModels,
    routerApiKey: routerKey,
    aliases: aliases || {},
  };
}

export async function buildStaliProfile(request) {
  const [nodes, conns, keys, aliases] = await Promise.all([
    getProviderNodes(),
    getProviderConnections(),
    getApiKeys(),
    getModelAliases(),
  ]);

  const staliNodes = (nodes || []).filter(
    (n) => n?.type === OPENAI_COMPAT_TYPE && isAllowedStaliBaseUrl(n?.baseUrl),
  );
  const activeNode = staliNodes[0] || null;
  const activeConnection =
    (conns || []).find((c) => c?.provider === activeNode?.id) || null;

  const enabledModels = Array.isArray(
    activeConnection?.providerSpecificData?.enabledModels,
  )
    ? activeConnection.providerSpecificData.enabledModels.map(toModelId).filter(Boolean)
    : [];

  const recommended =
    enabledModels.length > 0 ? enabledModels : getDefaultRecommendedModels();

  const localEndpoint = request ? resolveLocalEndpoint(request) : "http://localhost:20128/v1";

  return {
    activeBaseUrl: activeNode?.baseUrl || null,
    activeProviderNodeId: activeNode?.id || null,
    activeConnectionId: activeConnection?.id || null,
    activeConnectionName: activeConnection?.name || null,
    routerApiKey: keys?.[0]?.key || null,
    enabledModels,
    recommendedModels: recommended,
    aliases: aliases || {},
    endpoint: localEndpoint,
    install: {
      oneLine: "npm install -g https://api.stali.vn/install/stalirouter-bundle.tgz && stalirouter",
      curl: "curl -fsSL https://api.stali.vn/install/stalirouter.sh | bash",
      git: "git clone https://github.com/ngocvu/StaliRouter.git",
      npmRegistry: "npm install -g stalirouter",
      bundle: "npm install -g https://api.stali.vn/install/stalirouter-bundle.tgz",
    },
  };
}
