# Food Verse AI — No external AI API starter

React + Vite + Tailwind frontend, Python FastAPI backend, and local model inference (model weights are downloaded to the machine on first use; no hosted inference API is called).

## Features
- Food photo upload and local food-classification endpoint (Transformers model loaded locally after first download).
- Nutrition estimates from an editable built-in JSON dataset; values are estimates per serving.
- Freshness screen returns a **visual heuristic demo**, not a food-safety verdict.
- Kitchen video upload with frame sampling. Current hygiene output is explicitly a **review aid/demo**, not automated compliance detection.
- Recipe search and basic meal-plan generation from bundled data.
- API health check and frontend/backend separation.

## Requirements
- Node.js 20+ recommended
- Python 3.10–3.12 recommended
- 8 GB RAM minimum; 16 GB recommended for local vision models
- Internet needed once to download model weights and packages; runtime inference is local. No external AI API key is required.

## Run locally
### 1) Backend
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Backend: http://127.0.0.1:8000/docs

### 2) Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open the URL Vite prints (usually http://localhost:5173).

The frontend defaults to `http://127.0.0.1:8000`. Set `VITE_API_BASE_URL` in `frontend/.env` when needed.

## Local model behavior
The first `/api/food/recognize` call tries to load `nateraw/food` using Hugging Face Transformers. It downloads model files once and caches them locally. This is a model repository download, not a remote inference API. If model download fails, the endpoint returns a clear setup error; other features still work. For production/offline use, pre-download and pin a reviewed model version and verify its license.

## Deployment (important)
### Frontend on GitHub + Vercel
1. Create a GitHub repository and push this project.
2. In Vercel, import the repo.
3. Set **Root Directory** to `frontend`.
4. Add environment variable `VITE_API_BASE_URL` to the deployed backend URL, e.g. `https://YOUR-SERVICE.onrender.com`.
5. Deploy.

### Backend
Deploy `backend` as a Python web service on a host that supports persistent outbound model downloads and enough RAM/disk. Example Render settings:
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment variable: `PYTHON_VERSION` if supported by host; use a supported Python 3.11 version.
- If host requires a health check path, use `/api/health`.

**Free hosting caveats:** cold starts, memory limits, temporary filesystem, and model download limits may prevent local models from loading. The model may exceed free-tier resources. A live UI can be deployed on Vercel even if you choose to run AI locally on your own laptop; in that case, the public site cannot access your laptop backend for other users. For a public live AI demo, use a backend host with enough RAM or a suitable self-hosted machine. Never put secrets in frontend variables.

## Safety / accuracy limitations
- Nutrition values are estimates and depend on serving size, recipe, oil, and brand.
- Food photos cannot establish microbiological safety. Do not eat food solely because an image model says it looks fresh.
- Hygiene review currently samples frames and records observations for human review; it does not reliably prove glove/hair-cap compliance or food-safety violations.
- This is an educational prototype, not a medical, regulatory, or commercial food-safety system.

## Project structure
```
food-verse-ai/
  frontend/
    src/
      App.jsx
      main.jsx
      index.css
      data.js
    ...
  backend/
    app/main.py
    app/data.py
    requirements.txt
```
