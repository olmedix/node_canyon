import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { getLastData, watchLastData } from './readMongo.js';

const PORT = Number(process.env.PORT || process.env.WS_PORT || 8080);

// ÚNICO handler HTTP
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return; // evita seguir y responder otra vez
    }

    if (req.url === '/debug/last') {
      const last = await getLastData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(last ?? { message: 'No hay datos' }));
      return;
    }

    // default
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Servidor WS activo. Conecta por ws(s)://host/ws');
  } catch (e) {
    // asegúrate de responder SOLO una vez
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: String(e) }));
  }
});

// WS montado sobre este server, en /ws
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws, req) => {
  console.log('🔌 WS conectado desde', req.socket.remoteAddress);

  const initial = await getLastData();
  if (initial) ws.send(JSON.stringify(initial));

  const stop = await watchLastData((doc) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(doc));
  });

  ws.on('close', () => { stop().catch(()=>{}); });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP:  http://0.0.0.0:${PORT}/health`);
  console.log(`WS:    ws://0.0.0.0:${PORT}/ws`);
});
