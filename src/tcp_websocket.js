import net from 'node:net';
import { WebSocketServer } from 'ws';

// puertos
const TCP_PORT = Number(process.env.TCP_PORT); // ESP  
const WS_PORT  = Number(process.env.WS_PORT); // gafas 

// 1) Conexión para las gafas por el puerto 8080
const wss = new WebSocketServer({ port: WS_PORT });

// Cliente (gafas)
let wsClient = null;

// registrar conexión de las gafas
wss.on('connection', (ws) => {
  wsClient = ws;
  ws.on('close', () => {
    wsClient = null;
  });
});

// Servidor TCP (para el ESP en modo AT)
const server = net.createServer((socket) => {
  socket.setEncoding('utf8');
  socket.setNoDelay(true); // menos latencia

  let buf = '';
  socket.on('data', (chunk) => {
    buf += chunk;
    // procesamos líneas terminadas en \n y si llegan incompletas se quedan en el buffer hasta el siguiente \n.
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;

      let payload;
      try {
        payload = JSON.parse(line);
      } catch (error) {
        console.error('[TCP] error al parsear JSON:', error.message);
        return;
      }

      // añadimos timestamp del servidor y lo enviamos a los WS
      if (wsClient && wsClient.readyState === 1) {
        wsClient.send(JSON.stringify({ time: Date.now(), data: payload }));
      }
      //console.log('[→WS]', payload);
    }
  });

  socket.on('close', () => console.log('[TCP] ESP desconectado'));
  socket.on('error', (e) => console.error('[TCP] error:', e.message));
});

server.listen(TCP_PORT, () => {
  console.log(`[TCP] escuchando en tcp://0.0.0.0:${TCP_PORT}`);
  console.log(`[WS] escuchando en ws://0.0.0.0:${WS_PORT}`);
});
