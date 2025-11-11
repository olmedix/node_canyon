import { WebSocketServer } from 'ws';
import { getLastData,watchLastData } from './readMongo.js'; 

// puertos
const WS_PORT  = Number(process.env.WS_PORT); // gafas 

// Conexión para las gafas por el puerto 8080
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', async (ws) => {
   console.log('🔌 Cliente WS conectado desde');
  const initial = await getLastData();
  if (initial) {
    ws.send(JSON.stringify(initial));
  }
  // Streaming
  const stop = await watchLastData((doc) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(doc));
  });

  // limpieza
  ws.on("close", () => { stop().catch(()=>{}); });
});
