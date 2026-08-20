// Agent Skills metadata — single source of truth for /dashboard/skills page.
// Each skill = 1 raw GitHub URL the user copies and pastes to any AI agent.

const REPO = "ngocvu/StaliRouter";
const BRANCH = "main";
const SKILL_PATH = "skills";

/** Legacy upstream folder names still resolve for copied skill trees. */
const SKILL_ID_ALIASES = {
  stalirouter: "9router",
  "stalirouter-chat": "9router-chat",
  "stalirouter-image": "9router-image",
  "stalirouter-tts": "9router-tts",
  "stalirouter-stt": "9router-stt",
  "stalirouter-embeddings": "9router-embeddings",
  "stalirouter-web-search": "9router-web-search",
  "stalirouter-web-fetch": "9router-web-fetch",
  "stalirouter-video": "9router-video",
};

export const SKILLS_REPO_URL = `https://github.com/${REPO}`;
export const SKILLS_RAW_BASE = `https://raw.githubusercontent.com/${REPO}/refs/heads/${BRANCH}/${SKILL_PATH}`;
export const SKILLS_BLOB_BASE = `https://github.com/${REPO}/blob/${BRANCH}/${SKILL_PATH}`;

export const SKILLS = [
  {
    id: "stalirouter",
    name: "StaliRouter (Entry)",
    description: "Setup + index of all capabilities. Start here — Stali preset, base URL, auth, model discovery.",
    endpoint: null,
    icon: "hub",
    isEntry: true,
  },
  {
    id: "stalirouter-chat",
    name: "Chat",
    description: "Chat / code-gen via OpenAI or Anthropic format with streaming.",
    endpoint: "/v1/chat/completions",
    icon: "chat",
  },
  {
    id: "stalirouter-image",
    name: "Image Generation",
    description: "Text-to-image via DALL-E, Imagen, FLUX, MiniMax, SDWebUI…",
    endpoint: "/v1/images/generations",
    icon: "image",
  },
  {
    id: "stalirouter-tts",
    name: "Text-to-Speech",
    description: "OpenAI / ElevenLabs / Edge / Google / Deepgram voices.",
    endpoint: "/v1/audio/speech",
    icon: "record_voice_over",
  },
  {
    id: "stalirouter-stt",
    name: "Speech-to-Text",
    description: "Transcribe audio via OpenAI Whisper, Groq, Gemini, Deepgram, AssemblyAI…",
    endpoint: "/v1/audio/transcriptions",
    icon: "mic",
  },
  {
    id: "stalirouter-embeddings",
    name: "Embeddings",
    description: "Vectors for RAG / semantic search via OpenAI, Gemini, Mistral…",
    endpoint: "/v1/embeddings",
    icon: "scatter_plot",
  },
  {
    id: "stalirouter-web-search",
    name: "Web Search",
    description: "Tavily / Exa / Brave / Serper / SearXNG / Google PSE / You.com.",
    endpoint: "/v1/search",
    icon: "search",
  },
  {
    id: "stalirouter-web-fetch",
    name: "Web Fetch",
    description: "URL → markdown / text / HTML via Firecrawl, Jina, Tavily, Exa.",
    endpoint: "/v1/web/fetch",
    icon: "language",
  },
];

function resolveSkillFolder(id) {
  return SKILL_ID_ALIASES[id] || id;
}

export function getSkillRawUrl(id) {
  return `${SKILLS_RAW_BASE}/${resolveSkillFolder(id)}/SKILL.md`;
}

export function getSkillBlobUrl(id) {
  return `${SKILLS_BLOB_BASE}/${resolveSkillFolder(id)}/SKILL.md`;
}
