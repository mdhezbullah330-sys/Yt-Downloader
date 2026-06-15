import { MongoClient } from "mongodb";
import { randomBytes } from "crypto";

let cachedClient = null;
async function getDB() {
  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGODB_URI);
    await cachedClient.connect();
  }
  return cachedClient.db("videodl");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.headers.authorization !== `Bearer ${process.env.API_SECRET}`)
    return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { url, quality, title, thumbnail, duration, filesize, direct_url, platform } = req.body;
  if (!url || !direct_url)
    return res.status(400).json({ error: "url and direct_url are required" });

  const db = await getDB();
  const col = db.collection("downloads");

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await col.insertOne({
    token,
    originalUrl: url,
    directUrl: direct_url,
    platform: platform || "unknown",
    quality: quality || "best",
    title: title || "Video",
    thumbnail: thumbnail || null,
    duration: duration || null,
    filesize: filesize || null,
    expiresAt,
    createdAt: new Date(),
    expired: false,
    downloads: 0,
  });

  // TTL index — 15 min পর auto mark as expired (delete করব না)
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});

  const BASE = process.env.BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  return res.status(200).json({
    success: true,
    token,
    link: `${BASE}/api/file/${token}`,
    embed_link: `${BASE}/api/embed/${token}`,
    expires_in_minutes: 15,
    expires_at: expiresAt.toISOString(),
    title: title || "Video",
    thumbnail,
    duration,
    filesize,
    platform,
    quality,
  });
}
