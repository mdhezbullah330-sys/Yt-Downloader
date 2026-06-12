import { MongoClient } from "mongodb";

let cachedClient = null;
async function getDB() {
  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGODB_URI);
    await cachedClient.connect();
  }
  return cachedClient.db("videodl");
}

const expired = () => `
<!DOCTYPE html><html>
<head><title>Expired</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f0f0f;font-family:sans-serif;color:#fff;flex-direction:column;gap:12px">
  <div style="font-size:48px">⏰</div>
  <h1 style="margin:0">Link Expired</h1>
  <p style="color:#888;margin:0">This download link has expired (15 min limit).</p>
</body></html>`;

const notFound = () => `
<!DOCTYPE html><html>
<head><title>Not Found</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f0f0f;font-family:sans-serif;color:#fff;flex-direction:column;gap:12px">
  <div style="font-size:48px">❌</div>
  <h1 style="margin:0">Link Not Found</h1>
  <p style="color:#888;margin:0">This link does not exist.</p>
</body></html>`;

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).send(notFound());

  const db = await getDB();
  const col = db.collection("downloads");
  const doc = await col.findOne({ token });

  if (!doc) return res.status(404).send(notFound());

  if (new Date() > new Date(doc.expiresAt)) {
    await col.deleteOne({ token });
    return res.status(410).send(expired());
  }

  await col.updateOne({ token }, { $inc: { downloads: 1 } });
  return res.redirect(302, doc.directUrl);
}
