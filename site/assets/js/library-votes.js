// Fills like counts, comment counts, stage and links for every element with data-story="<id>".
// It shows data/votes.json first, then tries one live read of the public GitHub API and shows that if it works.

import { LABELS, computeVotes, findIssueForStory, normalizeIssues } from "../../tools/library-rules.mjs";

export const REPOSITORY = "Hantok/cargo-passport";

const VOTES_URL = new URL("../../data/votes.json", import.meta.url);
const ISSUES_API = `https://api.github.com/repos/${REPOSITORY}/issues`;
const ISSUE_LIST_URL = `https://github.com/${REPOSITORY}/issues?q=${encodeURIComponent(`is:issue label:${LABELS.story.name}`)}`;
const CACHE_KEY = "library-votes-live";
const CACHE_MS = 10 * 60 * 1000;
const STAGE_TEXT = {
  proposed: "Waiting for a like",
  eligible: "Has a like, can be developed",
  researching: "Next to develop",
  published: "Published",
};

async function loadSnapshot() {
  try {
    const response = await fetch(VOTES_URL);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function readCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    return cached && Date.now() - cached.at < CACHE_MS ? cached.votes : null;
  } catch {
    return null;
  }
}

function writeCache(votes) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), votes }));
  } catch {
    // Storage can be blocked; the page then asks GitHub again on the next visit.
  }
}

async function fetchIssues(label) {
  const response = await fetch(`${ISSUES_API}?labels=${label}&state=all&per_page=100`, { headers: { accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  return response.json();
}

async function liveVotes(snapshot) {
  const lists = await Promise.all([LABELS.story.name, LABELS.proposal.name].map(fetchIssues));
  const issues = normalizeIssues([...new Map(lists.flat().map((issue) => [issue.number, issue])).values()]);
  const stories = Object.entries(snapshot.stories).map(([id, entry]) => ({
    id,
    state: entry.stage === "published" ? "published" : "proposed",
    issue: entry.issue ?? findIssueForStory(issues, id)?.number ?? null,
  }));
  return computeVotes({ stories, issues, repository: REPOSITORY, generatedAt: new Date().toISOString() });
}

async function refresh(snapshot) {
  const cached = readCache();
  if (cached) return cached;
  try {
    const votes = await liveVotes(snapshot);
    writeCache(votes);
    return votes;
  } catch {
    return snapshot;
  }
}

function show(votes) {
  for (const root of document.querySelectorAll("[data-story]")) {
    const entry = votes.stories[root.dataset.story];
    const href = entry?.url ?? ISSUE_LIST_URL;
    for (const link of root.querySelectorAll("a[data-like], a[data-discuss]")) link.href = href;
    if (!entry) continue;
    root.dataset.eligible = String(entry.eligible);
    for (const node of root.querySelectorAll("[data-likes]")) node.textContent = String(entry.likes);
    for (const node of root.querySelectorAll("[data-comments]")) node.textContent = String(entry.comments);
    for (const node of root.querySelectorAll("[data-stage]")) {
      node.dataset.stage = entry.stage;
      node.textContent = STAGE_TEXT[entry.stage];
    }
  }
}

async function init() {
  const snapshot = await loadSnapshot();
  if (!snapshot) {
    show({ stories: {} });
    return;
  }
  show(snapshot);
  show(await refresh(snapshot));
}

init();
