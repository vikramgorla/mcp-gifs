#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { MemoryCache } from './cache.js';
import { createServer } from './server.js';

const cache = new MemoryCache();
serveStdio(() => createServer({ cache, klipyApiKey: process.env.KLIPY_API_KEY || undefined }), {
  onerror: (err) => console.error('[mcp-gifs]', err.message),
});
