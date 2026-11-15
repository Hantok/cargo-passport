# How stories grow

The library is a set of stories about fire and weightlessness. This page explains how a new story is born, who does each step, and what runs automatically today. GitHub issues are the discussion and voting space, so the site needs no server.

## The one rule

A direction is developed further only if it has at least one like. A like is a thumbs-up reaction on the direction's issue. With no like it waits.

A like says only that someone wants the direction developed. It does not say the direction is true or important. It never changes a story's evidence status, which comes from evidence alone.

## The six steps

1. **Propose.** Anyone opens the issue form "Propose a story". It asks for the question, why it matters, what you would like to see, and optionally a source. The issue gets the label `story-proposal`.
2. **Like.** Readers add a thumbs-up to the issue and discuss in its comments. One thumbs-up makes the direction eligible.
3. **Collect evidence.** A person or an agent finds sources and records verbatim quotes with links. Until evidence exists the status stays `hypothesis`.
4. **Pass the three gates.** The citation gate, the live quote check and the LLM judge, described in [evidence-method.md](evidence-method.md).
5. **Publish with its status.** The story goes live marked `data`, `partial` or `hypothesis`, with the gaps it still has.
6. **Questions become proposals.** What a published story leaves open is filed as new proposals, and the cycle starts again.

## What runs automatically today

The workflow `.github/workflows/library-sync.yml` runs `tools/library-sync.mjs` every hour and on manual dispatch. Each run:

- creates the labels `story`, `story-proposal` and `next-up` if they are missing;
- creates one issue, labelled `story`, for every entry of `data/stories.json` whose `issue` is `null`, and writes the issue number back into the entry;
- reads the thumbs-up and comment counts of all story issues and open proposal issues;
- writes `data/votes.json`: counts, whether each direction is eligible, its stage, and the next direction;
- moves the label `next-up` to the issue of the next direction;
- commits `data/stories.json` and `data/votes.json` only when they changed.

The module `assets/js/library-votes.js` reads `data/votes.json` for the pages and then tries one live read of the public GitHub API, cached for ten minutes in the browser.

How the sync avoids duplicates: every story issue starts with a hidden marker naming the story id. A story without an issue number first looks for an issue with its marker. Only issues carrying the `story` label count, so a proposal that copies a marker is ignored.

How the next direction is chosen: among directions with at least one like that are not published, the one with the most likes. Stories and open proposals both count. A tie goes to the older issue. If none qualifies, `next` is `null`.

Stages in `data/votes.json`:

| Stage | Meaning |
| --- | --- |
| `proposed` | No like yet. It waits. |
| `eligible` | At least one like, but another direction is next. |
| `researching` | The next direction. Nothing starts research by itself, see below. |
| `published` | The story is live. |

`generated_at` is the time of the last run that changed a count or a stage. Runs that change nothing do not commit.

The sync can be tried without changing anything: `GITHUB_REPOSITORY=Hantok/cargo-passport node tools/library-sync.mjs --dry-run` reads the issues and prints what it would do.

## What a person or an agent does by hand

- Reads the proposals and the votes, and picks up the direction named in `next`.
- Turns a proposal into an entry of `data/stories.json` through a pull request, with `issue` set to the proposal's issue number. The function `proposalToStory` in `tools/library-rules.mjs` builds the starting entry, with status `hypothesis` and no evidence.
- Finds the sources, records the quotes and writes the story, also through a pull request.
- Runs the three gates and fixes what they report.
- Sets `state` to `published` once the gates pass.
- Closes a proposal issue that should leave the list, for example a duplicate.

## What is planned and does not exist yet

- An agent that drafts the evidence and the story for the next direction and opens a pull request, which a person reviews before anything is published.
- Filing the open questions of a published story as proposals without typing them by hand.

## Limits

- A like counts one GitHub account. Someone with several accounts could add several likes. Likes only order the queue.
- Reader proposals are text from the public. The sync stores their titles in `data/votes.json` without checking them.
- The live read of the GitHub API is rate limited for visitors without a token. When it fails, the pages keep the numbers from `data/votes.json`.
