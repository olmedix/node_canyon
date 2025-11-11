//node .\mqtt.js

import mqtt from 'mqtt';
import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Conexión Mongo
const mongoClient = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

await mongoClient.connect();
const collection = mongoClient.db('tienda').collection('canyon');

// Conexión MQTT
const client = mqtt.connect('mqtt://broker.emqx.io:1883', {
  clientId: 'node-' + Math.random().toString(16).slice(2),
  keepalive: 60,
  clean: true,
  reconnectPeriod: 2000,
});

const TOPIC = 'juanjo/sensores/distancia';

client.on('connect', () => {
  console.log('[MQTT] Conectado');
  client.subscribe(TOPIC, (err) => {
    if (err) console.error('[MQTT] Error:', err);
    else console.log('[MQTT] Subscrito a', TOPIC);
  });
});

client.on('message', async (topic, payload) => {
  const txt = payload.toString('utf8');
  let data = txt;
  try { data = JSON.parse(txt); } catch (_) {}
  await collection.insertOne(data);
  console.log('Guardado:', data);
});

// Cierre 
process.on('SIGINT', async () => {
  client.end();
  await mongoClient.close();
  process.exit(0);
});
