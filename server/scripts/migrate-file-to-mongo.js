import "dotenv/config";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, "..");

const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();
const MONGODB_DB_NAME = String(process.env.MONGODB_DB_NAME || "").trim();
const MONGODB_COLLECTION_NAME = String(process.env.MONGODB_COLLECTION || "appData").trim();
const MONGODB_DOCUMENT_ID = String(process.env.MONGODB_DOCUMENT_ID || "energy-ai").trim();
const DATA_DIR = path.resolve(process.env.APP_DATA_DIR || path.join(SERVER_ROOT, "data"));
const DATA_FILE = path.resolve(process.env.APP_DATA_FILE || path.join(DATA_DIR, "app-data.json"));

function normalizeDbShape(parsed) {
  return {
    users: Array.isArray(parsed?.users) ? parsed.users : [],
    sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
    chats: parsed?.chats && typeof parsed.chats === "object" ? parsed.chats : {}
  };
}

function resolveMongoDbName() {
  if (MONGODB_DB_NAME) {
    return MONGODB_DB_NAME;
  }

  try {
    const pathname = new URL(MONGODB_URI).pathname.replace(/^\/+/, "");
    return pathname || "";
  } catch {
    return "";
  }
}

async function readLocalFileDb() {
  await mkdir(DATA_DIR, { recursive: true });
  const raw = await readFile(DATA_FILE, "utf8");
  return normalizeDbShape(JSON.parse(raw));
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to server/.env before running the migration.");
  }

  const dbName = resolveMongoDbName();
  if (!dbName) {
    throw new Error("Could not resolve the MongoDB database name. Set MONGODB_DB_NAME or include the db name in MONGODB_URI.");
  }

  const db = await readLocalFileDb();
  const client = new MongoClient(MONGODB_URI, {
    ignoreUndefined: true
  });

  await client.connect();

  try {
    const collection = client.db(dbName).collection(MONGODB_COLLECTION_NAME);
    await collection.updateOne(
      { _id: MONGODB_DOCUMENT_ID },
      {
        $set: db
      },
      { upsert: true }
    );

    console.log(
      JSON.stringify(
        {
          status: "ok",
          source: DATA_FILE,
          database: dbName,
          collection: MONGODB_COLLECTION_NAME,
          documentId: MONGODB_DOCUMENT_ID,
          users: db.users.length,
          sessions: db.sessions.length,
          chats: Object.keys(db.chats || {}).length
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
