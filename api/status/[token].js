import { MongoClient } from "mongodb";

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
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Token required" });

  const db = await getDB();
  const doc = await db.collection("downloads").findOne({ token });

  if (!doc) return res.status(404).json({ valid: false, reason: "not_found" });

  const now = new Date();
  if (now > new Date(doc.expiresAt)) {
    return res.status(200).json({ valid: false, reason: "expired" });
  }

  const ms = new Date(doc.expiresAt) - now;
  return res.status(200).json({
    valid: true,
    token,
    title: doc.title,
    platform: doc.platform,
    quality: doc.quality,
    thumbnail: doc.thumbnail,
    duration: doc.duration,
    filesize: doc.filesize,
    downloads: doc.downloads,
    expires_at: doc.expiresAt,
    remaining: `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`,
  });
}
