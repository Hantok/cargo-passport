// Numbered citations. Every element with data-evidence="id1 id2" gets one marker per id that opens a
// ui-sdk popover with the verbatim quote and where it came from; <ol data-evidence-list> gets the source list.
// The generated pages already carry plain footnotes (sup.fn) and the same source list, so they read without
// JavaScript or ui-sdk. story.css hides the footnotes only once ui-sdk has upgraded a popover.

const EVIDENCE_URL = new URL("../../data/evidence.json", import.meta.url);

function h(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((child) => child !== undefined && child !== ""));
  return node;
}

async function loadEvidence() {
  try {
    const response = await fetch(EVIDENCE_URL);
    if (!response.ok) return null;
    const records = await response.json();
    return Array.isArray(records) ? new Map(records.map((record) => [record.id, record])) : null;
  } catch {
    return null;
  }
}

function row(label, value) {
  return value ? [h("dt", {}, label), h("dd", {}, value)] : [];
}

function link(href, text) {
  return h("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
}

function citation(number, record) {
  const trigger = h(
    "button",
    { type: "button", className: "cite", textContent: String(number) },
  );
  trigger.setAttribute("aria-label", `Source ${number}: ${record.source_title}`);

  const content = h(
    "ui-popover-content",
    { className: "cite-pop" },
    h("ui-popover-title", {}, `Source ${number}`),
    h("blockquote", {}, record.quote),
    h("p", { className: "cite-src" }, record.source_title),
    h("p", {}, `${record.source_org}, ${record.source_year}`),
    h(
      "div",
      { className: "row" },
      link(record.landing_url, "Open the source"),
      h("ui-popover-close", {}, h("button", { type: "button", className: "close" }, "Close")),
    ),
    h("dl", {}, ...row("Where", record.locator), ...row("Limits", record.limits), ...row("Conditions", record.conditions)),
  );
  content.hidden = true;
  content.setAttribute("side", "top");
  content.setAttribute("side-offset", "10");
  content.setAttribute("collision-padding", "12");

  return h("ui-popover", {}, h("ui-popover-trigger", {}, trigger), content);
}

function sourceItem(number, record) {
  const item = h(
    "li",
    { id: `src-${number}` },
    h("span", { className: "src-title" }, record.source_title),
    h("span", { className: "src-meta" }, `${record.source_org}, ${record.source_year}. ${record.locator ?? ""} `),
    link(record.landing_url, "Source page"),
  );
  if (record.doc_url) item.append(" · ", link(record.doc_url, "Document"));
  return item;
}

function markMissing(element, id) {
  element.append(" ", h("span", { className: "cite cite--pending", title: "data/evidence.json" }, `[source missing: ${id}]`));
}

const ready = loadEvidence().then((records) => ({ records, numbers: new Map(), list: document.querySelector("[data-evidence-list]") }));

function decorate({ records, numbers, list }, element) {
  for (const id of element.dataset.evidence.split(/\s+/).filter(Boolean)) {
    const record = records.get(id);
    if (!record) {
      markMissing(element, id);
      continue;
    }
    if (!numbers.has(id)) {
      numbers.set(id, numbers.size + 1);
      list?.append(sourceItem(numbers.get(id), record));
    }
    element.append(citation(numbers.get(id), record));
  }
}

/** One paragraph per known evidence id: the claim sentence of the record, with its citation marker. */
export async function claimParagraphs(ids) {
  const state = await ready;
  if (!state.records) return [];
  return ids.filter((id) => state.records.has(id)).map((id) => {
    const paragraph = h("p", { textContent: state.records.get(id).claim });
    paragraph.dataset.evidence = id;
    decorate(state, paragraph);
    return paragraph;
  });
}

/** Cites `ids` on an element that was built after load: sets data-evidence and appends one marker per id. */
export async function cite(element, ids) {
  const state = await ready;
  if (!state.records) return;
  element.dataset.evidence = ids.join(" ");
  decorate(state, element);
}

async function init() {
  const state = await ready;
  if (!state.records) return;
  state.list?.replaceChildren();
  document.querySelectorAll("[data-evidence]").forEach((element) => decorate(state, element));
}

init();
