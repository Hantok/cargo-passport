"""Demo launcher: the API plus the static frontend, all on one origin.

    uv run uvicorn serve:app --host 127.0.0.1 --port 8220

API routes keep their paths (/health, /docs, /environments, ...). Static pages are mounted after
them: the Cargo Passport app (frontend/, which calls the API on the same origin) at the app path of
config/app.json (/app/), the site's /assets (shared tokens and fonts of the app and the site), /prototype and
/presentation from the repo, and a small landing page at /.

The old app path (/frontend, what the printed QR codes carry) answers 301 to the new app address and keeps the query.
"""

import json
from pathlib import Path
from urllib.parse import urlsplit

from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.main import app

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / "config" / "app.json").read_text())
APP_PATH = "/" + CONFIG["app_path"].strip("/")  # /app
LEGACY_PATH = "/" + CONFIG["legacy_path"].strip("/")  # /frontend
CANONICAL_ORIGIN = CONFIG["canonical_origin"].rstrip("/")
CANONICAL_HOST = urlsplit(CANONICAL_ORIGIN).hostname
OWN_HOSTS = {CANONICAL_HOST, *CONFIG.get("legacy_hosts", [])}


def moved_to(host: str, path: str, query: str) -> str | None:
    """The address a request for the old app path (or for the app on a legacy host) moves to, or None."""
    legacy = path == LEGACY_PATH or path.startswith(LEGACY_PATH + "/")
    app_on_legacy_host = host in OWN_HOSTS and host != CANONICAL_HOST and (path == APP_PATH or path.startswith(APP_PATH + "/"))
    if not (legacy or app_on_legacy_host):
        return None
    base = CANONICAL_ORIGIN if host in OWN_HOSTS else ""
    return f"{base}{APP_PATH}/" + (f"?{query}" if query else "")


@app.middleware("http")
async def move_old_app_path(request, call_next):
    if request.method in ("GET", "HEAD"):
        host = request.headers.get("host", "").split(":")[0].lower()
        target = moved_to(host, request.url.path, request.url.query)
        if target:
            return RedirectResponse(target, status_code=301)
    return await call_next(request)


mounts = (
    (APP_PATH, ROOT / "frontend", "app"),
    ("/assets", ROOT / "site" / "assets", "site-assets"),
    ("/prototype", ROOT / "prototype", "prototype"),
    ("/presentation", ROOT / "presentation", "presentation"),
)
for url, directory, name in mounts:
    if directory.is_dir():
        app.mount(url, StaticFiles(directory=directory, html=True), name=name)
app.mount("/", StaticFiles(directory=Path(__file__).resolve().parent / "site", html=True), name="site")
