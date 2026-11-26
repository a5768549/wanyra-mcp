#!/usr/bin/env node
import readline from 'node:readline';
import { handleJsonRpcRequest } from '../src/server.mjs';

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req;
  try {
    req = JSON.parse(trimmed);
  } catch (err) {
    const resp = {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: `Parse error: ${err.message}` }
    };
    process.stdout.write(JSON.stringify(resp) + '\n');
    return;
  }

  try {
    const resp = await handleJsonRpcRequest(req);
    if (resp !== null && resp !== undefined) {
      process.stdout.write(JSON.stringify(resp) + '\n');
    }
  } catch (err) {
    if (req && req.id !== undefined) {
      const resp = {
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32603, message: err?.message || String(err) }
      };
      process.stdout.write(JSON.stringify(resp) + '\n');
    }
  }
});
