import { randomUUID } from 'node:crypto';

const DEFAULT_BASE_URL = 'https://api.star1age.cn';
const SERVER_INFO = {
  name: 'wanyra-mcp',
  version: '1.0.0'
};
const PROTOCOL_VERSION = '2024-11-05';

function getBaseUrl() {
  return (process.env.WANYRA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function getApiKey() {
  return (process.env.WANYRA_API_KEY || '').trim();
}

function formatCnyFromPoints(points) {
  const n = Number(points);
  if (!Number.isFinite(n)) return String(points);
  // Exact decimal from integer points (1000 points = 1 CNY), never rounded.
  const exact = (n / 1000).toString();
  return `CN¥${exact}`;
}

async function fetchLiveCatalog() {
  const res = await fetch(`${getBaseUrl()}/api/portal/public-api/catalog`);
  if (!res.ok) throw new Error(`Catalog fetch failed with HTTP ${res.status}`);
  const data = await res.json();
  const models = (data.models || []).filter(
    (m) => m.status === 'ga' && !/internal/i.test(m.displayName || '')
  );
  return models;
}

function summarizeModelPricing(model) {
  const latest = model.pricing?.[0];
  if (!latest) return { unit: 'unknown', summary: 'See live catalog' };
  const billing = latest.dimensions?.billing;
  if (billing?.components?.length) {
    const parts = billing.components.map((c) => {
      const basis = Number(c.basis || 1);
      const label = basis === 1000000 ? `${c.meter}/1M` : `${c.meter}/${basis}`;
      return `${label}: ${formatCnyFromPoints(c.points)}`;
    });
    return { unit: latest.unit, summary: parts.join(', '), discountRate: latest.discountRate || null };
  }
  const resMap = latest.dimensions?.resolution || latest.dimensions?.tencentVodVideo?.prices;
  return {
    unit: latest.unit,
    basePrice: formatCnyFromPoints(latest.pointsPerUnit),
    minPrice: latest.minPoints ? formatCnyFromPoints(latest.minPoints) : null,
    discountRate: latest.discountRate || null,
    dimensions: resMap || null
  };
}

export const TOOLS = [
  {
    name: 'wanyra_list_models',
    description:
      'List live GA multimodal models and exact real-time pricing from Wanyra API (api.star1age.cn). Works without an API key.',
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          enum: ['text', 'video', 'image', 'audio', 'embedding', 'realtime', 'web'],
          description: 'Optional modality filter.'
        },
        query: {
          type: 'string',
          description: 'Optional substring filter on model id or display name (e.g. "seedance", "claude", "kling").'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 25
        }
      }
    }
  },
  {
    name: 'wanyra_estimate_cost',
    description:
      'Estimate exact CNY cost for a specific Wanyra model using live public catalog rates (1,000 points = CN¥1). Works without an API key.',
    inputSchema: {
      type: 'object',
      required: ['model'],
      properties: {
        model: { type: 'string', description: 'Wanyra model ID (e.g. star1age-minimax-h3, star1age-claude-sonnet-5.5).' },
        seconds: { type: 'number', description: 'Video/audio duration in seconds (for per_second models).' },
        resolution: { type: 'string', description: 'Optional resolution key such as 480P, 720P, 1080P, 2K, 4K.' },
        input_tokens: { type: 'number', description: 'Estimated input tokens (for text models).' },
        output_tokens: { type: 'number', description: 'Estimated output tokens (for text models).' }
      }
    }
  },
  {
    name: 'wanyra_chat',
    description:
      'Call any Wanyra text/reasoning model (Claude, GPT, Gemini, DeepSeek, Qwen, Grok) via OpenAI-compatible /v1/chat/completions. Requires WANYRA_API_KEY.',
    inputSchema: {
      type: 'object',
      required: ['model', 'prompt'],
      properties: {
        model: { type: 'string', description: 'Model ID such as star1age-deepseek-v4.1-flash or star1age-claude-sonnet-5.5.' },
        prompt: { type: 'string', description: 'User message prompt.' },
        system: { type: 'string', description: 'Optional system prompt.' },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
        max_tokens: { type: 'integer', minimum: 1 }
      }
    }
  },
  {
    name: 'wanyra_generate_image',
    description:
      'Generate an image using any Wanyra image model via POST /v1/images/generations. Requires WANYRA_API_KEY.',
    inputSchema: {
      type: 'object',
      required: ['model', 'prompt'],
      properties: {
        model: { type: 'string', description: 'Image model ID (query with wanyra_list_models endpoint="image").' },
        prompt: { type: 'string', description: 'Image generation prompt.' },
        size: { type: 'string', description: 'Optional size e.g. 1024x1024.' }
      }
    }
  },
  {
    name: 'wanyra_generate_video',
    description:
      'Submit an async video generation job via POST /v1/videos (MiniMax H3, Seedance 2.0/2.5, Kling 3.0, Wan 3.0, Vidu Q3, Hailuo H3) and optionally poll until completion. Requires WANYRA_API_KEY.',
    inputSchema: {
      type: 'object',
      required: ['model', 'prompt'],
      properties: {
        model: { type: 'string', description: 'Video model ID such as star1age-minimax-h3 or star1age-tokendance-seedance-2.0.' },
        prompt: { type: 'string', description: 'Video prompt.' },
        seconds: { type: 'integer', description: 'Optional clip duration in seconds.' },
        resolution: { type: 'string', description: 'Optional resolution (e.g. 720P, 1080P).' },
        wait: { type: 'boolean', default: false, description: 'If true, poll GET /v1/videos/{id} up to 180 seconds.' }
      }
    }
  }
];

function requireKey() {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      'WANYRA_API_KEY environment variable is required for this tool. Get a key at https://api.star1age.cn/en'
    );
  }
  return key;
}

async function runTool(name, args = {}) {
  if (name === 'wanyra_list_models') {
    let models = await fetchLiveCatalog();
    if (args.endpoint) models = models.filter((m) => m.endpoint === args.endpoint);
    if (args.query) {
      const q = String(args.query).toLowerCase();
      models = models.filter(
        (m) =>
          (m.id || '').toLowerCase().includes(q) ||
          (m.displayName || '').toLowerCase().includes(q)
      );
    }
    const limit = Math.min(Math.max(Number(args.limit || 25), 1), 100);
    const slice = models.slice(0, limit).map((m) => ({
      id: m.id,
      displayName: m.displayName,
      endpoint: m.endpoint,
      operations: m.operations,
      pricing: summarizeModelPricing(m),
      pageUrl: `${getBaseUrl()}/en/models/${encodeURIComponent(m.id)}`
    }));
    return {
      totalMatched: models.length,
      returned: slice.length,
      currencyRule: '1,000 points = CN¥1',
      models: slice
    };
  }

  if (name === 'wanyra_estimate_cost') {
    const models = await fetchLiveCatalog();
    const m = models.find((x) => x.id === args.model);
    if (!m) throw new Error(`Model not found in live GA catalog: ${args.model}`);
    const latest = m.pricing?.[0];
    if (!latest) return { model: m.id, note: 'No active pricing entry found.' };

    const billing = latest.dimensions?.billing;
    if (billing?.components?.length) {
      const inTokens = Number(args.input_tokens || 0);
      const outTokens = Number(args.output_tokens || 0);
      const inRate = Number(billing.components.find((c) => c.meter === 'input_tokens')?.points || 0);
      const outRate = Number(billing.components.find((c) => c.meter === 'output_tokens')?.points || 0);
      const totalPoints = Math.ceil((inTokens / 1_000_000) * inRate + (outTokens / 1_000_000) * outRate);
      return {
        model: m.id,
        displayName: m.displayName,
        inputTokens: inTokens,
        outputTokens: outTokens,
        estimatedPoints: totalPoints,
        estimatedCny: formatCnyFromPoints(totalPoints),
        pricing: summarizeModelPricing(m)
      };
    }

    const seconds = Number(args.seconds || 5);
    let perUnit = Number(latest.pointsPerUnit || 0);
    if (args.resolution && latest.dimensions?.resolution?.[args.resolution]) {
      perUnit = Number(latest.dimensions.resolution[args.resolution]);
    }
    const rawPoints = Math.ceil(perUnit * seconds);
    const minPoints = Number(latest.minPoints || 0);
    const totalPoints = Math.max(rawPoints, minPoints);
    return {
      model: m.id,
      displayName: m.displayName,
      unit: latest.unit,
      seconds,
      resolution: args.resolution || 'default',
      pointsPerUnit: perUnit,
      estimatedPoints: totalPoints,
      estimatedCny: formatCnyFromPoints(totalPoints),
      pricing: summarizeModelPricing(m)
    };
  }

  if (name === 'wanyra_chat') {
    const key = requireKey();
    const messages = [];
    if (args.system) messages.push({ role: 'system', content: String(args.system) });
    messages.push({ role: 'user', content: String(args.prompt) });
    const body = { model: args.model, messages };
    if (args.temperature !== undefined) body.temperature = args.temperature;
    if (args.max_tokens !== undefined) body.max_tokens = args.max_tokens;
    const res = await fetch(`${getBaseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    return {
      model: data.model || args.model,
      content: data.choices?.[0]?.message?.content ?? '',
      usage: data.usage || null
    };
  }

  if (name === 'wanyra_generate_image') {
    const key = requireKey();
    const body = { model: args.model, prompt: args.prompt };
    if (args.size) body.size = args.size;
    const res = await fetch(`${getBaseUrl()}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'Idempotency-Key': randomUUID()
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    return { httpStatus: res.status, result: data };
  }

  if (name === 'wanyra_generate_video') {
    const key = requireKey();
    const form = new FormData();
    form.set('model', String(args.model));
    form.set('prompt', String(args.prompt));
    if (args.seconds !== undefined) form.set('seconds', String(args.seconds));
    if (args.resolution) form.set('resolution', String(args.resolution));

    const submitRes = await fetch(`${getBaseUrl()}/v1/videos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Idempotency-Key': randomUUID()
      },
      body: form
    });
    const job = await submitRes.json();
    if (!submitRes.ok && submitRes.status !== 202) {
      throw new Error(`HTTP ${submitRes.status}: ${JSON.stringify(job)}`);
    }
    if (!args.wait || !job.id) {
      return { httpStatus: submitRes.status, job };
    }
    const deadline = Date.now() + 180_000;
    let current = job;
    while (Date.now() < deadline) {
      const st = String(current.status || '').toLowerCase();
      if (['completed', 'succeeded', 'failed', 'cancelled', 'canceled'].includes(st)) break;
      await new Promise((r) => setTimeout(r, 4000));
      const pollRes = await fetch(`${getBaseUrl()}/v1/videos/${encodeURIComponent(job.id)}`, {
        headers: { Authorization: `Bearer ${key}` }
      });
      if (pollRes.ok) current = await pollRes.json();
    }
    return { httpStatus: submitRes.status, job: current };
  }

  throw new Error(`Unknown tool: ${name}`);
}

export async function handleJsonRpcRequest(req) {
  if (!req || typeof req !== 'object') {
    return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
  }

  // Notifications have no id and expect no response.
  if (req.id === undefined && typeof req.method === 'string' && req.method.startsWith('notifications/')) {
    return null;
  }

  switch (req.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id: req.id,
        result: {
          protocolVersion: req.params?.protocolVersion || PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO
        }
      };

    case 'ping':
      return { jsonrpc: '2.0', id: req.id, result: {} };

    case 'tools/list':
      return { jsonrpc: '2.0', id: req.id, result: { tools: TOOLS } };

    case 'tools/call': {
      const toolName = req.params?.name;
      const toolArgs = req.params?.arguments || {};
      try {
        const output = await runTool(toolName, toolArgs);
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(output, null, 2) }]
          }
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            isError: true,
            content: [{ type: 'text', text: err?.message || String(err) }]
          }
        };
      }
    }

    default:
      if (req.id === undefined) return null;
      return {
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32601, message: `Method not found: ${req.method}` }
      };
  }
}
