/* ============================================================
   Sam3360 — portfolio logic
   Everything here is fetched live from the GitHub REST API.
   Nothing about repos, stars, followers, or languages is
   hardcoded — only the fallback copy shown while loading /
   if a request fails.
   ============================================================ */

const GH_USER = "Sam3360";
const API = "https://api.github.com";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour, keeps us well under the
                                       // unauthenticated 60 req/hr limit

/* ---------- tiny cache helper (localStorage) ---------- */

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch { return null; }
}

function cacheSet(key, v) {
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); }
  catch { /* storage disabled — fine, just skip caching */ }
}

async function ghFetch(path) {
  const cacheKey = "gh:" + path;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await fetch(API + path, {
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} on ${path}`);
  }
  const data = await res.json();
  cacheSet(cacheKey, data);
  return data;
}

/* ---------- age, live, increments every Feb 6 ---------- */

function renderAge() {
  const DOB = new Date(2012, 1, 6); // Feb 6, 2012 — month is 0-indexed
  const now = new Date();
  let age = now.getFullYear() - DOB.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > DOB.getMonth() ||
    (now.getMonth() === DOB.getMonth() && now.getDate() >= DOB.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  document.getElementById("age-value").textContent = age;
}

/* ---------- about pane ---------- */

function renderBio(user) {
  const bioEl = document.getElementById("bio-text");
  const sourceEl = document.getElementById("bio-source");
  if (user.bio && user.bio.trim()) {
    bioEl.textContent = user.bio;
  } else {
    bioEl.textContent =
      "A student developer who builds small, playful tools — retro-styled interfaces, lightweight GUI libraries, and note-taking apps.";
  }
  sourceEl.textContent = `pulled live from github.com/${GH_USER}`;
  if (user.avatar_url) {
    document.getElementById("avatar").src = user.avatar_url;
  }
}

/* ---------- stats pane ---------- */

function formatJoinDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

function renderStats(user, totalStars) {
  const grid = document.getElementById("stat-grid");
  const stats = [
    { num: user.public_repos, lbl: "public repos" },
    { num: user.followers, lbl: "followers" },
    { num: user.following, lbl: "following" },
    { num: totalStars, lbl: "total stars" },
    { num: formatJoinDate(user.created_at), lbl: "on github since" }
  ];
  grid.innerHTML = stats
    .map(s => `<div class="stat"><span class="num">${s.num}</span><span class="lbl">${s.lbl}</span></div>`)
    .join("");
}

/* ---------- language breakdown (by primary language per repo) ---------- */

const LANG_COLORS = {
  JavaScript: "#E8A33D", Python: "#5FD4C4", HTML: "#E5675F",
  CSS: "#8B93A3", TypeScript: "#5FA8D4", Java: "#D4A85F",
  "C++": "#C77DD4", C: "#7DD4A0", Shell: "#D4D45F", PHP: "#9F8BE0",
  Go: "#5FD4C4", Rust: "#E8A33D"
};
function langColor(name) {
  return LANG_COLORS[name] || "#5A6272";
}

function renderLanguages(repos) {
  const counts = {};
  repos.forEach(r => {
    if (!r.language) return;
    counts[r.language] = (counts[r.language] || 0) + 1;
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const list = document.getElementById("lang-list");
  if (!rows.length) {
    list.innerHTML = `<p class="repo-note">No language data available yet.</p>`;
    return;
  }
  list.innerHTML = rows
    .map(([name, count]) => {
      const pct = Math.round((count / total) * 100);
      return `
        <div class="lang-row">
          <span class="lname"><span class="repo-lang-dot" style="background:${langColor(name)}"></span>${name}</span>
          <span class="track"><span class="fill" style="width:${pct}%; background:${langColor(name)}"></span></span>
          <span class="pct">${pct}%</span>
        </div>`;
    })
    .join("");
}

/* ---------- top repos, ranked by real traffic views ---------- */

async function loadTrafficData() {
  try {
    const res = await fetch("./data/traffic.json", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json(); // expected: { "repo-name": { views, uniques, updated_at }, ... }
  } catch {
    return null;
  }
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function repoCard(repo, metricLabel, metricValue) {
  const dot = repo.language
    ? `<span class="repo-lang-dot" style="background:${langColor(repo.language)}"></span>${repo.language}`
    : "unlabeled";
  return `
    <a class="repo-card" href="${repo.html_url}" target="_blank" rel="noopener" style="cursor:pointer">
      <div class="repo-top">
        <span class="repo-name">${repo.name}</span>
        <span class="repo-metrics">
          <span title="${metricLabel}">👁 ${metricValue}</span>
          <span title="stars">★ ${repo.stargazers_count}</span>
        </span>
      </div>
      <p class="repo-desc">${repo.description ? repo.description : "No description yet."}</p>
      <div class="repo-meta">
        <span>${dot}</span>
        <span>updated ${timeAgo(repo.pushed_at)}</span>
      </div>
    </a>`;
}

async function renderTopRepos(repos) {
  const listEl = document.getElementById("repo-list");
  const noteEl = document.getElementById("repo-note");
  const traffic = await loadTrafficData();

  let ranked, metricLabel;

  if (traffic && Object.keys(traffic).length) {
    ranked = repos
      .filter(r => traffic[r.name])
      .map(r => ({ repo: r, value: traffic[r.name].views || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    metricLabel = "views (30d)";
    noteEl.textContent = "Ranked by real GitHub traffic views, synced daily by a GitHub Action.";
    noteEl.classList.add("live");
  } else {
    // First-run fallback, before the daily Action has produced any data yet.
    // Deliberately NOT stars/forks — sorted by recent activity instead.
    ranked = repos
      .slice()
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
      .slice(0, 6)
      .map(r => ({ repo: r, value: timeAgo(r.pushed_at) }));
    metricLabel = "last activity";
    noteEl.textContent =
      "View-based ranking populates after the traffic sync workflow runs (see README) — showing most recently active repos for now.";
  }

  if (!ranked.length) {
    listEl.innerHTML = `<div class="repo-card">No repositories to show yet.</div>`;
    return;
  }

  listEl.innerHTML = ranked
    .map(({ repo, value }) => repoCard(repo, metricLabel, typeof value === "number" ? value : "—"))
    .join("");
}

/* ---------- boot ---------- */

async function init() {
  renderAge();
  const statusEl = document.getElementById("api-status");

  try {
    const [user, repos] = await Promise.all([
      ghFetch(`/users/${GH_USER}`),
      ghFetch(`/users/${GH_USER}/repos?per_page=100&sort=updated`)
    ]);

    renderBio(user);

    const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    renderStats(user, totalStars);
    renderLanguages(repos.filter(r => !r.fork));
    await renderTopRepos(repos.filter(r => !r.fork));

    statusEl.textContent = "synced with github";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "sync failed — see below";
    const main = document.querySelector("main");
    const notice = document.createElement("div");
    notice.className = "error-note";
    notice.style.marginBottom = "32px";
    notice.textContent =
      "Couldn't reach the GitHub API right now (rate limit or network issue). Refresh in a bit — nothing on this page is hardcoded, so it'll pick back up automatically.";
    main.insertBefore(notice, main.firstChild);
  }
}

init();
