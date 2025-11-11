import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Conexión Mongo
const mongoClient = new MongoClient(process.env.MONGODB_URI);
let client;

async function getClient() {
  if (!client) {
    client = await mongoClient.connect();
    console.log("✅ Conectado a Mongo Atlas");
  }
  return client;
}

export async function changeData({ time, distancia }) {
  const client = await getClient();
  const collection = client.db("tienda").collection("canyon");

  const response = await collection.updateOne(
    {
      _id: "lastData",
      $or: [{ time: { $ne: time } }, { distancia: { $ne: distancia } }],
    },
    { $set: { time, distancia } },
    { upsert: true }
  );

  if (response.matchedCount === 0 && response.upsertedCount === 0) {
    console.log("No cambió: no se actualiza.");
  } else if (response.upsertedCount === 1) {
    console.log("Creado documento 'ultimo'.");
  } else if (response.modifiedCount === 1) {
    console.log("Cambió: documento actualizado.");
  }
}

