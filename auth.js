// auth.js
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const globalForMongo = globalThis;

/* ========================
   ENV
======================== */
function getMongoUri() {
  return process.env.MONGO_URL || process.env.MONGO_URI || process.env.MONGO_URL;
}

function getBaseURL() {
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.CLIENT_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://localhost:3000"
  );
}

/* ========================
   DB CONNECTION (cached)
======================== */
async function connectDB() {
  if (globalForMongo._mongoDb) {
    return {
      client: globalForMongo._mongoClient,
      db: globalForMongo._mongoDb,
    };
  }

  const uri = getMongoUri();
  if (!uri) throw new Error("MONGO_URI not found");

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME || "Studing-room");

  globalForMongo._mongoClient = client;
  globalForMongo._mongoDb = db;

  return { client, db };
}

/* ========================
   AUTH INSTANCE
======================== */
let authInstance;

export async function getAuth() {
  if (authInstance) return authInstance;

  const { db } = await connectDB();

  authInstance = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-me",
    baseURL: getBaseURL(),

    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:5000",
      process.env.BETTER_AUTH_URL,
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean),

    database: mongodbAdapter(db),

    session: {
      strategy: "jwt",
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day refresh
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    },

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },

    advanced: {
      cookiePrefix: "better-auth",
    },
  });

  return authInstance;
}

/* ========================
   EXPORT
======================== */
export const auth = await getAuth();