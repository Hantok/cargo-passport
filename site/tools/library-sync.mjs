import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { LABELS, computeVotes, findIssueForStory, nextIssueNumber, normalizeIssues, sameVotes, storyIssueText } from './library-rules.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const STORIES_PATH = `${REPO_ROOT}data/stories.json`;
const VOTES_PATH = `${REPO_ROOT}data/votes.json`;
const REPOSITORY_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const STORY_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STATES = ['published', 'proposed'];
const EVIDENCE_STATUSES = ['data', 'partial', 'hypothesis'];
const PAGE_SIZE = 100;

function parseStories(text) {
  const stories = JSON.parse(text);
  if (!Array.isArray(stories)) throw new Error('data/stories.json must be an array');
  const seen = new Set();
  for (const story of stories) {
    if (!STORY_ID_PATTERN.test(story.id ?? '')) throw new Error(`Story id "${story.id}" is not lower-case words joined by hyphens`);
    if (seen.has(story.id)) throw new Error(`Story id "${story.id}" appears twice`);
    seen.add(story.id);
    for (const field of ['title', 'premise', 'status_reason']) {
      if (typeof story[field] !== 'string' || story[field] === '') throw new Error(`Story "${story.id}" has no "${field}"`);
    }
    if (!STATES.includes(story.state)) throw new Error(`Story "${story.id}" has state "${story.state}"`);
    if (!EVIDENCE_STATUSES.includes(story.evidence_status)) throw new Error(`Story "${story.id}" has evidence_status "${story.evidence_status}"`);
    if (story.issue !== null && !Number.isInteger(story.issue)) throw new Error(`Story "${story.id}" has issue "${story.issue}"`);
  }
  return stories;
}

function githubClient({ repository, token, fetchImpl }) {
  const headers = {
    accept: 'application/vnd.github+json',
    'content-type': 'application/json',
    'user-agent': 'library-sync',
    'x-github-api-version': '2022-11-28',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };

  async function request(method, path, body) {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`GitHub API ${method} ${path} failed with ${response.status}: ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  }

  async function list(path) {
    const rows = [];
    const joiner = path.includes('?') ? '&' : '?';
    for (let page = 1; ; page += 1) {
      const batch = await request('GET', `${path}${joiner}per_page=${PAGE_SIZE}&page=${page}`);
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) return rows;
    }
  }

  return { request, list };
}

async function readIssues(client, stories) {
  const byLabel = await Promise.all(
    [LABELS.story.name, LABELS.proposal.name].map((label) => client.list(`/issues?labels=${label}&state=all`)),
  );
  const raw = new Map(byLabel.flat().map((issue) => [issue.number, issue]));
  for (const story of stories) {
    if (story.issue !== null && !raw.has(story.issue)) raw.set(story.issue, await client.request('GET', `/issues/${story.issue}`));
  }
  return normalizeIssues([...raw.values()]);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Runs one sync. With dryRun it reads from GitHub, writes nothing, and logs what it would do.
 * Returns the votes it computed.
 */
export async function runSync({ repository, token, fetchImpl = fetch, now, dryRun = false, log = console.log, storiesPath = STORIES_PATH, votesPath = VOTES_PATH }) {
  if (!REPOSITORY_PATTERN.test(repository ?? '')) throw new Error(`Repository "${repository}" is not in the form owner/name`);
  if (!token && !dryRun) throw new Error('GITHUB_TOKEN is not set');
  if (Number.isNaN(Date.parse(now))) throw new Error(`Time "${now}" is not a valid date`);
  const generatedAt = new Date(now).toISOString();

  const client = githubClient({ repository, token, fetchImpl });
  const say = (message) => log(dryRun ? `would ${message}` : message);
  const act = async (message, action) => {
    say(message);
    return dryRun ? null : action();
  };

  const stories = parseStories(await readFile(storiesPath, 'utf8'));

  const labels = new Set((await client.list('/labels')).map((label) => label.name));
  for (const label of Object.values(LABELS).filter(({ name }) => !labels.has(name))) {
    await act(`create label ${label.name}`, () => client.request('POST', '/labels', label));
  }

  const issues = await readIssues(client, stories);
  let storiesChanged = false;
  for (const story of stories.filter(({ issue }) => issue === null)) {
    const existing = findIssueForStory(issues, story.id);
    if (existing) {
      say(`link story ${story.id} to existing issue #${existing.number}`);
      story.issue = existing.number;
    } else {
      const created = await act(`create issue for story ${story.id}`, () => client.request('POST', '/issues', storyIssueText(story)));
      if (created) {
        issues.push(...normalizeIssues([created]));
        story.issue = created.number;
      }
    }
    storiesChanged ||= story.issue !== null;
  }
  if (storiesChanged && !dryRun) await writeFile(storiesPath, toJson(stories));

  const votes = computeVotes({ stories, issues, repository, generatedAt });
  const previous = await readJson(votesPath);
  if (previous && sameVotes(previous, votes)) {
    log('data/votes.json is up to date');
  } else {
    await act('write data/votes.json', () => writeFile(votesPath, toJson(votes)));
  }

  await syncNextLabel(client, act, nextIssueNumber(votes));
  return votes;
}

async function syncNextLabel(client, act, chosen) {
  const holders = normalizeIssues(await client.list(`/issues?labels=${LABELS.next.name}&state=all`)).map((issue) => issue.number);
  for (const number of holders.filter((holder) => holder !== chosen)) {
    await act(`remove label ${LABELS.next.name} from #${number}`, () => client.request('DELETE', `/issues/${number}/labels/${LABELS.next.name}`));
  }
  if (chosen !== null && !holders.includes(chosen)) {
    await act(`add label ${LABELS.next.name} to #${chosen}`, () => client.request('POST', `/issues/${chosen}/labels`, { labels: [LABELS.next.name] }));
  }
}

async function main() {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean' }, now: { type: 'string' } } });
  const votes = await runSync({
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
    now: values.now ?? process.env.LIBRARY_SYNC_NOW ?? new Date().toISOString(),
    dryRun: values['dry-run'],
  });
  console.log(`next: ${votes.next ?? 'none'}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
