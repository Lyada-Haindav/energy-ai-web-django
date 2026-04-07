# Energy AI

A personal multi-model AI system with:
- Python-served chat interface with the same Energy AI experience
- Django backend with auth, chats, admin overview, and streamed chat responses
- Training pipeline to build your own models over time
- Offline local model artifacts support (`own` provider)
- Local checkpoint serving for real fine-tuned models (`python_local` provider)

## Architecture

- `django_server/`: active Django webapp and Python API runtime
- `client/`: original React source kept as UI reference only, not used at runtime
- `server/`: legacy Express backend kept as reference during the migration
- `training/`: data prep, own-model trainer, LoRA SFT scripts, router classifier training, stack evaluation

## Quick Start

Run the app as a single Python webapp:

```bash
cd django_server
python manage.py migrate --noinput
python manage.py runserver 127.0.0.1:8787 --noreload
```

Open `http://127.0.0.1:8787/`.

Notes:
- Django serves the app from its own static files, so there is no separate frontend server and no Node runtime required.
- The Django backend reads the existing `server/.env` and uses MongoDB for app data when `MONGODB_URI` is set.
- Registration and password reset send through Brevo when outbound network and sender config are available, and fall back to preview links otherwise.
- The browser still uses HTML, CSS, and JavaScript, but everything is served by Django from one Python app.

## MongoDB Storage

To store users, sessions, and chats in MongoDB, add these to `server/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/energy_ai
MONGODB_DB_NAME=energy_ai
MONGODB_COLLECTION=appData
MONGODB_DOCUMENT_ID=energy-ai
MONGODB_REQUIRED=true
MONGODB_USERS_COLLECTION=users
MONGODB_SESSIONS_COLLECTION=authSessions
MONGODB_CHATS_COLLECTION=chatSessions
MONGODB_TRAINING_APPROVED_COLLECTION=trainingApproved
MONGODB_TRAINING_CANDIDATE_COLLECTION=trainingCandidates
MONGODB_TRAINING_REJECTED_COLLECTION=trainingRejected
MONGODB_EVALUATION_COLLECTION=evaluationRuns
```

Behavior:
- When `MONGODB_URI` is set, the Django app reads and writes app data from MongoDB and treats Mongo as the source of truth.
- Users, auth sessions, chats, training feedback, and evaluation runs are stored in separate Mongo collections.
- On first MongoDB use, the Django app seeds the new collections from the legacy JSON store or old single-document Mongo layout if those collections are empty.
- If MongoDB is unavailable while `MONGODB_REQUIRED=true`, the app returns a storage error instead of silently falling back.
- If you explicitly want file fallback again, set `MONGODB_REQUIRED=false`.

The active storage mode is visible in `/api/health` and the admin overview response.

To back up the legacy JSON store and print the active storage summary:

```bash
cd django_server
python manage.py app_storage_audit --backup-file-store
```

## Feedback And Evaluation Loop

- Every chat reply is captured as a training candidate.
- Helpful or corrected feedback is written into the approved training collection and can trigger auto-retraining.
- Rejected replies are stored separately so you can inspect weak routes and prompts.
- The admin page can run the built-in evaluation suite, and the analytics page shows the latest pass rate.

To run the evaluation suite from the terminal without going through the UI:

```bash
python training/scripts/evaluate_stack.py --write-json training/data/local/latest_eval.json
```

## Deploy To Render

This repo is set up to deploy as one Django service.

Render web service settings if you create it manually:

- Runtime: `Python`
- Build Command: `pip install -r django_server/requirements.txt && python django_server/manage.py collectstatic --noinput`
- Start Command: `python django_server/manage.py migrate --noinput && gunicorn --chdir django_server django_server.wsgi:application --bind 0.0.0.0:$PORT`
- Health Check Path: `/api/health`

Render environment variables:

- `DJANGO_DEBUG=false`
- `DJANGO_ALLOWED_HOSTS=.onrender.com`
- `APP_DATA_DIR=/var/data`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `MONGODB_COLLECTION=appData`
- `MONGODB_DOCUMENT_ID=energy-ai`
- `MONGODB_USERS_COLLECTION=users`
- `MONGODB_SESSIONS_COLLECTION=authSessions`
- `MONGODB_CHATS_COLLECTION=chatSessions`
- `MONGODB_TRAINING_APPROVED_COLLECTION=trainingApproved`
- `MONGODB_TRAINING_CANDIDATE_COLLECTION=trainingCandidates`
- `MONGODB_TRAINING_REJECTED_COLLECTION=trainingRejected`
- `MONGODB_EVALUATION_COLLECTION=evaluationRuns`
- `BREVO_API_KEY`
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`

For email links on Render, set `APP_BASE_URL` if you want an explicit public base URL. Otherwise the backend uses the incoming request host.

## Deploy On EC2 t3.micro

This repo can also run on a single Amazon EC2 `t3.micro` with nginx in front of Gunicorn.

Recommended shape for `t3.micro`:

- Use the built-in `own` model artifacts, not local heavy models or Ollama
- Use MongoDB if you want shared persistent app data; otherwise use file storage with `APP_DATA_DIR=/var/lib/energy-ai`
- Keep one Gunicorn process with a small worker count

Typical flow on the EC2 machine:

```bash
git clone <your-repo-url> /var/www/energy-ai
cd /var/www/energy-ai
python3 -m venv .venv
. .venv/bin/activate
pip install -r django_server/requirements.txt
python django_server/manage.py collectstatic --noinput
python django_server/manage.py migrate --noinput
gunicorn --chdir django_server django_server.wsgi:application --bind 127.0.0.1:8787
curl http://127.0.0.1:8787/api/health
```

If you want HTTPS, point your domain to the instance and then install a certificate after nginx is up:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Create Your Own Local Models (Now)

From project root:

```bash
python3 training/scripts/train_own_models.py \
  --input training/data/sample_raw_chats.jsonl \
  --out-dir training/checkpoints/own
```

This creates:
- `training/checkpoints/own/router.json`
- `training/checkpoints/own/fast.json`
- `training/checkpoints/own/deep.json`

Then set in `server/.env`:

```env
ROUTER_PROVIDER=own
FAST_PROVIDER=own
DEEP_PROVIDER=own
OWN_MODELS_DIR=../training/checkpoints/own
```

The generated artifact names now default to:
- `energy-router-own-v1`
- `energy-low-own-v1`
- `energy-high-own-v1`

## Provider Setup

In `server/.env`, set providers per role:

- `mock`: local simulation (default)
- `own`: your locally trained JSON artifacts from `training/scripts/train_own_models.py`
- `python_local`: your real local checkpoints served by `training/scripts/serve_local_models.py`
- `ollama`: local models via Ollama
- `openai`: OpenAI-compatible endpoint

Example:

```env
FAST_PROVIDER=ollama
DEEP_PROVIDER=ollama
FAST_MODEL=your-fast-model
DEEP_MODEL=your-deep-model
```

## Serve Real Local Checkpoints

If you train the Qwen-based fast/deep models and router classifier in `training/checkpoints/fast`, `training/checkpoints/deep`, and `training/checkpoints/router`, you can serve them locally:

```bash
python3 training/scripts/serve_local_models.py --port 9001
```

Then switch the backend to your served checkpoints:

```env
ROUTER_PROVIDER=python_local
FAST_PROVIDER=python_local
DEEP_PROVIDER=python_local
PYTHON_LOCAL_BASE_URL=http://127.0.0.1:9001
```

This is the path for "my own models" to behave closer to a real assistant. The existing `own` provider is still the lightweight JSON artifact stack.

## Train Your Own Models

From `training/`:

```bash
python3 scripts/build_advanced_dataset.py
python3 scripts/prepare_data.py --input data/processed/advanced/raw_large_mix.jsonl --out-dir data/processed/advanced --deep-threshold 4 --max-history-turns 6 --min-fit-score 0 --max-duplicate-prompts 3 --max-fast-to-deep-ratio 3.5
python3 scripts/train_router_model.py --config config/router_model_large.json --train-file data/processed/advanced/router_train.jsonl
python3 scripts/train_fast_model.py --config config/fast_model_large.json --train-file data/processed/advanced/fast_sft.jsonl
python3 scripts/train_deep_model.py --config config/deep_model_large.json --train-file data/processed/advanced/deep_sft.jsonl
```

Then point `FAST_MODEL`, `DEEP_MODEL`, and optionally `ROUTER_MODEL` to served checkpoints.

## Next Up For Production

- Add auth and per-user storage
- Add retrieval (RAG) for grounded answers
- Add safety filters and audit logs
- Add GPU serving with vLLM + quantization for latency/energy
