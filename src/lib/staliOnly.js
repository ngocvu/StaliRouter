const DEFAULT_ALLOWED_HOSTS = ["api.stali.vn"];

/** API prefixes blocked entirely when STALI_ONLY_MODE is on (mirror DashboardLayout). */
export const STALI_BLOCKED_API_PREFIXES = [
  "/api/oauth",
  "/api/combos",
  "/api/proxy-pools",
  "/api/media-providers",
  "/api/pxpipe",
  "/api/headroom",
  "/api/translator",
  "/api/tunnel",
  "/api/mcp",
  "/api/cli-tools/antigravity-mitm",
  "/api/cloud",
];

/** Partially restricted — allowed but sensitive fields blocked in handlers. */
export const STALI_RESTRICTED_API_PREFIXES = [
  "/api/settings/proxy-test",
  "/api/providers/validate",
  "/api/providers/test-batch",
  "/api/providers/suggested-models",
  "/api/providers/kilo",
  "/api/models/custom",
  "/api/models/disabled",
  "/api/models/availability",
  "/api/models/test",
];

const DEFAULT_RECOMMENDED_MODELS = [
  "claude-fable-5",
  "claude-sonnet-5",
  "claude-opus-5",
  "gpt-5.6-sol",
];

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isStaliOnlyMode() {
  return parseBool(process.env.STALI_ONLY_MODE, true);
}

export function getAllowedStaliHosts() {
  const raw = String(process.env.STALI_ALLOWED_BASE_HOSTS || "").trim();
  if (!raw) return DEFAULT_ALLOWED_HOSTS;
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_HOSTS;
}

export function normalizeBaseUrlV1(url) {
  const trimmed = String(url || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

export function isAllowedStaliBaseUrl(url) {
  try {
    const normalized = normalizeBaseUrlV1(url);
    if (!normalized) return false;
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    const allowedHosts = getAllowedStaliHosts();
    return allowedHosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export function isStaliBlockedApiPath(pathname) {
  if (!pathname) return false;
  return STALI_BLOCKED_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function staliBlockedFeatureName(pathname) {
  if (pathname.startsWith("/api/oauth")) return "OAuth providers";
  if (pathname.startsWith("/api/combos")) return "Combos";
  if (pathname.startsWith("/api/proxy-pools")) return "Proxy pools";
  if (pathname.startsWith("/api/media-providers")) return "Media providers";
  if (pathname.startsWith("/api/pxpipe")) return "PXPIPE";
  if (pathname.startsWith("/api/headroom")) return "Headroom / Token Saver";
  if (pathname.startsWith("/api/translator")) return "Translator debug";
  if (pathname.startsWith("/api/tunnel")) return "Remote tunnel";
  if (pathname.startsWith("/api/mcp")) return "MCP plugins";
  if (pathname.startsWith("/api/cli-tools/antigravity-mitm")) return "Antigravity MITM";
  if (pathname.startsWith("/api/cloud")) return "Cloud deploy";
  return "This feature";
}

/** Returns JSON 403 Response or null if allowed. */
export function staliOnlyBlockedResponse(pathname) {
  if (!isStaliOnlyMode()) return null;
  if (!isStaliBlockedApiPath(pathname)) return null;
  const feature = staliBlockedFeatureName(pathname);
  return Response.json(
    { error: `Stali-only mode: ${feature} is not available` },
    { status: 403 },
  );
}

export function isOpenAICompatibleProviderId(providerId) {
  return String(providerId || "").startsWith("openai-compatible-");
}

export async function assertStaliConnectionAccess(connection, getProviderNodeById) {
  if (!isStaliOnlyMode()) return null;
  const providerId = String(connection?.provider || "");
  if (!isOpenAICompatibleProviderId(providerId)) {
    return Response.json(
      { error: "Stali-only mode: non-Stali connections are not available" },
      { status: 403 },
    );
  }
  const node = await getProviderNodeById(providerId);
  const baseUrl = node?.baseUrl || connection?.providerSpecificData?.baseUrl;
  if (!isAllowedStaliBaseUrl(baseUrl)) {
    return Response.json(
      { error: "Stali-only mode: provider base URL is not an allowed Stali host" },
      { status: 403 },
    );
  }
  return null;
}

export async function assertStaliNodeAccess(node) {
  if (!isStaliOnlyMode()) return null;
  if (node?.type !== "openai-compatible") {
    return Response.json(
      { error: "Stali-only mode: only OpenAI-compatible provider nodes are available" },
      { status: 403 },
    );
  }
  if (!isAllowedStaliBaseUrl(node?.baseUrl)) {
    return Response.json(
      { error: "Stali-only mode: provider base URL is not an allowed Stali host" },
      { status: 403 },
    );
  }
  return null;
}

export function getDefaultRecommendedModels() {
  return [...DEFAULT_RECOMMENDED_MODELS];
}

export function resolveLocalEndpoint(request) {
  const envBase = String(process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "").trim();
  if (envBase) {
    try {
      const u = new URL(envBase);
      return `${u.origin}/v1`;
    } catch { /* fall through */ }
  }
  try {
    const host = request?.headers?.get?.("host");
    if (host) return `http://${host.split(",")[0].trim()}/v1`;
  } catch { /* noop */ }
  return "http://localhost:20128/v1";
}

const PROCESS_MARKERS = ["stalirouter", "9router", "cli.js"];

/** Match node processes belonging to this app (kill/updater safety). */
export function isAppProcessCmdline(cmd) {
  const lower = String(cmd || "").toLowerCase();
  if (lower.includes("next-server")) return true;
  if (!lower.includes("node")) return false;
  const hasName = PROCESS_MARKERS.some((id) => lower.includes(id));
  const hasPath =
    lower.includes("/stalirouter") ||
    lower.includes("\\stalirouter") ||
    lower.includes("/9router") ||
    lower.includes("\\9router") ||
    lower.includes("cli.js");
  return hasName && hasPath;
}
