// Fetches the latest Eek On Road videos and shorts and writes them into index.html.
// Run by .github/workflows/youtube.yml once a week. Needs Node 20+, no packages.
//   node tools/update-youtube.mjs            fetch from YouTube, update youtube.json and index.html
//   node tools/update-youtube.mjs --render   only re-render index.html from youtube.json
import { readFile, writeFile } from "node:fs/promises";

const CHANNEL_ID = "UCOogu7vHMVaDj4MK4x_Ssgw";
const CHANNEL_URL = "https://www.youtube.com/@EekOnRoad";
const LOGO_FILE = "assets/eek-on-road.jpg";
const COUNT = 3;
const UA = { "user-agent": "Mozilla/5.0 (compatible; eek-site-updater)", "accept-language": "en" };

const data = JSON.parse(await readFile("youtube.json", "utf8"));

const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// "0 to 100 km/h with Volvo EX 30 #0to100 #ev" -> "0 to 100 km/h with Volvo EX 30"
const clean = t => t.replace(/(\s+#[^\s#]+)+\s*$/u, "").replace(/​/g, "").trim();

// The uploads playlist split by YouTube: UULF = long videos, UUSH = shorts.
async function feed(prefix) {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${prefix}${CHANNEL_ID.slice(2)}`, { headers: UA });
  if (!res.ok) throw new Error(`${prefix} feed: HTTP ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: e.match(/<yt:videoId>([^<]+)/)[1],
    title: clean(decode(e.match(/<title>([\s\S]*?)<\/title>/)[1])),
    published: e.match(/<published>([^<]+)/)[1].slice(0, 10),
  }));
  if (!items.length) throw new Error(`${prefix} feed: no videos`);
  return items.sort((a, b) => b.published.localeCompare(a.published)).slice(0, COUNT);
}

async function logo() {
  const html = await (await fetch(CHANNEL_URL, { headers: UA })).text();
  const url = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  if (!url) throw new Error("logo: no og:image on channel page");
  const img = await fetch(url.replace(/=s\d+/, "=s176"), { headers: UA });
  if (!img.ok) throw new Error(`logo: HTTP ${img.status}`);
  await writeFile(LOGO_FILE, Buffer.from(await img.arrayBuffer()));
  return LOGO_FILE;
}

if (!process.argv.includes("--render")) {
  // A part that fails keeps last week's data, so the page never goes empty.
  for (const [key, job] of [["videos", () => feed("UULF")], ["shorts", () => feed("UUSH")], ["logo", logo]]) {
    try { data[key] = await job(); } catch (e) { console.warn(`kept old ${key}: ${e.message}`); }
  }
  await writeFile("youtube.json", JSON.stringify(data, null, 2) + "\n");
}

const card = (v, short) => `<a class="vid${short ? " short" : ""}" href="https://www.youtube.com/${short ? "shorts/" : "watch?v="}${v.id}">` +
  `<img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" loading="lazy"><b>${esc(v.title)}</b><span>${v.published}</span></a>`;
const block = `<!-- youtube:start - written by tools/update-youtube.mjs, do not edit by hand -->
<div class="panel yt"><img class="ytlogo" src="${esc(data.logo)}" alt="Eek On Road"><div>
<h3>Eek On Road</h3><p>EV test drives, road trips and 0-100 tests - subscribe so you don't miss the next one.</p>
<a class="btn red" href="${CHANNEL_URL}?sub_confirmation=1">Subscribe on YouTube</a></div></div>
<h3 class="ythead">Latest videos</h3>
<div class="vids">${data.videos.map(v => card(v, false)).join("")}</div>
<h3 class="ythead">Latest shorts</h3>
<div class="vids shorts">${data.shorts.map(v => card(v, true)).join("")}</div>
<!-- youtube:end -->`;

const page = await readFile("index.html", "utf8");
const next = page.replace(/<!-- youtube:start[\s\S]*?<!-- youtube:end -->/, block);
if (next === page && !page.includes(block)) throw new Error("youtube markers missing in index.html");
await writeFile("index.html", next);
console.log(`videos: ${data.videos.map(v => v.id)}  shorts: ${data.shorts.map(v => v.id)}  logo: ${data.logo}`);
