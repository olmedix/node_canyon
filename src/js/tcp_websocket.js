// src/js/tcp_websocket.js
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { getLastData, watchLastData } from './readMongo.js';

const PORT = Number(process.env.PORT || process.env.WS_PORT || 8080);

// --- Servidor HTTP para / y /health ---
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Servidor WS activo en /ws');
});

// --- WebSocket montado sobre el HTTP server ---
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws, req) => {
  console.log('🔌 Cliente WS conectado desde', req.socket.remoteAddress);

  const initial = await getLastData();
  if (initial) ws.send(JSON.stringify(initial));

  const stop = await watchLastData((doc) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(doc));
  });

  ws.on('close', () => stop().catch(() => {}));
});

//debug
server.on('request', async (req, res) => {
  if (req.url === '/debug/last') {
    try {
      const last = await getLastData();
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(last ?? { message: 'No hay datos' }));
      return;
    } catch (e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: String(e) }));
      return;
    }
  }
});

// --- Escuchar ---
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP:  http://0.0.0.0:${PORT}/health`);
  console.log(`WS:    ws://0.0.0.0:${PORT}/ws`);
});
