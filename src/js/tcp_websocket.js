// src/js/tcp_websocket.js
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { getLastData, watchLastData } from './readMongo.js';

const WS_PORT = Number(process.env.WS_PORT || 8080);

// 1) HTTP server (para /health y para “anclar” el WS)
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WS alive. Connect via ws(s)://host/ws');
});

// 2) WebSocket server montado sobre el HTTP server, en ruta /ws
const wss = new WebSocketServer({ server, path: '/ws' });

// 3) Conexiones WS
wss.on('connection', async (ws, req) => {
  console.log('🔌 Cliente WS conectado desde', req.socket.remoteAddress);

  // Estado inicial
  const initial = await getLastData();
  if (initial) ws.send(JSON.stringify(initial));

  // Streaming en tiempo real
  const stop = await watchLastData((doc) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(doc));
  });

  // Limpieza
  ws.on('close', () => { stop().catch(() => {}); });
});

// 4) Escuchar (fuera del handler!)
server.listen(WS_PORT, '0.0.0.0', () => {
  console.log(`HTTP:  http://0.0.0.0:${WS_PORT}/health`);
  console.log(`WS:    ws://0.0.0.0:${WS_PORT}/ws`);
});
