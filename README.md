# Energy AI

A personal multi-model AI system with:
- Beautiful React + Tailwind chat interface
- Node backend with 3-model routing (`router`, `low energy`, `high energy`)
- Training pipeline to build your own models over time
- Offline local model artifacts support (`own` provider)
- Local checkpoint serving for real fine-tuned models (`python_local` provider)

## Architecture

- `client/`: React + Vite + Tailwind frontend (ChatGPT-like UX)
- `server/`: Express API with streaming responses and model orchestration
- `training/`: data prep, own-model trainer, LoRA SFT scripts, router classifier training, stack evaluation

## Quick Start

## 1) Start backend

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

## 2) Start frontend

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

## Deploy To Render

This repo is now set up to run as a single Render web service:

- `render.yaml` installs both `client` and `server`
- the frontend is built during deploy
- the Express server serves `client/dist` in production
- API calls use the same origin on Render

Render web service settings if you create it manually:

- Runtime: `Node`
- Build Command: `npm install --prefix client && npm install --prefix server && npm run build --prefix client`
- Start Command: `npm start --prefix server`
- Health Check Path: `/api/health`

Render environment variables:

- `BREVO_API_KEY`
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`
- `ALLOWED_ORIGIN`

For email links on Render, the backend automatically falls back to Render's external URL when `APP_BASE_URL` is not set.

## Deploy On EC2 t3.micro

This repo can also run on a single Amazon EC2 `t3.micro` as one Node process behind nginx.

What is included:

- `ecosystem.config.cjs`: PM2 app config with conservative memory settings
- `server/.env.ec2.example`: production env template for EC2
- `deploy/ec2-t3-micro/setup-ubuntu.sh`: first-time Ubuntu server setup
- `deploy/ec2-t3-micro/update-app.sh`: install, build, and reload the app
- `deploy/ec2-t3-micro/nginx.energy-ai.conf`: nginx reverse-proxy config

Recommended shape for t3.micro:

- Use the built-in `own` model artifacts, not local heavy models or Ollama
- Keep one PM2 process only
- Use file storage with `APP_DATA_DIR=/var/lib/energy-ai` unless you already have MongoDB
- Add a 1 GB swap file so `npm run build` is safer on the small instance

Typical flow on the EC2 machine:

```bash
git clone <your-repo-url> /var/www/energy-ai
cd /var/www/energy-ai
SERVER_NAME=your-domain.com bash deploy/ec2-t3-micro/setup-ubuntu.sh
cp server/.env.ec2.example server/.env
# edit server/.env with real values
bash deploy/ec2-t3-micro/update-app.sh
curl http://127.0.0.1:3000/api/health
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
python scripts/prepare_data.py --input data/sample_raw_chats.jsonl --out-dir data/processed
python scripts/train_router_model.py --config config/router_model.json --train-file data/processed/router_train.jsonl
python scripts/train_fast_model.py --config config/fast_model.json --train-file data/processed/fast_sft.jsonl
python scripts/train_deep_model.py --config config/deep_model.json --train-file data/processed/deep_sft.jsonl
```

Then point `FAST_MODEL`, `DEEP_MODEL`, and optionally `ROUTER_MODEL` to served checkpoints.

## Next Up For Production

- Add auth and per-user storage
- Add retrieval (RAG) for grounded answers
- Add safety filters and audit logs
- Add GPU serving with vLLM + quantization for latency/energy
