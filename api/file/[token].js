import { MongoClient } from "mongodb";

let cachedClient = null;
async function getDB() {
  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGODB_URI);
    await cachedClient.connect();
  }
  return cachedClient.db("videodl");
}

function page(emoji, title, sub, color = "#0f0f0f") {
  return `<!DOCTYPE html><html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:${color};font-family:sans-serif;color:#fff;flex-direction:column;gap:12px;text-align:center;padding:20px;box-sizing:border-box">
  <div style="font-size:56px">${emoji}</div>
  <h1 style="margin:0;font-size:24px">${title}</h1>
  <p style="color:#aaa;margin:0;font-size:15px">${sub}</p>
</body></html>`;
}

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).send(page("❌", "Invalid Link", "No token provided."));

  const db = await getDB();
  const col = db.collection("downloads");
  const doc = await col.findOne({ token });

  // Token আছে কিন্তু expired
  if (doc && (doc.expired || new Date() > new Date(doc.expiresAt))) {
    // expired mark করো কিন্তু delete করো না
    await col.updateOne({ token }, { $set: { expired: true } });
    return res.status(410).send(page(
      "⏰",
      "Link Expired",
      `This download link expired after 15 minutes.<br><br><span style="color:#666;font-size:13px">Token: ${token}</span>`,
      "#0f0f0f"
    ));
  }

  // Token নেই মানে কখনো ছিলই না
  if (!doc) {
    return res.status(404).send(page(
      "🔍",
      "Link Not Found",
      "This link does not exist. It may never have been created.",
      "#0f0f0f"
    ));
  }

  await col.updateOne({ token }, { $inc: { downloads: 1 } });
  return res.redirect(302, doc.directUrl);
}
