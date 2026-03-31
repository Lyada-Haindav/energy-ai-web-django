# emails free

`emails free` is a standalone Brevo-style email operations console that now goes beyond a basic campaign demo.

What it includes now:

- broadcast campaign studio with predictive send scoring
- audience segments, contact health, and template library
- lifecycle automations with manual run controls
- transactional test sending, SMTP details, API key display, and webhook visibility
- sender domain health and form capture modules
- real Brevo delivery when credentials are configured
- a free tier with a hard limit of `500 emails per day`
- premium still marked `coming soon`

## Run locally

```bash
cd emails-free
npm run dev
```

Open [http://localhost:3010](http://localhost:3010).

## Delivery mode

The app now auto-switches to live Brevo delivery when it can find:

- `BREVO_API_KEY`
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`

It looks in this order:

- process environment
- `emails-free/.env`
- `emails-free/.env.local`
- fallback: `server/.env`

If no live credentials are available, it falls back to mock mode.

If you want to label the delivery lane differently during local runs:

```bash
EMAILS_FREE_DELIVERY_MODE=sandbox npm run dev
```

## API endpoints

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/usage`
- `POST /api/intelligence`
- `POST /api/send`
- `POST /api/automations/run`
- `POST /api/transactional/send`

Example campaign payload:

```json
{
  "name": "Founder roadmap drop",
  "segmentId": "founders",
  "templateId": "tpl-launch",
  "recipients": 120,
  "subject": "Your early-access roadmap is ready",
  "abVariantSubject": "Early-access roadmap: founder briefing inside",
  "sendWindow": "morning",
  "smartWarmup": true,
  "content": "Hi {{name}},\n\nWe shipped a stronger email control room and wanted you to see it first."
}
```

Example automation run payload:

```json
{
  "automationId": "aut-001"
}
```

Example transactional test payload:

```json
{
  "recipientEmail": "founder@example.com",
  "templateId": "tpl-reset",
  "subject": "Reset your emails free password",
  "lane": "API"
}
```

## What is real vs mocked

Currently real:

- free-tier quota enforcement
- campaign intelligence scoring
- live Brevo delivery for campaigns, automations, and transactional sends when configured
- automation run behavior and activity feed updates
- transactional test behavior and quota consumption
- contact, template, sender-domain, form, and webhook data rendering

Still mocked:

- authentication and multi-user workspaces
- persistent database storage
- billing, subscriptions, and paid automation upgrades

## Best next steps

- connect SES, Brevo, Resend, or SMTP for real delivery
- persist platform data in PostgreSQL
- add auth, workspaces, and per-user quotas
- add billing and premium automation unlocks
