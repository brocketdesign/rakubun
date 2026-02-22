import { MongoClient, type Db } from 'mongodb';

const MONGODB_URL = process.env.MONGODB_URL!;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'rakubun';

let cachedClient: MongoClient | null = null;

export async function getDb(): Promise<Db> {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGODB_URL);
    await cachedClient.connect();
  }
  return cachedClient.db(MONGODB_DATABASE);
}
