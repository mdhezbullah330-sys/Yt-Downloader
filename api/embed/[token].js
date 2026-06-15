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
  const { token } = req.query;
  const db = await getDB();
  const col = db.collection("downloads");
  const doc = await col.findOne({ token });

  const BASE = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL;

  const isExpired = !doc || doc.expired || new Date() > new Date(doc.expiresAt);

  if (isExpired) {
    if (doc) await col.updateOne({ token }, { $set: { expired: true } });

    // Expired embed page — Discord এ দেখালে expired বলবে
    return res.status(410).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="⏰ Link Expired">
  <meta property="og:description" content="This video link has expired (15 min limit).">
  <meta property="og:site_name" content="VideoDL">
  <meta name="theme-color" content="#FF0000">
  <meta name="twitter:card" content="summary">
</head>
<body style="background:#0f0f0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px;margin:0">
  <div style="font-size:56px">⏰</div>
  <h1>Link Expired</h1>
  <p style="color:#aaa">This download link expired after 15 minutes.</p>
  <p style="color:#555;font-size:13px">Token: ${token}</p>
</body>
</html>`);
  }

  // Direct URL টা mp4 কিনা check
  const isMp4 = doc.directUrl && (
    /\.mp4(\?|$)/i.test(doc.directUrl) ||
    /googlevideo\.com/.test(doc.directUrl) ||
    /videoplayback/.test(doc.directUrl) ||
    /fbcdn\.net/.test(doc.directUrl) ||
    /tiktokcdn/.test(doc.directUrl)
  );

  const downloadLink = `${BASE}/api/file/${token}`;
  const title = doc.title || "Video";
  const thumbnail = doc.thumbnail || "";
  const duration = doc.duration || "";
  const platform = doc.platform || "video";
  const quality = doc.quality || "best";

  // Discord এ playable video embed করার জন্য
  // og:video দিলে Discord automatically player দেখায়
  return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>

  <!-- Open Graph — Discord embed এর জন্য -->
  <meta property="og:type" content="video.other">
  <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="📥 Platform: ${platform} | Quality: ${quality}${duration ? ` | ⏱ ${duration}` : ''} | ⏰ Expires in 15 min">
  <meta property="og:site_name" content="VideoDL">
  ${thumbnail ? `<meta property="og:image" content="${thumbnail}">` : ''}

  <!-- Video embed (Discord playable preview) -->
  ${isMp4 ? `
  <meta property="og:video" content="${doc.directUrl}">
  <meta property="og:video:secure_url" content="${doc.directUrl}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">
  ` : `
  <meta property="og:video" content="${downloadLink}">
  <meta property="og:video:type" content="video/mp4">
  `}

  <!-- Twitter card -->
  <meta name="twitter:card" content="player">
  <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">
  ${thumbnail ? `<meta name="twitter:image" content="${thumbnail}">` : ''}
  ${isMp4 ? `<meta name="twitter:player:stream" content="${doc.directUrl}">` : ''}

  <meta name="theme-color" content="${
    platform === 'youtube' ? '#FF0000' :
    platform === 'instagram' ? '#E1306C' :
    platform === 'tiktok' ? '#000000' :
    '#5865F2'
  }">
</head>
<body style="background:#0f0f0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;margin:0;padding:20px;box-sizing:border-box;text-align:center">
  <h2 style="margin:0;max-width:600px">${title}</h2>
  ${thumbnail ? `<img src="${thumbnail}" style="max-width:480px;width:100%;border-radius:8px">` : ''}
  <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
    <a href="${downloadLink}" style="background:#5865F2;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">📥 Download</a>
    ${doc.originalUrl ? `<a href="${doc.originalUrl}" style="background:#333;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">🔗 Original</a>` : ''}
  </div>
  <p style="color:#666;font-size:13px">⏰ Expires 15 minutes after creation</p>
</body>
</html>`);
}
