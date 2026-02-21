/**
 * Holmes Mock Server - Standalone Node.js HTTP server for E2E testing
 *
 * Implements the HolmesGPT API contract with pattern-based responses.
 *
 * Endpoints:
 *   GET  /healthz     - Health check
 *   POST /api/chat    - Chat endpoint (streaming and non-streaming)
 *
 * Environment variables:
 *   HOLMES_MOCK_HOST       - Host to bind to (default: 127.0.0.1)
 *   HOLMES_MOCK_PORT       - Port to listen on (default: 34117)
 *   HOLMES_MOCK_ERROR      - Error simulation mode: 'timeout', '500', 'disconnect'
 *   HOLMES_MOCK_DELAY_MS   - Delay before responding in milliseconds
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const host = process.env.HOLMES_MOCK_HOST || '127.0.0.1';
const port = Number(process.env.HOLMES_MOCK_PORT || '34117');
const errorMode = process.env.HOLMES_MOCK_ERROR || '';
const delayMs = Number(process.env.HOLMES_MOCK_DELAY_MS || '0');

// Load fixtures
let fixtures = {};
try {
  const fixturesPath = path.join(__dirname, 'fixtures.json');
  fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));
} catch (err) {
  console.error(`[holmes-mock] Warning: Could not load fixtures.json: ${err.message}`);
  // Use default fixtures if file is missing
  fixtures = {
    patterns: [
      {
        pattern: 'pod.*crash|CrashLoopBackOff',
        response: {
          response: '## Pod Crash Analysis\n\nThe pod is experiencing CrashLoopBackOff due to application errors.\n\n### Root Cause\n- Container exit code 1 indicates application failure\n- Check logs for application-specific errors\n\n### Recommendations\n1. Review application logs\n2. Verify resource limits\n3. Check liveness probe configuration',
          analysis: 'Pod crash root cause analysis completed',
        },
        streamChunks: [
          { event: 'ai_message', data: { content: '## Pod Crash Analysis\n\n', reasoning: 'Analyzing pod state' } },
          { event: 'start_tool_calling', data: { id: 'tool-1', tool_name: 'kubectl_logs', description: 'Fetching pod logs' } },
          { event: 'tool_calling_result', data: { tool_call_id: 'tool-1', name: 'kubectl_logs', status: 'success' } },
          { event: 'ai_message', data: { content: 'The pod is experiencing CrashLoopBackOff due to application errors.\n\n### Root Cause\n- Container exit code 1 indicates application failure\n- Check logs for application-specific errors\n\n### Recommendations\n1. Review application logs\n2. Verify resource limits\n3. Check liveness probe configuration' } },
          { event: 'ai_answer_end', data: { analysis: 'Pod crash root cause analysis completed' } },
          { event: 'stream_end', data: {} },
        ],
      },
      {
        pattern: 'deployment|replica',
        response: {
          response: '## Deployment Analysis\n\nThe deployment is healthy with all replicas running.\n\n### Status\n- Desired replicas: matched\n- Available replicas: all healthy\n- Strategy: RollingUpdate\n\n### Health Check\n✓ All pods running\n✓ No pending updates\n✓ Resource utilization normal',
          analysis: 'Deployment health check completed',
        },
        streamChunks: [
          { event: 'ai_message', data: { content: '## Deployment Analysis\n\n' } },
          { event: 'ai_message', data: { content: 'The deployment is healthy with all replicas running.\n\n### Status\n- Desired replicas: matched\n- Available replicas: all healthy\n- Strategy: RollingUpdate\n\n### Health Check\n✓ All pods running\n✓ No pending updates\n✓ Resource utilization normal' } },
          { event: 'ai_answer_end', data: { analysis: 'Deployment health check completed' } },
          { event: 'stream_end', data: {} },
        ],
      },
      {
        pattern: 'logs?|explain.*log',
        response: {
          response: '## Log Analysis\n\nAnalyzed the provided logs.\n\n### Findings\n- No critical errors detected\n- Warning level messages related to configuration\n- Application startup successful\n\n### Log Patterns\n1. Normal startup sequence\n2. Health check passing\n3. Incoming request handling',
          analysis: 'Log analysis completed',
        },
        streamChunks: [
          { event: 'ai_message', data: { content: '## Log Analysis\n\nAnalyzed the provided logs.\n\n### Findings\n- No critical errors detected\n- Warning level messages related to configuration\n- Application startup successful\n\n### Log Patterns\n1. Normal startup sequence\n2. Health check passing\n3. Incoming request handling' } },
          { event: 'ai_answer_end', data: { analysis: 'Log analysis completed' } },
          { event: 'stream_end', data: {} },
        ],
      },
      {
        pattern: 'swarm.*service',
        response: {
          response: '## Swarm Service Analysis\n\nThe Docker Swarm service is running normally.\n\n### Service Status\n- Replicas: running as expected\n- Network: connected to overlay\n- Ports: published correctly\n\n### Health\n✓ Service tasks healthy\n✓ Load balancer active\n✓ DNS resolution working',
          analysis: 'Swarm service analysis completed',
        },
        streamChunks: [
          { event: 'ai_message', data: { content: '## Swarm Service Analysis\n\nThe Docker Swarm service is running normally.\n\n### Service Status\n- Replicas: running as expected\n- Network: connected to overlay\n- Ports: published correctly\n\n### Health\n✓ Service tasks healthy\n✓ Load balancer active\n✓ DNS resolution working' } },
          { event: 'ai_answer_end', data: { analysis: 'Swarm service analysis completed' } },
          { event: 'stream_end', data: {} },
        ],
      },
      {
        pattern: 'secret|configmap',
        response: {
          response: '## Configuration Resource Analysis\n\nThe configuration resource has been analyzed.\n\n### Details\n- Resource exists and is accessible\n- Data keys are present\n- No encoding issues detected\n\n### Usage\n- Mounted as expected in pods\n- Environment variable injection working\n- No orphaned references',
          analysis: 'Configuration resource analysis completed',
        },
        streamChunks: [
          { event: 'ai_message', data: { content: '## Configuration Resource Analysis\n\nThe configuration resource has been analyzed.\n\n### Details\n- Resource exists and is accessible\n- Data keys are present\n- No encoding issues detected\n\n### Usage\n- Mounted as expected in pods\n- Environment variable injection working\n- No orphaned references' } },
          { event: 'ai_answer_end', data: { analysis: 'Configuration resource analysis completed' } },
          { event: 'stream_end', data: {} },
        ],
      },
    ],
    defaultResponse: {
      response: '## Resource Analysis\n\nThe resource appears to be in a healthy state.\n\n### Summary\n- No issues detected\n- Configuration is valid\n- Resource is operating normally\n\n### Recommendations\n- Continue monitoring\n- No immediate action required',
      analysis: 'General resource analysis completed',
    },
    defaultStreamChunks: [
      { event: 'ai_message', data: { content: '## Resource Analysis\n\nThe resource appears to be in a healthy state.\n\n### Summary\n- No issues detected\n- Configuration is valid\n- Resource is operating normally\n\n### Recommendations\n- Continue monitoring\n- No immediate action required' } },
      { event: 'ai_answer_end', data: { analysis: 'General resource analysis completed' } },
      { event: 'stream_end', data: {} },
    ],
  };
}

/**
 * Find matching response pattern for a question
 * @param {string} question - The user's question
 * @returns {{ response: object, streamChunks: Array } | null}
 */
function findMatchingPattern(question) {
  const lowerQuestion = question.toLowerCase();

  for (const patternDef of fixtures.patterns || []) {
    try {
      const regex = new RegExp(patternDef.pattern, 'i');
      if (regex.test(lowerQuestion)) {
        return {
          response: patternDef.response,
          streamChunks: patternDef.streamChunks || fixtures.defaultStreamChunks,
        };
      }
    } catch (err) {
      console.error(`[holmes-mock] Invalid pattern: ${patternDef.pattern}`);
    }
  }

  return {
    response: fixtures.defaultResponse,
    streamChunks: fixtures.defaultStreamChunks,
  };
}

/**
 * Send SSE event
 * @param {http.ServerResponse} res
 * @param {string} event
 * @param {object} data
 */
function sendSSE(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Handle non-streaming chat request
 * @param {http.ServerResponse} res
 * @param {object} body
 */
async function handleChat(res, body) {
  const question = body.ask || '';
  const matched = findMatchingPattern(question);

  const response = {
    ...matched.response,
    timestamp: new Date().toISOString(),
    query_id: `mock-${Date.now()}`,
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}

/**
 * Handle streaming chat request
 * @param {http.ServerResponse} res
 * @param {object} body
 */
async function handleStreamChat(res, body) {
  const question = body.ask || '';
  const matched = findMatchingPattern(question);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send chunks with small delays to simulate streaming
  for (const chunk of matched.streamChunks) {
    sendSSE(res, chunk.event, chunk.data);
    await new Promise((r) => setTimeout(r, 50)); // Small delay between chunks
  }

  res.end();
}

/**
 * Delay helper
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse JSON body from request
 * @param {http.IncomingMessage} req
 * @returns {Promise<object>}
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        resolve(body);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '';

  // Health endpoint
  if (url === '/healthz' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // Chat endpoint
  if (url === '/api/chat' && req.method === 'POST') {
    // Error simulation
    if (errorMode === 'timeout') {
      // Simulate timeout by waiting 60 seconds
      await delay(60_000);
      res.writeHead(504, { 'Content-Type': 'text/plain' });
      res.end('Gateway Timeout');
      return;
    }

    if (errorMode === '500') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', message: 'Simulated server error' }));
      return;
    }

    if (errorMode === 'disconnect') {
      // Close connection without sending response
      req.socket.destroy();
      return;
    }

    // Apply delay if configured
    if (delayMs > 0) {
      await delay(delayMs);
    }

    try {
      const body = await parseBody(req);

      if (body.stream) {
        await handleStreamChat(res, body);
      } else {
        await handleChat(res, body);
      }
    } catch (err) {
      console.error(`[holmes-mock] Error parsing request: ${err.message}`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Request', message: err.message }));
    }
    return;
  }

  // 404 for other endpoints
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.on('clientError', (err, socket) => {
  try {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  } catch {}
  socket.destroy(err);
});

server.listen(port, host, () => {
  console.log(`[holmes-mock] Holmes mock server listening on http://${host}:${port}`);
  if (errorMode) {
    console.log(`[holmes-mock] Error simulation mode: ${errorMode}`);
  }
  if (delayMs > 0) {
    console.log(`[holmes-mock] Response delay: ${delayMs}ms`);
  }
});
