# mau-portfolio-api

Tiny Fastify API that powers the contact form on my portfolio site. Accepts a JSON payload and relays it over SMTP (Brevo) to an inbox.

## Stack

- [Fastify 5](https://fastify.dev/)
- `@fastify/cors` — origin allowlist
- `@fastify/rate-limit` — 5 req/min per IP on `/api/contact`
- `nodemailer` — SMTP transport
- TypeScript, CommonJS output (`tsc` → `dist/`)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in SMTP + contact vars
npm run dev                  # tsx watch on src/index.ts
```

Build and run the compiled output:

```bash
npm run build
npm start
```

## Environment variables

See [.env.example](.env.example). Both `.env` and `.env.local` are loaded, and `.env.local` overrides `.env`.

| Variable              | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| `PORT`                | Port to listen on (default `3001`).                             |
| `HOST`                | Bind address (default `0.0.0.0`).                               |
| `ALLOWED_ORIGINS`     | Comma-separated CORS allowlist. Empty = allow all.              |
| `BREVO_SMTP_HOST`     | SMTP host (e.g. `smtp-relay.brevo.com`).                        |
| `BREVO_SMTP_PORT`     | SMTP port. `465` uses TLS; anything else uses STARTTLS.         |
| `BREVO_SMTP_USER`     | SMTP username.                                                  |
| `BREVO_SMTP_PASS`     | SMTP password / API key.                                        |
| `CONTACT_FROM_EMAIL`  | `From` address on outgoing mail.                                |
| `CONTACT_FROM_NAME`   | `From` display name (optional, defaults to "Portfolio Contact"). |
| `CONTACT_TO_EMAIL`    | Destination inbox.                                              |

## Endpoints

### `GET /health`

Liveness probe.

```json
{ "ok": true }
```

### `POST /api/contact`

Request body:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "subject": "Hello",
  "message": "Loved the portfolio.",
  "company": ""
}
```

- `name`, `email`, `message` are required.
- `subject` is optional.
- `company` is a honeypot — any non-empty value returns `200 {"ok":true}` without sending.
- `message` is capped at 5000 characters.

Responses:

| Status | Body                                                   | When                         |
| ------ | ------------------------------------------------------ | ---------------------------- |
| 200    | `{"ok": true}`                                         | Mail queued or honeypot hit. |
| 400    | `{"error": "..."}`                                     | Validation failure.          |
| 429    | `{"statusCode":429,"error":"Too Many Requests",...}`   | >5 requests/min from one IP. |
| 500    | `{"error": "Email service is not configured."}`        | Missing SMTP env vars.       |
| 502    | `{"error": "Failed to send message. Please try again later."}` | SMTP send failed.   |

## Project layout

```
src/
  index.ts           # Fastify bootstrap, CORS, shutdown, /health
  routes/
    contact.ts       # POST /api/contact + rate limit
```
