import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, '../bin/wanyra-mcp.mjs');

const child = spawn(process.execPath, [binPath], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env, HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '' }
});

const responses = new Map();
let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let idx;
  while ((idx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (responses.has(msg.id)) {
      responses.get(msg.id)(msg);
      responses.delete(msg.id);
    }
  }
});

function rpc(id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout on ${method}`)), 15000);
    responses.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

try {
  const init = await rpc(1, 'initialize', { protocolVersion: '2024-11-05', clientInfo: { name: 'smoke', version: '1.0' } });
  assert.equal(init.result.serverInfo.name, 'wanyra-mcp');

  const list = await rpc(2, 'tools/list');
  assert.equal(list.result.tools.length, 5);

  const models = await rpc(3, 'tools/call', {
    name: 'wanyra_list_models',
    arguments: { endpoint: 'video', limit: 5 }
  });
  assert.ok(!models.result.isError);
  const parsedModels = JSON.parse(models.result.content[0].text);
  assert.ok(parsedModels.totalMatched >= 20, `Expected >=20 video models, got ${parsedModels.totalMatched}`);

  const est = await rpc(4, 'tools/call', {
    name: 'wanyra_estimate_cost',
    arguments: { model: 'star1age-minimax-h3', seconds: 6 }
  });
  assert.ok(!est.result.isError);
  const parsedEst = JSON.parse(est.result.content[0].text);
  assert.equal(parsedEst.model, 'star1age-minimax-h3');
  assert.ok(parsedEst.estimatedPoints > 0);

  console.log('MCP_SMOKE_OK', {
    tools: list.result.tools.map((t) => t.name),
    videoModelsCount: parsedModels.totalMatched,
    minimax6sEstimate: parsedEst.estimatedCny
  });
} finally {
  child.kill();
}
