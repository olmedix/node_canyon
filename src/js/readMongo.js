import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const mongoClient = new MongoClient(process.env.MONGODB_URI);
let client;
console.log("Archivo readMongo");

async function getClient() {
  if (!client) {
    client = await mongoClient.connect();
  }
  return client;
}

async function getCollection() {
  const c = await getClient();
  return c.db("tienda").collection("canyon");
}

// Obtener el último dato almacenado (por time desc)
export async function getLastData() {
  const collection = await getCollection();
  return collection.findOne({}, { sort: { time: -1 } });
}

export async function watchLastData(onChange) {
  const collection = await getCollection();

  // Último conocido para comparación
  const latest = await getLastData();

  let latestTime = latest?.time ?? -Infinity;

  // Solo queremos inserts
  const pipeline = [{ $match: { operationType: "insert" } }];
  const changeStream = collection.watch(pipeline, { fullDocument: "updateLookup" });

  changeStream.on("change", (change) => {
    const doc = change.fullDocument;
    if (!doc) return;     
    if (typeof doc.time !== "number") return; 

    if (doc.time > latestTime) {
      latestTime = doc.time;
      try {
        onChange({ time: doc.time, distancia: doc.distancia });
      } catch (err) {
        console.error("onChange handler error:", err);
      }
    }
  });

  changeStream.on("error", (err) => {
    console.error("ChangeStream error:", err);
  });

  // Devolver cierre del watcher
  return async function close() {
    try { await changeStream.close(); } catch {}
  };
}
