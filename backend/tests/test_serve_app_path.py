"""The app lives at the app path of config/app.json; the old /frontend (the printed QR codes) moves there with 301.

These tests never reach the database: the redirect answers before any route runs, the static mounts read files.
"""

import pytest
from fastapi.testclient import TestClient

import serve

client = TestClient(serve.app, follow_redirects=False)
NEW = "https://cargo-passport.qwadratic.me/app/"
QUERY = "cargo=portable-science-instrument&route=R23"


@pytest.mark.parametrize("host", ["cargo.qwadratic.me", "cargo-passport.qwadratic.me"])
@pytest.mark.parametrize("path", ["/frontend", "/frontend/", "/frontend/index.html"])
def test_old_path_moves_to_the_new_address_and_keeps_the_query(host, path):
    r = client.get(f"{path}?{QUERY}", headers={"host": host})
    assert r.status_code == 301
    assert r.headers["location"] == f"{NEW}?{QUERY}"


def test_old_path_without_query_has_no_question_mark():
    r = client.get("/frontend/", headers={"host": "cargo.qwadratic.me"})
    assert (r.status_code, r.headers["location"]) == (301, NEW)


def test_other_hosts_get_a_relative_redirect():
    r = client.get(f"/frontend/?{QUERY}", headers={"host": "127.0.0.1:8220"})
    assert (r.status_code, r.headers["location"]) == (301, f"/app/?{QUERY}")


def test_app_on_the_old_host_moves_to_the_new_host():
    r = client.get(f"/app/?{QUERY}", headers={"host": "cargo.qwadratic.me"})
    assert (r.status_code, r.headers["location"]) == (301, f"{NEW}?{QUERY}")


def test_app_is_served_at_the_app_path_with_the_shared_site_assets():
    host = {"host": "cargo-passport.qwadratic.me"}
    page = client.get(f"/app/?{QUERY}", headers=host)
    assert page.status_code == 200 and "<title>Cargo Passport</title>" in page.text
    assert 'href="/assets/css/tokens.css' in page.text
    assert client.get("/app/app.css", headers=host).status_code == 200
    assert client.get("/app/content-map.json", headers=host).status_code == 200
    assert client.get("/assets/css/tokens.css", headers=host).status_code == 200
    assert client.get("/assets/fonts/space-grotesk-latin-wght-normal.woff2", headers=host).status_code == 200


def test_old_path_is_not_a_page_any_more():
    r = client.post("/frontend/", headers={"host": "cargo.qwadratic.me"})
    assert r.status_code in (404, 405)
