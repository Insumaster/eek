// Fetches the 3 newest and 3 most viewed Eek On Road videos and shorts and writes them into index.html.
// Run by .github/workflows/youtube.yml once a week. Needs Node 20+, no packages.
//   node tools/update-youtube.mjs            fetch from YouTube, update youtube.json and index.html
//   node tools/update-youtube.mjs --render   only re-render index.html from youtube.json
// Most viewed: with a YOUTUBE_API_KEY (repo secret) every upload is ranked by views. Without it,
// the views in the RSS feeds (last 15 uploads) are merged with last week's most viewed list.
import { readFile, writeFile } from "node:fs/promises";

const CHANNEL_ID = "UCOogu7vHMVaDj4MK4x_Ssgw";
const CHANNEL_URL = "https://www.youtube.com/@EekOnRoad";
const LOGO_FILE = "assets/eek-on-road.jpg";
const COUNT = 3;
const KEY = process.env.YOUTUBE_API_KEY;
const UA = { "user-agent": "Mozilla/5.0 (compatible; eek-site-updater)", "accept-language": "en" };
// The uploads playlist split by YouTube: UULF = long videos, UUSH = shorts.
const PLAYLIST = { videos: "UULF" + CHANNEL_ID.slice(2), shorts: "UUSH" + CHANNEL_ID.slice(2) };

const data = JSON.parse(await readFile("youtube.json", "utf8"));

const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// "0 to 100 km/h with Volvo EX 30 #0to100 #ev" -> "0 to 100 km/h with Volvo EX 30"
const clean = t => t.replace(/(\s+#[^\s#]+)+\s*$/u, "").replace(/​/g, "").replace(/\s{2,}/g, " ").trim();
const newest = list => [...list].sort((a, b) => b.published.localeCompare(a.published)).slice(0, COUNT);
// Most viewed, leaving out the ones already shown as newest.
const mostViewed = (list, latest) => {
  const seen = new Set(latest.map(v => v.id)), out = [];
  for (const v of [...list].sort((a, b) => b.views - a.views)) if (!seen.has(v.id)) { seen.add(v.id); out.push(v); }
  return out.slice(0, COUNT);
};

async function get(url, what) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status}`);
  return res;
}

async function fromFeed(kind) {
  const xml = await (await get(`https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST[kind]}`, `${kind} feed`)).text();
  const items = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: e.match(/<yt:videoId>([^<]+)/)[1],
    title: clean(decode(e.match(/<title>([\s\S]*?)<\/title>/)[1])),
    published: e.match(/<published>([^<]+)/)[1].slice(0, 10),
    views: +(e.match(/<media:statistics views="(\d+)"/)?.[1] ?? 0),
  }));
  if (!items.length) throw new Error(`${kind} feed: no videos`);
  const latest = newest(items);
  // The feed only has recent uploads, so keep last week's most viewed in the running with their old counts.
  const fresh = new Map(items.map(v => [v.id, v]));
  const pool = [...items, ...data[kind].popular.filter(v => !fresh.has(v.id))];
  return { latest, popular: mostViewed(pool, latest) };
}

async function fromApi(kind) {
  const api = (path, q) => get(`https://www.googleapis.com/youtube/v3/${path}?key=${KEY}&${q}`, `${kind} api`).then(r => r.json());
  const ids = [];
  let page = "";
  do {
    const r = await api("playlistItems", `part=contentDetails&maxResults=50&playlistId=${PLAYLIST[kind]}${page && "&pageToken=" + page}`);
    ids.push(...r.items.map(i => i.contentDetails.videoId));
    page = r.nextPageToken;
  } while (page);
  const all = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await api("videos", `part=snippet,statistics&id=${ids.slice(i, i + 50).join(",")}`);
    all.push(...r.items.map(v => ({ id: v.id, title: clean(v.snippet.title), published: v.snippet.publishedAt.slice(0, 10), views: +v.statistics.viewCount || 0 })));
  }
  if (!all.length) throw new Error(`${kind} api: no videos`);
  const latest = newest(all);
  return { latest, popular: mostViewed(all, latest) };
}

// Channel totals for partners.html. Only the API has them, so without a key last week's numbers stay.
async function stats() {
  if (!KEY) throw new Error("needs YOUTUBE_API_KEY");
  const r = await (await get(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${CHANNEL_ID}&key=${KEY}`, "stats")).json();
  const c = r.items[0];
  return { views: +c.statistics.viewCount, videos: +c.statistics.videoCount, since: c.snippet.publishedAt.slice(0, 4) };
}

async function logo() {
  const html = await (await get(CHANNEL_URL, "channel page")).text();
  const url = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  if (!url) throw new Error("logo: no og:image on channel page");
  const img = await get(url.replace(/=s\d+/, "=s176"), "logo");
  await writeFile(LOGO_FILE, Buffer.from(await img.arrayBuffer()));
  return LOGO_FILE;
}

async function videos(kind) {
  if (KEY) try { return await fromApi(kind); } catch (e) { console.warn(`api failed, using feed: ${e.message}`); }
  return fromFeed(kind);
}

if (!process.argv.includes("--render")) {
  // A part that fails keeps last week's data, so the page never goes empty.
  for (const [key, job] of [["videos", () => videos("videos")], ["shorts", () => videos("shorts")], ["stats", stats], ["logo", logo]]) {
    try { data[key] = await job(); } catch (e) { console.warn(`kept old ${key}: ${e.message}`); }
  }
  await writeFile("youtube.json", JSON.stringify(data, null, 2) + "\n");
}

const views = n => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} views`;
const card = (v, short) => `<a class="vid${short ? " short" : ""}" href="https://www.youtube.com/${short ? "shorts/" : "watch?v="}${v.id}">` +
  `<img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" loading="lazy"><b>${esc(v.title)}</b>` +
  `<span>${views(v.views)} · ${v.published}</span></a>`;
const row = (head, list, short) => `<h3 class="ythead">${head}</h3>\n` +
  `<div class="vids${short ? " shorts" : ""}">${list.map(v => card(v, short)).join("")}</div>`;
const block = `<!-- youtube:start - written by tools/update-youtube.mjs, do not edit by hand -->
<div class="panel yt"><img class="ytlogo" src="${esc(data.logo)}" alt="Eek On Road"><div>
<h3>Eek On Road: Tech in Motion</h3><p>From road trips to events and everything in between, we're all about discovering what's out there and sharing it with you. Expect nice clean visuals, honest impressions and a passion for cars and cool tech. Subscribe and follow the journey!</p>
<a class="btn red" href="${CHANNEL_URL}?sub_confirmation=1">Subscribe on YouTube</a></div></div>
${row("Latest videos", data.videos.latest, false)}
${row("Most watched videos", data.videos.popular, false)}
${row("Latest shorts", data.shorts.latest, true)}
${row("Most watched shorts", data.shorts.popular, true)}
<!-- youtube:end -->`;

const page = await readFile("index.html", "utf8");
if (!/<!-- youtube:start[\s\S]*?<!-- youtube:end -->/.test(page)) throw new Error("youtube markers missing in index.html");
await writeFile("index.html", page.replace(/<!-- youtube:start[\s\S]*?<!-- youtube:end -->/, () => block));
const topShort = [...data.shorts.latest, ...data.shorts.popular].sort((a, b) => b.views - a.views)[0];
const topVideo = [...data.videos.latest, ...data.videos.popular].sort((a, b) => b.views - a.views)[0];
const stat = (n, label) => `<div class="panel stat"><b>${n}</b><span>${label}</span></div>`;
const statsBlock = `<!-- stats:start - written by tools/update-youtube.mjs, do not edit by hand -->
<div class="stats">${stat(views(data.stats.views).replace(" views", ""), "views on YouTube")}${stat(data.stats.videos, "videos and shorts")}` +
  `${stat(views(topVideo.views).replace(" views", ""), "views on our most watched video")}${stat(views(topShort.views).replace(" views", ""), "views on our most watched short")}</div>
<p class="lead">Filmed in Sweden since ${data.stats.since}, in English for viewers all over the world. Our viewers come for electric cars,
road trips and tech - and for honest impressions.</p>
<!-- stats:end -->`;
const partners = await readFile("partners.html", "utf8");
if (!/<!-- stats:start[\s\S]*?<!-- stats:end -->/.test(partners)) throw new Error("stats markers missing in partners.html");
await writeFile("partners.html", partners.replace(/<!-- stats:start[\s\S]*?<!-- stats:end -->/, () => statsBlock));
const ids = l => l.map(v => v.id).join(",");
console.log(`videos new ${ids(data.videos.latest)} top ${ids(data.videos.popular)} | shorts new ${ids(data.shorts.latest)} top ${ids(data.shorts.popular)} | logo ${data.logo}`);
