/*
  Indexing Center — auto-add .category when new Are.na channels are added

  Requirements (per user):
  - Keep existing design/HTML/CSS structure (.top, .bottom, .main) exactly as-is.
  - Do NOT render channel contents anywhere.
  - Only: when a new channel is added to https://www.are.na/indexing-center/indexing-center,
          add a new .category element (or fill an empty one) in the .top section.

  Notes:
  - Uses Are.na API v2: /v2/channels/:slug/contents
  - If the parent channel is private/collab-only, set ARENA_TOKEN.
*/

const ARENA_PARENT_URL = "https://www.are.na/indexing-center/indexing-center";
const ARENA_TOKEN = ""; // Optional token for private/collab content

const PER_PAGE = 100;
const POLL_MS = 30_000;

function slugFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1];
  } catch {
    return String(url).trim();
  }
}

async function arenaFetch(path, params = {}) {
  const base = "https://api.are.na/v2";
  const sp = new URLSearchParams(params);
  const url = `${base}${path}?${sp.toString()}`;
  const headers = {};
  if (ARENA_TOKEN) headers["Authorization"] = `Bearer ${ARENA_TOKEN}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Are.na ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

async function fetchChildChannels(parentSlug) {
  // Fetch all pages to avoid missing older items (still light enough at 100/page).
  let page = 1;
  const out = [];
  while (true) {
    const data = await arenaFetch(`/channels/${parentSlug}/contents`, { per: PER_PAGE, page });
    const chans = (data.contents || []).filter(b => b.class === "Channel");

    for (const ch of chans) {
      out.push({
        id: ch.id,
        slug: ch.slug,
        title: ch.title || "",
      });
    }

    if (!data.contents || data.contents.length < PER_PAGE) break;
    page += 1;
  }
  return out;
}

function ensureCategoryEl(topEl, existingEls, index) {
  // Prefer reusing existing .category placeholders from index.html
  if (index < existingEls.length) return existingEls[index];

  const div = document.createElement("div");
  div.className = "category";
  topEl.appendChild(div);
  return div;
}

function setCategoryTitle(catEl, title) {
  catEl.textContent = title;
}

function isEmptyCategory(catEl) {
  return catEl.textContent.trim() === "";
}

function fillOrAppendCategory(topEl, channel, knownIds) {
  // 1) Try to fill an empty placeholder first
  const existing = Array.from(topEl.querySelectorAll(".category"));
  const empty = existing.find(isEmptyCategory);

  const target = empty || ensureCategoryEl(topEl, existing, existing.length);

  setCategoryTitle(target, channel.title);
  // Store metadata (doesn't affect design)
  target.dataset.arenaChannelId = String(channel.id);
  if (channel.slug) target.dataset.arenaChannelSlug = channel.slug;

  knownIds.add(channel.id);
}

async function bootstrap() {
  const topEl = document.querySelector(".top");
  if (!topEl) return;

  const parentSlug = slugFromUrl(ARENA_PARENT_URL);

  // Track which channel IDs we've already rendered into .category
  const knownIds = new Set();

  // Initial paint: map existing categories to current child channels (in order)
  try {
    const channels = await fetchChildChannels(parentSlug);

    const existingCats = Array.from(topEl.querySelectorAll(".category"));

    // Fill sequentially into existing placeholders first
    channels.forEach((ch, i) => {
      const el = ensureCategoryEl(topEl, existingCats, i);
      setCategoryTitle(el, ch.title);
      el.dataset.arenaChannelId = String(ch.id);
      if (ch.slug) el.dataset.arenaChannelSlug = ch.slug;
      knownIds.add(ch.id);
    });
  } catch (e) {
    console.error("Initial Are.na fetch failed:", e);
  }

  // Poll: when new channels appear, add new .category (or fill an empty placeholder)
  setInterval(async () => {
    try {
      const channels = await fetchChildChannels(parentSlug);

      // Identify channels that are not yet present
      const newOnes = channels.filter(ch => !knownIds.has(ch.id));
      if (!newOnes.length) return;

      // Add them in the order they appear from Are.na
      for (const ch of newOnes) {
        fillOrAppendCategory(topEl, ch, knownIds);
      }
    } catch (e) {
      console.error("Poll Are.na fetch failed:", e);
    }
  }, POLL_MS);
}

document.addEventListener("DOMContentLoaded", bootstrap);
