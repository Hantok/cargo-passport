"""Demo launcher: the API plus the static frontend, all on one origin.

    uv run uvicorn serve:app --host 127.0.0.1 --port 8220

API routes keep their paths (/health, /docs, /environments, ...). Static pages are mounted after
them: /frontend (the Cargo Passport page, which calls the API on the same origin), /prototype and
/presentation from the repo, and a small landing page at /.
"""

from pathlib import Path

from fastapi.staticfiles import StaticFiles

from app.main import app

ROOT = Path(__file__).resolve().parent.parent

for name in ("frontend", "prototype", "presentation"):
    if (ROOT / name).is_dir():
        app.mount(f"/{name}", StaticFiles(directory=ROOT / name, html=True), name=name)
app.mount("/", StaticFiles(directory=Path(__file__).resolve().parent / "site", html=True), name="site")
