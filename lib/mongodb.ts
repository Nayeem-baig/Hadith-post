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
  return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(password)}@hadith.mwypj9r.mongodb.net/hadith?appName=Hadith&retryWrites=true&w=majority`;
}

export async function getMongoClient() {
  const uri = mongoUri();
  if (!uri) throw new Error("MongoDB credentials are not configured.");
  if (!global.__mongoClientPromise) {
    global.__mongoClientPromise = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
      tls: true
    }).connect();
  }
  global.__mongoClient = await global.__mongoClientPromise;
  return global.__mongoClient;
}

export async function getDb(databaseName = "hadith") : Promise<Db> {
  const client = await getMongoClient();
  return client.db(databaseName);
}

export function studioDocumentId(username: string) {
  return `hadith-studio:${username}`;
}
