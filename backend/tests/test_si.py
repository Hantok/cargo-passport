import json
from types import SimpleNamespace

import pytest

from app.config import Settings
from app.si import explain as si

KEY = "sk-test-secret-123"

INPUTS = {
    "cargo": "Science kit",
    "component": "Nomex pouch",
    "hazard": "fire",
    "scenario": "ISS cabin, 21% O2, 101 kPa",
    "comparisons": [{"field": "oxygen", "status": "within_tolerance"}],
    "sources": [
        {"source_id": "psi-bass-1", "excerpt": "Flame spread observed at 21% O2.", "locator": "Table 3"},
        {"source_id": "nasa-std-6001", "excerpt": "Materials shall be tested.", "locator": "4.2"},
    ],
}


def settings(**over):
    base = dict(database_url="postgresql://x", si_base_url="http://shim.test", si_api_key=KEY, si_model="m1", si_api_key_file=None)
    return Settings(**{**base, **over})


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(si, "get_settings", lambda: settings())


def text_resp(text):
    return {"content": [{"type": "text", "text": text}], "stop_reason": "end_turn"}


def tool_resp(name, args, id="c1"):
    return {"content": [{"type": "tool_use", "id": id, "name": name, "input": args}], "stop_reason": "tool_use"}


class FakeClient:
    """Stands in for ClaudeClient: returns scripted responses (dicts) in order; the last one repeats."""

    def __init__(self, content=None, exc=None, *responses):
        self.responses = [text_resp(content)] if content is not None else list(responses)
        self.exc, self.calls = exc, []

    def create(self, **kw):
        self.calls.append(kw)
        if self.exc:
            raise self.exc
        return self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]


def reply(*sentences):
    return json.dumps({"sentences": [{"text": t, "source_ids": ids} for t, ids in sentences]})


def test_unavailable_when_settings_missing(monkeypatch):
    monkeypatch.setattr(si, "get_settings", lambda: settings(si_api_key=None))
    client = FakeClient(reply(("x", ["psi-bass-1"])))
    out = si.explain(INPUTS, client)
    assert out["status"] == "unavailable" and "SI_API_KEY" in out["reason"]
    assert client.calls == []


def test_happy_path():
    client = FakeClient(reply(("Flame spread was observed at 21% O2.", ["psi-bass-1"]), ("Testing is required.", ["nasa-std-6001", "psi-bass-1"])))
    out = si.explain(INPUTS, client)
    assert out["status"] == "ok"
    assert out["cited_source_ids"] == ["nasa-std-6001", "psi-bass-1"]
    assert out["model"] == "m1" and len(out["sentences"]) == 2
    call = client.calls[0]
    assert call["model"] == "m1" and "temperature" not in call and "tools" not in call
    assert si.NO_FINDING in call["system"]
    assert call["messages"][0]["role"] == "user" and "psi-bass-1" in call["messages"][0]["content"]


def test_hallucinated_source_rejected():
    out = si.explain(INPUTS, FakeClient(reply(("Real.", ["psi-bass-1"]), ("Made up.", ["nasa-fake-9"]))))
    assert out["status"] == "rejected" and out["invalid_source_ids"] == ["nasa-fake-9"]


def test_uncited_sentence_rejected():
    out = si.explain(INPUTS, FakeClient(reply(("Real.", ["psi-bass-1"]), ("It will be fine.", []))))
    assert out["status"] == "rejected" and out["uncited_sentence_indexes"] == [1]


def test_no_finding_sentence_allowed_without_citation():
    out = si.explain(INPUTS, FakeClient(reply((si.NO_FINDING, []))))
    assert out["status"] == "ok" and out["cited_source_ids"] == []


def test_no_sources_short_circuits():
    client = FakeClient(reply(("x", ["y"])))
    out = si.explain({**INPUTS, "sources": []}, client)
    assert out["status"] == "ok" and out["sentences"][0]["text"] == si.NO_FINDING
    assert client.calls == []


def test_non_json_wrapper_parsed():
    text = "Sure! Here you go:\n```json\n" + reply(("Observed at 21% O2.", ["psi-bass-1"])) + "\n```"
    out = si.explain(INPUTS, FakeClient(text))
    assert out["status"] == "ok" and out["cited_source_ids"] == ["psi-bass-1"]


def test_garbage_response_is_error():
    out = si.explain(INPUTS, FakeClient("I cannot help with that."))
    assert out["status"] == "error"


def test_provider_exception_is_error_without_key():
    out = si.explain(INPUTS, FakeClient(exc=RuntimeError(f"401 bad key {KEY}")))
    assert out["status"] == "error"
    assert KEY not in json.dumps(out)


def test_key_can_come_from_a_file(monkeypatch, tmp_path):
    f = tmp_path / "bearer"
    f.write_text(KEY + "\n")
    s = settings(si_api_key=None, si_api_key_file=str(f))
    assert s.si_secret == KEY
    assert settings(si_api_key=None, si_api_key_file=str(tmp_path / "missing")).si_secret is None
    monkeypatch.setattr(si, "get_settings", lambda: s)
    seen = {}

    class Spy(si.ClaudeClient):
        def create(self, **kw):
            seen["headers"], seen["url"] = self.headers, self.url
            return text_resp(reply(("Observed.", ["psi-bass-1"])))

    monkeypatch.setattr(si, "ClaudeClient", Spy)
    out = si.explain(INPUTS)
    assert out["status"] == "ok"
    assert seen["headers"]["x-api-key"] == KEY and seen["url"] == "http://shim.test/v1/messages"


def _http(monkeypatch, handler):
    import httpx

    real = httpx.Client

    def post(url, headers=None, json=None, timeout=None):
        with real(transport=httpx.MockTransport(handler)) as c:
            return c.post(url, headers=headers, json=json, timeout=timeout)

    monkeypatch.setattr(si.httpx, "post", post)


def test_http_client_sends_messages_request(monkeypatch):
    import httpx

    seen = {}

    def handler(req):
        seen["req"], seen["body"] = req, json.loads(req.content)
        return httpx.Response(200, json=text_resp("hi"))

    _http(monkeypatch, handler)
    out = si.ClaudeClient("http://shim.test/", KEY).create(model="m1", max_tokens=5, messages=[])
    assert out["content"][0]["text"] == "hi"
    assert str(seen["req"].url) == "http://shim.test/v1/messages"
    assert seen["req"].headers["x-api-key"] == KEY and seen["req"].headers["anthropic-version"]


@pytest.mark.parametrize("make, expect", [
    (lambda httpx: httpx.Response(429, json={"error": {"message": "limit"}}), "HTTP 429"),
    (lambda httpx: httpx.Response(500, text="boom"), "HTTP 500"),
    (lambda httpx: httpx.Response(200, text="not json"), "non-JSON"),
])
def test_http_failures_become_clear_errors(monkeypatch, make, expect):
    import httpx

    _http(monkeypatch, lambda req: make(httpx))
    out = si.explain(INPUTS, si.ClaudeClient("http://shim.test", KEY))
    assert out["status"] == "error" and expect in out["reason"] and KEY not in out["reason"]


def test_timeout_and_unreachable_are_clear_errors(monkeypatch):
    import httpx

    def timeout(req):
        raise httpx.ReadTimeout("slow", request=req)

    def refused(req):
        raise httpx.ConnectError("refused", request=req)

    _http(monkeypatch, timeout)
    assert "timed out" in si.explain(INPUTS, si.ClaudeClient("http://shim.test", KEY))["reason"]
    _http(monkeypatch, refused)
    assert "unreachable" in si.explain(INPUTS, si.ClaudeClient("http://shim.test", KEY))["reason"]


def test_no_verdict_words_in_prompt_rules():
    assert "Do not say the cargo is safe, unsafe, approved or rejected" in si.SYSTEM_PROMPT


def test_cache_key_stable_under_ordering():
    reordered = dict(reversed(list(INPUTS.items())))
    assert si.cache_key(INPUTS, "m1") == si.cache_key(reordered, "m1")
    assert si.cache_key(INPUTS, "m1") != si.cache_key(INPUTS, "m2")
    assert len(si.cache_key(INPUTS)) == 64


class FakeSession:
    def __init__(self):
        self.rows, self.commits = [], 0

    def scalar(self, stmt):
        key = stmt.whereclause.right.value
        return next((r for r in self.rows if r.cache_key == key), None)

    def add(self, row):
        self.rows.append(row)

    def commit(self):
        self.commits += 1


def test_explain_cached_stores_ok_and_hits():
    session = FakeSession()
    client = FakeClient(reply(("Observed.", ["psi-bass-1"])))
    first = si.explain_cached(session, INPUTS, client)
    second = si.explain_cached(session, INPUTS, client)
    assert first["status"] == "ok" and first["cached"] is False
    assert second["cached"] is True and second["sentences"] == first["sentences"]
    assert len(client.calls) == 1 and len(session.rows) == 1
    assert session.rows[0].citations_valid is True


def test_explain_cached_does_not_store_rejected():
    session = FakeSession()
    out = si.explain_cached(session, INPUTS, FakeClient(reply(("Bad.", ["nope"]))))
    assert out["status"] == "rejected" and session.rows == []


def ToolClient(*responses):
    return FakeClient(None, None, *responses)


def tool_call(name, args, id="c1"):
    return tool_resp(name, args, id)


def final(text):
    return text_resp(text)


LOOKUP = {
    "name": "search_observations", "description": "d", "parameters": {"type": "object", "properties": {}},
    "fn": lambda **kw: [{"source_id": "obs-7", "excerpt": "O2 30%.", "locator": "t#row=7"}],
}


def test_tool_records_become_citable():
    client = ToolClient(tool_call("search_observations", {"o2_min_percent": 30}), final(reply(("A test reached 30% O2.", ["obs-7"]))))
    out = si.explain(INPUTS, client, tools=[LOOKUP])
    assert out["status"] == "ok" and out["cited_source_ids"] == ["obs-7"]
    assert out["tool_records"][0]["source_id"] == "obs-7"
    assert client.calls[0]["tools"][0]["name"] == "search_observations" and "input_schema" in client.calls[0]["tools"][0]
    last = client.calls[1]["messages"][-1]
    assert last["role"] == "user" and last["content"][0]["type"] == "tool_result" and last["content"][0]["tool_use_id"] == "c1"


def test_ids_never_returned_are_still_rejected():
    client = ToolClient(tool_call("search_observations", {}), final(reply(("Made up.", ["obs-999"]))))
    assert si.explain(INPUTS, client, tools=[LOOKUP])["status"] == "rejected"


def test_tool_rounds_are_capped_and_last_round_forbids_tools():
    msgs = [tool_call("search_observations", {}, id=f"c{i}") for i in range(si.MAX_TOOL_ROUNDS)]
    client = ToolClient(*msgs, final(reply(("A test reached 30% O2.", ["obs-7"]))))
    out = si.explain(INPUTS, client, tools=[LOOKUP])
    assert out["status"] == "ok"
    assert len(client.calls) == si.MAX_TOOL_ROUNDS + 1
    assert client.calls[-1]["tool_choice"] == {"type": "none"} and client.calls[0]["tool_choice"] == {"type": "auto"}


def test_bad_tool_arguments_go_back_to_the_model():
    bad = {**LOOKUP, "fn": lambda **kw: (_ for _ in ()).throw(TypeError("unexpected argument"))}
    client = ToolClient(tool_call("search_observations", {"nope": 1}), final(reply(("Flame spread was observed at 21% O2.", ["psi-bass-1"]))))
    out = si.explain(INPUTS, client, tools=[bad])
    assert out["status"] == "ok"
    assert "error" in json.loads(client.calls[1]["messages"][-1]["content"][0]["content"])


def test_prose_after_tools_gets_one_json_retry():
    client = ToolClient(tool_call("search_observations", {}), final("A test reached 30% O2."),
                        final(reply(("A test reached 30% O2.", ["obs-7"]))))
    out = si.explain(INPUTS, client, tools=[LOOKUP])
    assert out["status"] == "ok" and len(client.calls) == 3
    assert client.calls[-1]["tool_choice"] == {"type": "none"}
    assert client.calls[-1]["messages"][-1]["content"].startswith("Reply now with the required JSON")


def test_explain_cached_survives_concurrent_identical_save():
    from sqlalchemy.exc import IntegrityError

    class RacingSession(FakeSession):
        rolled_back = False

        def commit(self):
            raise IntegrityError("insert", {}, Exception("duplicate cache_key"))

        def rollback(self):
            self.rolled_back = True

    session = RacingSession()
    out = si.explain_cached(session, INPUTS, FakeClient(reply(("Observed.", ["psi-bass-1"]))))
    assert out["status"] == "ok" and session.rolled_back


def test_tool_loop_has_a_total_deadline(monkeypatch):
    clock = iter([0.0, 0.0, 1000.0, 1000.0, 1000.0])
    monkeypatch.setattr(si.time, "monotonic", lambda: next(clock))
    client = ToolClient(tool_call("search_observations", {}), final(reply(("x", ["obs-7"]))))
    out = si.explain(INPUTS, client, tools=[LOOKUP])
    assert out["status"] == "error" and "exceeded" in out["reason"]


def test_explain_rate_window_slides():
    from app import api

    api._explain_hits.clear()
    n = api.EXPLAIN_PER_IP_PER_MINUTE
    assert all(api._explain_allowed("ip", now=100.0) for _ in range(n))
    assert not api._explain_allowed("ip", now=130.0)
    assert api._explain_allowed("ip", now=161.0)  # the first window has passed
    assert api._explain_allowed("other", now=130.0)
    api._explain_hits.clear()
