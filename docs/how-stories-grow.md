# How stories grow

The library is a set of stories about fire and weightlessness. This page explains how a new story is born and who does each step. The site is static: there are no likes, comments, issue forms or proposals from readers.

## The one rule

A story states only what its evidence supports. Its status (`data`, `partial` or `hypothesis`) comes from evidence alone, and it shows the gaps that remain.

## The steps

1. **Pick a direction.** The team names a question about fire safety in weightlessness or on the Moon that the library does not answer yet.
2. **Collect sources.** The content pipeline finds NASA and other public sources and records verbatim quotes with links, page and locator. Until evidence exists the status stays `hypothesis`.
3. **Write.** The pipeline drafts the story from the recorded evidence only. A claim without a quote does not go in.
4. **Check quotes and links.** The citation gate checks the structure of every citation. The live quote check opens each source and looks for the quote in it. Links must resolve.
5. **Judge.** An LLM judge, Claude Opus (Anthropic) at effort xhigh, checks that the source passage supports each claim: numbers, units, material, conditions and scope. A failed check goes back to step 3 or 2.
6. **Publish with its status.** The story goes live marked `data`, `partial` or `hypothesis`, with the gaps it still has. What it leaves open becomes input for the next direction.

The three gates are described in [evidence-method.md](evidence-method.md).

## Who does what

- The content pipeline collects sources, writes drafts, runs the quote and link checks and calls the judge.
- The judge is a model's opinion. It can be wrong, it sees only an excerpt, and it never changes a status by itself.
- The team reviews the result and decides what is published.

## Limits

- The pipeline reads public sources only. A source behind a login is not used.
- A passed gate means the claim matches the quoted passage. It does not mean the source itself is right.
- Direction and publication stay with the team, not with the pipeline.
