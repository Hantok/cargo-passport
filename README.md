<div align="center">

# 🛂 Cargo Passport

### Know what flies.

<p align="center">
  <a href="https://cargo-passport.qwadratic.me/"><img src="media/buttons/live-demo.svg" alt="Live Demo" height="60"></a>&nbsp;
  <a href="https://youtu.be/5JOlN18c3TY"><img src="media/buttons/youtube.svg" alt="Watch on YouTube" height="60"></a>&nbsp;
  <a href="https://cargo-passport.qwadratic.me/docs"><img src="media/buttons/docs.svg" alt="Documentation" height="60"></a>
</p>

**A passport for space cargo: what it's made of, which NASA fire experiments apply where it's going, and what is still untested.**

NASA Space Apps Challenge 2026 · **Flame in Freefall** · Vienna 🇦🇹 · Team **Five-Body Problem**

<img src="media/hero.png" alt="Same cargo. Different environment. Evidence for every environment." width="860">

</div>

---

## 🎬 Watch the 30-second video

<a href="https://youtu.be/5JOlN18c3TY"><img src="media/video-poster.jpg" alt="Play the Cargo Passport video on YouTube" width="860"></a>

[MP4 in this repo](media/cargo-passport-video.mp4) (30 s, English subtitles)

🖥️ [Presentation](presentation/) (4 slides with the video: open `presentation/index.html`, arrow keys to move, F for full screen)

---

## 💡 The problem

You need a passport to travel. So does your cargo in space.

Flames behave differently in microgravity: hot gases don't rise, so oxygen, airflow and materials decide how a fire spreads. NASA has run hundreds of combustion experiments, but each one holds only **for the conditions it was tested in**. A storage bag tested on the ISS at 21% O₂ tells you little about a lunar habitat scenario at 30% O₂ and 1/6 g (the challenge's elevated-oxygen case).

Today that gap is invisible to the crew who pack, ship and store the cargo.

## ✨ What Cargo Passport does

| | |
|---|---|
| 🧾 **A passport for every shipment** | Each item and the materials it's made of, on one page that a QR code on the crate can open (`?cargo=<item>&route=<route>`). |
| 🛰️ **Follow the journey** | Earth → ISS → Moon: compare oxygen, pressure and gravity at every stop. |
| 🔬 **See what NASA tested** | Compares each material with NASA test records: PSI microgravity combustion experiments and NASA-STD-6001 / NTRS material tests. |
| 📊 **Evidence in order** | Test records are ordered by how closely their conditions match the destination. This is a reading order, not a risk score. |
| 🧠 **SI explains the evidence** | Explains the comparison in plain language, cites the records it used, and flags what is untested. No invented results. |
| 🚩 **Gaps stay visible** | "Conditions differ" and "no evidence" are shown, never hidden behind a score. |

## ⚙️ How it works

1. **Evidence** · NASA PSI microgravity combustion records (24 investigations) and NASA-STD-6001 / NTRS material test records.
2. **Compare (code)** · for every stop on the route, the test's oxygen, pressure, gravity and airflow are compared with the destination: *matches*, *differs* or *unknown*. Records are ordered exact → related → analogue, then by how many conditions differ or are unknown. This step is deterministic code, no SI.
3. **SI explains** · "Explain" summarises the comparison and cites the records behind every sentence. It adds no results and gives no emergency instructions.
4. **People decide** · how to ship, where to store, what to test next.

> SI assesses the evidence. **People make the call.**

### How it answers the challenge

| Challenge asks to… | Cargo Passport |
|---|---|
| **Summarize** NASA combustion findings | One passport per shipment: materials, route conditions and the NASA test records that apply |
| **Rank** them | Evidence ordered by how well test conditions match the destination (exact → related → analogue), no safety score |
| **Interpret** them for fire safety | SI explanation with a citation for every sentence; untested conditions stay visible |

## 👩‍🚀 Who it's for

- **Astronauts and cargo crews** packing, moving and storing items
- **Payload engineers** preparing an item for a new destination
- **Safety reviewers** who need the evidence and its limits in one place

## 🌍 Same method on Earth

**Variables change, processes stay.** Wherever an item moves into new conditions, the same question applies:

✈️ Aircraft cargo holds · ⚓ Submarines · 🔋 Battery storage · 🏫 Schools

NASA's own PSI records name submarines, high-altitude aircraft and better smoke detectors as Earth benefits of this research.

## 🗺️ Roadmap

1. Combine evidences (PSI, drop-tower & MAPTIS)
2. Flag risky routes & storage spots
3. Predict flame spread
4. Link fire-response steps
5. Extend to Moon & Mars

## 📚 Data sources

**Used in the app**
- **[NASA Physical Sciences Informatics (PSI)](https://psi.nasa.gov/physci/repo/search?q=combustion)**: 24 combustion investigations, with experimental tables for 20 of them (BASS, BASS-II, Saffire-I–III, FLEX, SAME and more), in [`data/`](data/). 23 of the 24 records are CC0 1.0; please cite them by DOI (list below).
- **NASA material test records**: [NASA-STD-6001](https://standards.nasa.gov/standard/NASA/NASA-STD-6001), NTRS papers and NASA technical documents (NESC TB 26-05, JSC 20793 Rev D, OCHMO-TB-008). A few manufacturer datasheets and one USDA study fill in material properties. Every source, with its URL, is in [`backend/seed/sources.yaml`](backend/seed/sources.yaml).

**Reviewed, not loaded yet** (roadmap)
- **Drop-tower experiments**: NASA BASS ground tests, [ZARM Bremen flame-spread dataset](https://zenodo.org/records/18479713)
- **Materials**: [NASA MAPTIS](https://maptis.nasa.gov/) (access requires registration)

<details>
<summary><b>NASA PSI records used (24 investigations, with DOIs)</b></summary>

- **PSI-10** · ACME/Flame Design · [10.60555/w4zy-bt45](https://doi.org/10.60555/w4zy-bt45)
- **PSI-20** · ACME BRE · [10.60555/vb93-3y72](https://doi.org/10.60555/vb93-3y72)
- **PSI-21** · ACME CLD Flame · [10.60555/23e1-9950](https://doi.org/10.60555/23e1-9950)
- **PSI-22** · ACME E-FIELD Flames · [10.60555/se5a-8c73](https://doi.org/10.60555/se5a-8c73)
- **PSI-23** · ACME s-Flame · [10.60555/k57n-p030](https://doi.org/10.60555/k57n-p030)
- **PSI-25** · BASS-II · [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67)
- **PSI-26** · BASS · [10.60555/58h4-dy80](https://doi.org/10.60555/58h4-dy80)
- **PSI-39** · CFI · [10.60555/m6pj-a914](https://doi.org/10.60555/m6pj-a914)
- **PSI-47** · DAFT / DAFT-2 · [10.60555/ztgj-d202](https://doi.org/10.60555/ztgj-d202)
- **PSI-60** · Computational and Experimental Analysis of SPICE Data Sets · [10.60555/mzjm-yv57](https://doi.org/10.60555/mzjm-yv57)
- **PSI-62** · Concurrent Flame Spread Modeling using Flamelet Generated Manifolds in Microgravity with Comparison to BASS Experiments using Two-Color Tomography · [10.60555/e9xp-ex83](https://doi.org/10.60555/e9xp-ex83)
- **PSI-68** · FLEX-2 · [10.60555/byp8-h018](https://doi.org/10.60555/byp8-h018)
- **PSI-69** · FLEX · [10.60555/mbq8-0451](https://doi.org/10.60555/mbq8-0451)
- **PSI-98** · SAFFIRE-I · [10.60555/0t15-1z43](https://doi.org/10.60555/0t15-1z43)
- **PSI-99** · SAFFIRE-II · [10.60555/2chp-m469](https://doi.org/10.60555/2chp-m469)
- **PSI-100** · SAFFIRE-III · [10.60555/040q-4h36](https://doi.org/10.60555/040q-4h36)
- **PSI-101** · SAME-R · [10.60555/2np7-jv14](https://doi.org/10.60555/2np7-jv14)
- **PSI-102** · SAME · [10.60555/gd4k-8h62](https://doi.org/10.60555/gd4k-8h62)
- **PSI-106** · SLICE · [10.60555/pm12-rg61](https://doi.org/10.60555/pm12-rg61)
- **PSI-107** · SPICE · [10.60555/9kbh-e962](https://doi.org/10.60555/9kbh-e962)
- **PSI-115** · Utilization of the Smoke Aerosol Measurement Experiment Data for Advanced Modeling and Simulation of Smoke Generation in Micro-Gravity · [10.60555/q0v5-1v28](https://doi.org/10.60555/q0v5-1v28)
- **PSI-117** · Effect of External Thermo-Convective Perturbation on Cool Flame Dynamics: A Multidimensional Multi-Physics CFD Analysis · [10.60555/gz0q-b577](https://doi.org/10.60555/gz0q-b577)
- **PSI-142** · Quantitative Studies of Cool Flame Transitions at Radiation / Stretch Extinction Using Counterflow Flames · [10.60555/80qf-vj95](https://doi.org/10.60555/80qf-vj95)
- **PSI-159** · ACME CFI-G · [10.60555/cyt1-kh64](https://doi.org/10.60555/cyt1-kh64)

</details>

> ⚠️ **Not a safety verdict.** Cargo Passport organises evidence for review. It does not approve cargo for flight; that remains with the responsible safety authority. The shipment in the video is illustrative.

## 🚀 Run it locally

Needs Docker, [uv](https://docs.astral.sh/uv/) and Python 3.12+.

```bash
# 1. A local Postgres
docker run -d --name cp-pg -e POSTGRES_USER=cargo -e POSTGRES_PASSWORD=cargo -e POSTGRES_DB=cargo -p 5432:5432 postgres:16
export DATABASE_URL=postgresql+psycopg://cargo:cargo@localhost:5432/cargo
export DATABASE_URL_DIRECT=$DATABASE_URL

# 2. Schema and NASA data
cd backend
uv sync --frozen
uv run alembic upgrade head
uv run python -m app.ingest.load

# 3. Start API and app on one origin
uv run uvicorn serve:app --port 8000
```

Open **http://localhost:8000/app/** for the app and http://localhost:8000/docs for the API. "Explain" needs an SI key: set `SI_API_KEY` (or `SI_API_KEY_FILE`) for the Anthropic Messages API; optional `SI_BASE_URL`, `SI_MODEL` (default `claude-sonnet-5-5`). Without a key, everything else works and Explain says it is unavailable.

Tests: `uv run pytest -q` in `backend/` (after the load step), and `node frontend/index.test.cjs`. More in [`backend/README.md`](backend/README.md) and [`backend/API.md`](backend/API.md).

## 🗂️ What's in this repo

| Folder | Contents |
|---|---|
| [`backend/`](backend/) | FastAPI API, Postgres schema (Alembic), NASA data ingest, evidence comparison ([`app/logic/compare.py`](backend/app/logic/compare.py)), SI Explain ([`app/si/explain.py`](backend/app/si/explain.py)), tests |
| [`backend/seed/`](backend/seed/) | Curated NASA sources, materials, material tests, environments, routes and the illustrative cargo (YAML) |
| [`frontend/`](frontend/) | The Cargo Passport app (one HTML file) |
| [`data/`](data/) | NASA PSI investigations (JSON) and experimental tables (CSV) |
| [`docs/`](docs/) | Concept, research notes, environment profiles, build plan |
| [`prototype/`](prototype/) | Cargo environment map and cargo journey animation (rendered into the video) |
| [`presentation/`](presentation/) | 4-slide deck with the video |
| [`media/`](media/) | Video, poster and README images |

## 👥 Team Five-Body Problem

<img src="media/team.png" alt="Team Five-Body Problem" width="560">

Roman Slysh · Roman Ganopolskyi · Ivan Kotelnikov · Gjergj Brestovci · Sophie Ganopolska

Built in Vienna at NASA Space Apps Challenge 2026.

## 🤖 SI disclosure

- **Code and data:** the code, the data-normalisation scripts and the docs were written with SI coding assistants (Claude, Codex) and reviewed and tested by the team. The curated seed files in `backend/seed/` were compiled with SI assistance from the sources in `sources.yaml`; the cargo items are illustrative.
- **Video and audio:** the narration is synthetic speech (Kokoro-82M TTS via HyperFrames). The visuals, the music and the narration script were produced with SI assistance. The opening line was written by the team. The MP4 metadata carries the same disclosure.
- **Images:** the images in this README and in the presentation were produced with SI assistance. Every video frame and every SI-generated image carries a visible "SI-assisted" watermark.
- **In the app:** the "Explain" feature uses an SI model (Claude by Anthropic) to explain the computed evidence comparison with sources. The comparison itself is computed in code from NASA data.
- **Idea:** the concept came from the team's brainstorm; SI tools helped organise it and check data feasibility.

## 📄 License

[MIT](LICENSE)
