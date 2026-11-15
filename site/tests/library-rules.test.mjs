import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  chooseNext, computeVotes, findIssueForStory, markerStoryId, nextIssueNumber, normalizeIssues, proposalToStory, storyIssueText, storyMarker,
} from '../tools/library-rules.mjs';
import { runSync } from '../tools/library-sync.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPOSITORY = 'owner/name';
const NOW = '2026-11-15T12:00:00.000Z';
const LATER = '2026-11-15T13:00:00.000Z';

const story = (id, overrides = {}) => ({
  id,
  title: `Title of ${id}`,
  premise: `Premise of ${id}.`,
  evidence_status: 'partial',
  status_reason: `Reason for ${id}.`,
  state: 'proposed',
  basis: [],
  gaps: [],
  issue: null,
  ...overrides,
});

const rawIssue = (number, { labels = ['story'], likes = 0, comments = 0, body = '', state = 'open', title = `Issue ${number}` } = {}) => ({
  number,
  html_url: `https://github.com/${REPOSITORY}/issues/${number}`,
  title,
  body,
  state,
  created_at: `2026-11-0${(number % 9) + 1}T00:00:00Z`,
  labels: labels.map((name) => ({ name })),
  reactions: { '+1': likes, '-1': 0, total_count: likes },
  comments,
});

const votesFor = (stories, rawIssues) =>
  computeVotes({ stories, issues: normalizeIssues(rawIssues), repository: REPOSITORY, generatedAt: NOW });

describe('eligibility', () => {
  it('needs one like: zero likes waits, one like is eligible', () => {
    const votes = votesFor(
      [story('a', { issue: 1 }), story('b', { issue: 2 })],
      [rawIssue(1, { likes: 0 }), rawIssue(2, { likes: 1 })],
    );
    assert.equal(votes.stories.a.eligible, false);
    assert.equal(votes.stories.a.stage, 'proposed');
    assert.equal(votes.stories.b.eligible, true);
  });

  it('counts comments and reads the likes of the thumbs-up reaction only', () => {
    const issue = { ...rawIssue(1, { likes: 2, comments: 5 }), reactions: { '+1': 2, heart: 9, total_count: 11 } };
    const votes = votesFor([story('a', { issue: 1 })], [issue]);
    assert.deepEqual([votes.stories.a.likes, votes.stories.a.comments], [2, 5]);
  });

  it('reports a story without an issue as zero likes, not eligible, and no link', () => {
    const votes = votesFor([story('a')], []);
    assert.deepEqual(votes.stories.a, { issue: null, url: null, likes: 0, comments: 0, eligible: false, stage: 'proposed' });
    assert.equal(votes.next, null);
  });
});

describe('the next direction', () => {
  const stories = [story('low', { issue: 5 }), story('high-new', { issue: 9 }), story('high-old', { issue: 7 })];

  it('picks the most liked, and the oldest issue when likes tie', () => {
    const votes = votesFor(stories, [rawIssue(5, { likes: 2 }), rawIssue(9, { likes: 3 }), rawIssue(7, { likes: 3 })]);
    assert.equal(votes.next, 'high-old');
    assert.deepEqual(
      [votes.stories['high-old'].stage, votes.stories['high-new'].stage, votes.stories.low.stage],
      ['researching', 'eligible', 'eligible'],
    );
    assert.equal(nextIssueNumber(votes), 7);
  });

  it('picks nothing when no story has a like', () => {
    const votes = votesFor(stories, [rawIssue(5), rawIssue(9), rawIssue(7)]);
    assert.equal(votes.next, null);
    assert.equal(nextIssueNumber(votes), null);
  });

  it('never picks a published story, however many likes it has', () => {
    const withPublished = [story('done', { issue: 1, state: 'published' }), story('open', { issue: 2 })];
    const votes = votesFor(withPublished, [rawIssue(1, { likes: 10 }), rawIssue(2, { likes: 1 })]);
    assert.equal(votes.next, 'open');
    assert.equal(votes.stories.done.stage, 'published');
    assert.equal(votes.stories.done.eligible, true);
  });

  it('picks nothing when only a published story has likes', () => {
    const votes = votesFor([story('done', { issue: 1, state: 'published' })], [rawIssue(1, { likes: 4 })]);
    assert.equal(votes.next, null);
  });

  it('chooses from plain candidates in the same way', () => {
    const candidates = [
      { id: 'a', issue: 3, likes: 1, state: 'proposed' },
      { id: 'b', issue: 2, likes: 1, state: 'proposed' },
      { id: 'c', issue: 1, likes: 0, state: 'proposed' },
    ];
    assert.equal(chooseNext(candidates), 'b');
    assert.equal(chooseNext([]), null);
  });
});

describe('reader proposals', () => {
  const formBody = [
    '### The question', '', 'Can a spark travel through a sealed bag?', '',
    '### Why it matters', '', 'Bags are everywhere in cargo.', '',
    '### What you would like to see', '', 'A short story with a diagram.', '',
    '### Any source you know (optional)', '', '_No response_',
  ].join('\n');

  it('turns the issue form into a proposed hypothesis entry', () => {
    const entry = proposalToStory(normalizeIssues([rawIssue(12, { labels: ['story-proposal'], title: 'Proposal: Sparks in bags', body: formBody })])[0]);
    assert.equal(entry.id, 'proposal-12');
    assert.equal(entry.title, 'Sparks in bags');
    assert.equal(entry.premise, 'Can a spark travel through a sealed bag?');
    assert.equal(entry.evidence_status, 'hypothesis');
    assert.equal(entry.state, 'proposed');
    assert.equal(entry.issue, 12);
    assert.deepEqual(entry.basis, []);
    assert.equal(entry.gaps.length, 1);
  });

  it('records a source named by the reader as unchecked', () => {
    const body = formBody.replace('_No response_', 'https://example.org/paper');
    const entry = proposalToStory(normalizeIssues([rawIssue(12, { labels: ['story-proposal'], body })])[0]);
    assert.match(entry.gaps[1], /not yet checked: https:\/\/example\.org\/paper$/);
  });

  it('lists open proposals, skips closed ones and ones already turned into a story', () => {
    const votes = votesFor([story('promoted', { issue: 20 })], [
      rawIssue(20, { labels: ['story-proposal'] }),
      rawIssue(21, { labels: ['story-proposal'], title: 'Proposal: Open one' }),
      rawIssue(22, { labels: ['story-proposal'], state: 'closed' }),
    ]);
    assert.deepEqual(votes.proposals.map((p) => p.issue), [21]);
    assert.equal(votes.proposals[0].title, 'Open one');
  });

  it('can be the next direction once it has a like', () => {
    const votes = votesFor([story('a', { issue: 1 })], [rawIssue(1, { likes: 1 }), rawIssue(30, { labels: ['story-proposal'], likes: 3 })]);
    assert.equal(votes.next, 'proposal-30');
    assert.equal(nextIssueNumber(votes), 30);
    assert.equal(votes.proposals[0].eligible, true);
  });
});

describe('duplicate-issue protection', () => {
  it('writes a hidden marker into the issue body and reads it back', () => {
    const { body, labels } = storyIssueText(story('quiet-fire'));
    assert.ok(body.startsWith('<!-- cargo-passport-story:quiet-fire -->'));
    assert.equal(markerStoryId(body), 'quiet-fire');
    assert.deepEqual(labels, ['story']);
  });

  it('puts the premise, the evidence status and the voting rule in the body', () => {
    const { body } = storyIssueText(story('a', { evidence_status: 'hypothesis' }));
    assert.match(body, /Premise of a\./);
    assert.match(body, /\*\*Evidence status:\*\* A hypothesis: not yet backed by data\. Reason for a\./);
    assert.match(body, /thumbs-up reaction/);
  });

  it('finds an existing issue by marker, closed or open', () => {
    const issues = normalizeIssues([
      rawIssue(3, { body: `${storyMarker('other')}\ntext` }),
      rawIssue(4, { body: `${storyMarker('quiet-fire')}\ntext`, state: 'closed' }),
    ]);
    assert.equal(findIssueForStory(issues, 'quiet-fire').number, 4);
    assert.equal(findIssueForStory(issues, 'missing'), null);
  });

  it('ignores a reader proposal that copies a marker', () => {
    const issues = normalizeIssues([rawIssue(8, { labels: ['story-proposal'], body: storyMarker('quiet-fire') })]);
    assert.equal(findIssueForStory(issues, 'quiet-fire'), null);
  });
});

describe('boundary checks', () => {
  it('drops pull requests from the issue list', () => {
    assert.deepEqual(normalizeIssues([{ ...rawIssue(1), pull_request: {} }, rawIssue(2)]).map((i) => i.number), [2]);
  });

  it('fails loudly when an issue has no reaction counts', () => {
    const { reactions, ...withoutReactions } = rawIssue(1);
    assert.throws(() => normalizeIssues([withoutReactions]), /Issue #1 has no "\+1" reaction count/);
  });

  it('fails loudly when a story points at an issue that was not read', () => {
    assert.throws(() => votesFor([story('a', { issue: 99 })], []), /Story "a" points at issue #99/);
  });
});

function fakeGitHub({ labels = [], issues = [] } = {}) {
  const state = { labels: labels.map((name) => ({ name })), issues: [...issues], calls: [] };
  const reply = (status, payload) => ({ ok: status < 400, status, json: async () => payload, text: async () => JSON.stringify(payload) });
  const fetchImpl = async (url, { method = 'GET', body } = {}) => {
    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace(`/repos/${REPOSITORY}`, '');
    state.calls.push(`${method} ${path}`);
    const data = body === undefined ? undefined : JSON.parse(body);
    const hasLabel = (issue, name) => issue.labels.some((label) => label.name === name);
    const find = (number) => state.issues.find((issue) => issue.number === Number(number));

    if (method === 'GET' && path === '/labels') return reply(200, state.labels);
    if (method === 'POST' && path === '/labels') return reply(201, state.labels.push({ name: data.name }) && data);
    if (method === 'GET' && path === '/issues') {
      const page = Number(searchParams.get('page'));
      const size = Number(searchParams.get('per_page'));
      const rows = state.issues.filter((issue) => hasLabel(issue, searchParams.get('labels')));
      return reply(200, rows.slice((page - 1) * size, page * size));
    }
    if (method === 'POST' && path === '/issues') {
      const issue = rawIssue(state.issues.length + 1, { labels: data.labels, body: data.body, title: data.title });
      state.issues.push(issue);
      return reply(201, issue);
    }
    const labelsRoute = /^\/issues\/(\d+)\/labels(?:\/([\w-]+))?$/.exec(path);
    if (labelsRoute && method === 'POST') {
      find(labelsRoute[1]).labels.push(...data.labels.map((name) => ({ name })));
      return reply(200, []);
    }
    if (labelsRoute && method === 'DELETE') {
      const issue = find(labelsRoute[1]);
      issue.labels = issue.labels.filter((label) => label.name !== labelsRoute[2]);
      return reply(204, null);
    }
    return reply(404, { message: `no route for ${method} ${path}` });
  };
  const writes = () => state.calls.filter((call) => !call.startsWith('GET '));
  return { state, fetchImpl, writes };
}

describe('library-sync', () => {
  let dir;
  let storiesPath;
  let votesPath;
  const lines = [];
  const options = (github, extra = {}) => ({
    repository: REPOSITORY, token: 'token', fetchImpl: github.fetchImpl, now: NOW, log: (line) => lines.push(line), storiesPath, votesPath, ...extra,
  });
  const readStories = async () => JSON.parse(await readFile(storiesPath, 'utf8'));
  const readVotes = async () => JSON.parse(await readFile(votesPath, 'utf8'));

  before(async () => { dir = await mkdtemp(join(tmpdir(), 'library-sync-')); });
  after(() => rm(dir, { recursive: true, force: true }));
  const resetFiles = async () => {
    lines.length = 0;
    storiesPath = join(dir, 'stories.json');
    votesPath = join(dir, 'votes.json');
    await rm(votesPath, { force: true });
    await writeFile(storiesPath, `${JSON.stringify([story('a'), story('b', { state: 'published' })], null, 2)}\n`);
  };

  it('in --dry-run reads from GitHub, changes nothing and says what it would do', async () => {
    await resetFiles();
    const before = await readFile(storiesPath, 'utf8');
    const github = fakeGitHub();
    await runSync(options(github, { dryRun: true }));
    assert.deepEqual(github.writes(), []);
    assert.equal(await readFile(storiesPath, 'utf8'), before);
    await assert.rejects(readFile(votesPath), { code: 'ENOENT' });
    assert.ok(lines.includes('would create label story'));
    assert.ok(lines.includes('would create issue for story a'));
    assert.ok(lines.includes('would create issue for story b'));
    assert.ok(lines.includes('would write data/votes.json'));
  });

  it('creates labels and one issue per story, writes the numbers back and writes the votes', async () => {
    await resetFiles();
    const github = fakeGitHub();
    await runSync(options(github));
    assert.deepEqual(github.state.labels.map((l) => l.name), ['story', 'story-proposal', 'next-up']);
    assert.equal(github.state.issues.length, 2);
    assert.deepEqual((await readStories()).map((s) => s.issue), [1, 2]);
    assert.equal(markerStoryId(github.state.issues[0].body), 'a');
    const votes = await readVotes();
    assert.equal(votes.generated_at, NOW);
    assert.equal(votes.repository, REPOSITORY);
    assert.equal(votes.stories.a.url, `https://github.com/${REPOSITORY}/issues/1`);
    assert.equal(votes.stories.b.stage, 'published');
    assert.equal(votes.next, null);
  });

  it('is idempotent: a second run creates nothing and leaves both files byte for byte as they were', async () => {
    await resetFiles();
    const github = fakeGitHub();
    await runSync(options(github));
    const [stories, votes] = await Promise.all([readFile(storiesPath, 'utf8'), readFile(votesPath, 'utf8')]);
    github.state.calls.length = 0;
    await runSync(options(github, { now: LATER }));
    assert.deepEqual(github.writes(), []);
    assert.equal(github.state.issues.length, 2);
    assert.equal(await readFile(storiesPath, 'utf8'), stories);
    assert.equal(await readFile(votesPath, 'utf8'), votes);
  });

  it('links a story to the issue that already carries its marker instead of creating a duplicate', async () => {
    await resetFiles();
    const survivor = rawIssue(40, { body: `${storyMarker('a')}\nleft by an earlier run` });
    const github = fakeGitHub({ labels: ['story', 'story-proposal', 'next-up'], issues: [survivor] });
    await runSync(options(github));
    assert.equal((await readStories())[0].issue, 40);
    assert.deepEqual(github.writes().filter((call) => call === 'POST /issues').length, 1);
    assert.equal(github.state.issues.filter((issue) => markerStoryId(issue.body) === 'a').length, 1);
  });

  it('follows the likes: updates the counts and moves the next-up label', async () => {
    await resetFiles();
    const github = fakeGitHub();
    await runSync(options(github));

    github.state.issues[0].reactions['+1'] = 1;
    await runSync(options(github, { now: LATER }));
    let votes = await readVotes();
    assert.equal(votes.generated_at, LATER);
    assert.deepEqual([votes.stories.a.likes, votes.stories.a.eligible, votes.stories.a.stage, votes.next], [1, true, 'researching', 'a']);
    assert.deepEqual(github.state.issues[0].labels.map((l) => l.name), ['story', 'next-up']);

    github.state.issues.push(rawIssue(3, { labels: ['story-proposal'], likes: 2, title: 'Proposal: New direction' }));
    await runSync(options(github, { now: LATER }));
    votes = await readVotes();
    assert.equal(votes.next, 'proposal-3');
    assert.deepEqual(votes.proposals.map((p) => [p.issue, p.title, p.likes]), [[3, 'New direction', 2]]);
    assert.deepEqual(github.state.issues[0].labels.map((l) => l.name), ['story']);
    assert.deepEqual(github.state.issues[2].labels.map((l) => l.name), ['story-proposal', 'next-up']);
  });

  it('fails on an API error', async () => {
    await resetFiles();
    const failing = async () => ({ ok: false, status: 500, text: async () => 'server error' });
    await assert.rejects(runSync(options({ fetchImpl: failing })), /GitHub API GET \/labels\?per_page=100&page=1 failed with 500: server error/);
  });

  it('refuses to write without a token', async () => {
    await resetFiles();
    await assert.rejects(runSync(options(fakeGitHub(), { token: undefined })), /GITHUB_TOKEN is not set/);
  });
});

describe('command line', () => {
  it('exits non-zero with a message when the repository is not set', async () => {
    const { GITHUB_REPOSITORY, NODE_TEST_CONTEXT, ...env } = process.env;
    const result = await new Promise((resolve) => {
      execFile(process.execPath, [`${REPO_ROOT}tools/library-sync.mjs`, '--dry-run'], { env }, (error, stdout, stderr) => resolve({ code: error?.code, stderr }));
    });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Repository "undefined" is not in the form owner\/name/);
  });
});

describe('assets/js/library-votes.js', () => {
  const issueListUrl = 'https://github.com/Hantok/cargo-passport/issues?q=is%3Aissue%20label%3Astory';
  const entry = (overrides = {}) => ({ issue: null, url: null, likes: 0, comments: 0, eligible: false, stage: 'proposed', ...overrides });
  const snapshot = {
    generated_at: NOW,
    repository: REPOSITORY,
    stories: { a: entry({ issue: 1, url: `https://github.com/${REPOSITORY}/issues/1` }), b: entry() },
    proposals: [],
    next: null,
  };
  const field = (selector) => ({ selector, dataset: {}, textContent: '', href: '' });
  const storyElement = (id) => {
    const children = [field('[data-likes]'), field('[data-comments]'), field('[data-stage]'), field('a[data-like]'), field('a[data-discuss]')];
    const byName = Object.fromEntries(children.map((child) => [child.selector, child]));
    const querySelectorAll = (selectors) => children.filter((child) => selectors.split(', ').includes(child.selector));
    return { dataset: { story: id }, querySelectorAll, ...byName };
  };
  const savedGlobals = { document: globalThis.document, fetch: globalThis.fetch, sessionStorage: globalThis.sessionStorage };
  let runs = 0;
  after(() => Object.assign(globalThis, savedGlobals));

  async function loadPage({ api, stored } = {}) {
    const store = new Map(stored ? [['library-votes-live', JSON.stringify(stored)]] : []);
    const apiCalls = [];
    const elements = [storyElement('a'), storyElement('b'), storyElement('unknown')];
    globalThis.document = { querySelectorAll: () => elements };
    globalThis.sessionStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('/data/votes.json')) return { ok: true, status: 200, json: async () => snapshot };
      apiCalls.push(String(url));
      const labels = new URL(url).searchParams.get('labels');
      return api ? { ok: true, status: 200, json: async () => api[labels] } : { ok: false, status: 403, json: async () => ({}) };
    };
    runs += 1;
    const module = await import(`../assets/js/library-votes.js?run=${runs}`);
    for (let tick = 0; tick < 20; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    return { module, elements, apiCalls, store };
  }

  it('exports the repository slug', async () => {
    const { module } = await loadPage();
    assert.equal(module.REPOSITORY, 'Hantok/cargo-passport');
  });

  it('shows the live counts, sets the links and marks eligibility', async () => {
    const { elements, apiCalls, store } = await loadPage({ api: { story: [rawIssue(1, { likes: 2, comments: 3 })], 'story-proposal': [] } });
    const [a, b, unknown] = elements;
    assert.equal(apiCalls.length, 2);
    assert.deepEqual([a['[data-likes]'].textContent, a['[data-comments]'].textContent], ['2', '3']);
    assert.equal(a['[data-stage]'].textContent, 'Next to develop');
    assert.equal(a['[data-stage]'].dataset.stage, 'researching');
    assert.equal(a.dataset.eligible, 'true');
    assert.equal(a['a[data-like]'].href, `https://github.com/${REPOSITORY}/issues/1`);
    assert.equal(a['a[data-discuss]'].href, `https://github.com/${REPOSITORY}/issues/1`);
    assert.equal(b.dataset.eligible, 'false');
    assert.equal(b['a[data-like]'].href, issueListUrl);
    assert.equal(unknown['[data-likes]'].textContent, '');
    assert.equal(unknown['a[data-discuss]'].href, issueListUrl);
    assert.ok(store.has('library-votes-live'));
  });

  it('keeps the numbers of data/votes.json when GitHub does not answer', async () => {
    const { elements } = await loadPage();
    assert.equal(elements[0]['[data-likes]'].textContent, '0');
    assert.equal(elements[0].dataset.eligible, 'false');
    assert.equal(elements[0]['[data-stage]'].textContent, 'Waiting for a like');
  });

  it('uses the answer stored in the last ten minutes instead of asking GitHub again', async () => {
    const stored = { at: Date.now() - 9 * 60 * 1000, votes: { ...snapshot, stories: { ...snapshot.stories, a: entry({ issue: 1, likes: 7, eligible: true, stage: 'eligible' }) } } };
    const { elements, apiCalls } = await loadPage({ stored });
    assert.equal(apiCalls.length, 0);
    assert.equal(elements[0]['[data-likes]'].textContent, '7');
  });

  it('asks GitHub again when the stored answer is older than ten minutes', async () => {
    const stored = { at: Date.now() - 11 * 60 * 1000, votes: snapshot };
    const { apiCalls } = await loadPage({ stored });
    assert.equal(apiCalls.length, 2);
  });
});

describe('data/votes.json', () => {
  it('has the documented shape and agrees with data/stories.json', async () => {
    const [votes, stories] = await Promise.all(['votes', 'stories'].map(async (name) => JSON.parse(await readFile(`${REPO_ROOT}data/${name}.json`, 'utf8'))));
    assert.deepEqual(Object.keys(votes), ['generated_at', 'repository', 'stories', 'proposals', 'next']);
    assert.equal(votes.repository, 'Hantok/cargo-passport');
    const known = new Map(stories.map((s) => [s.id, s]));
    for (const [id, entry] of Object.entries(votes.stories)) {
      assert.ok(known.has(id), `votes.json has "${id}", which data/stories.json does not`);
      assert.equal(entry.issue, known.get(id).issue, `issue number of "${id}" differs between the two files`);
      assert.equal(entry.eligible, entry.likes >= 1, `eligible of "${id}" does not follow its likes`);
      assert.ok(['proposed', 'eligible', 'researching', 'published'].includes(entry.stage), `stage of "${id}"`);
    }
    assert.ok(votes.next === null || votes.next in votes.stories || votes.proposals.some((p) => votes.next === `proposal-${p.issue}`));
  });
});
