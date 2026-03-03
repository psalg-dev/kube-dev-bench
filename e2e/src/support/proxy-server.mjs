import http from 'node:http';
import net from 'node:net';
import { URL } from 'node:url';

const host = process.env.PROXY_HOST || '127.0.0.1';
const port = Number(process.env.PROXY_PORT || '34116');

function sendBadRequest(res, msg) {
  res.writeHead(400, { 'content-type': 'text/plain' });
  res.end(msg);
}

const server = http.createServer((req, res) => {
  if (!req.url) return sendBadRequest(res, 'missing url');

  // Health endpoint for test harness readiness checks.
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }

  // Typical forward-proxy requests use absolute-form URLs (e.g. http://example.com/path).
  let target;
  try {
    target = new URL(req.url);
  } catch {
    return sendBadRequest(res, `invalid absolute proxy url: ${req.url}`);
  }

  const headers = { ...req.headers };
  // Strip hop-by-hop headers
  delete headers['proxy-authorization'];
  delete headers['proxy-connection'];
  delete headers['connection'];

  const upstream = http.request(
    {
      method: req.method,
      hostname: target.hostname,
      port: target.port ? Number(target.port) : 80,
      path: target.pathname + target.search,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstream.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`bad gateway: ${err.message}`);
  });

  req.pipe(upstream);
});

server.on('connect', (req, clientSocket, head) => {
  // CONNECT host:port HTTP/1.1
  const authority = req.url || '';
  const idx = authority.lastIndexOf(':');
  const targetHost = idx === -1 ? authority : authority.slice(0, idx);
  const targetPort = Number(idx === -1 ? '443' : authority.slice(idx + 1)) || 443;

  const upstreamSocket = net.connect(targetPort, targetHost, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length > 0) upstreamSocket.write(head);

    // Enable keepalive to reuse connections and set no-delay for responsiveness.
    upstreamSocket.setKeepAlive(true, 30_000);
    upstreamSocket.setNoDelay(true);
    clientSocket.setKeepAlive(true, 30_000);
    clientSocket.setNoDelay(true);

    upstreamSocket.pipe(clientSocket);
    clientSocket.pipe(upstreamSocket);
  });

  // When either side ends, use destroy() (sends RST) instead of allowing
  // graceful FIN/FIN-ACK close.  This avoids accumulating TIME_WAIT sockets
  // on Windows, which exhausts ephemeral ports after many sequential tests.
  const cleanup = () => {
    if (!upstreamSocket.destroyed) upstreamSocket.destroy();
    if (!clientSocket.destroyed) clientSocket.destroy();
  };
  upstreamSocket.on('end', cleanup);
  clientSocket.on('end', cleanup);
  upstreamSocket.on('close', cleanup);
  clientSocket.on('close', cleanup);

  upstreamSocket.on('error', (err) => {
    try {
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    } catch {}
    cleanup();
  });

  clientSocket.on('error', () => {
    cleanup();
  });
});

server.on('clientError', (err, socket) => {
  try {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  } catch {}
  socket.destroy(err);
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`e2e proxy listening on http://${host}:${port}`);
});
