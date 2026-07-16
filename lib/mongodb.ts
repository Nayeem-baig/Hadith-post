import { MongoClient, type Db } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function mongoUri() {
  const user = process.env.MONGO_USER;
  const password = process.env.MONGO_PASSWORD;
  if (!user || !password) return null;
  return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(password)}@hadith.mwypj9r.mongodb.net/?appName=Hadith&retryWrites=true&w=majority&tls=true`;
}

export async function getMongoClient() {
  const uri = mongoUri();
  if (!uri) throw new Error("MongoDB credentials are not configured.");
  if (!global.__mongoClientPromise) {
    global.__mongoClientPromise = new MongoClient(uri, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000,
      socketTimeoutMS: 4000,
      tls: true
    }).connect();
  }
  try {
    global.__mongoClient = await global.__mongoClientPromise;
    return global.__mongoClient;
  } catch (error) {
    global.__mongoClient = undefined;
    global.__mongoClientPromise = undefined;
    const message = error instanceof Error ? error.message : String(error);
    if (/SSL routines|tlsv1 alert internal error|ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR/i.test(message)) {
      throw new Error(
        "MongoDB Atlas connection failed during TLS negotiation. In Atlas, add your current IP to the project's Network Access/IP Access List; for Vercel, allow the deployment egress IP or temporarily use 0.0.0.0/0 while testing."
      );
    }
    throw error;
  }
}

export async function getDb(databaseName = "hadith") : Promise<Db> {
  const client = await getMongoClient();
  return client.db(databaseName);
}

export function studioDocumentId(username: string) {
  return `hadith-studio:${username}`;
}
