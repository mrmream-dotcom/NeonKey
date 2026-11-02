# neonkey-phone-relay

Relays messages taken by the NeonKey AI phone assistant (ElevenLabs agent "NeonKey Phone Assistant (TEST)")
to hello@neonkey.tech (BCC mr.mream@gmail.com) via Resend.

- ElevenLabs webhook tool `send_message_to_team` POSTs JSON to `https://neonkey-phone-relay.mr-mream.workers.dev/message`
  with header `X-Relay-Token`.
- Body fields: name, callback_number, email, need, best_time, urgent ("yes"/"no").
- Wrong/missing token -> 404. No RESEND_API_KEY yet -> 503 `email_not_configured`.
- Secrets (never committed): `RELAY_TOKEN` (set), `RESEND_API_KEY` (Michael pastes it in the Cloudflare dashboard).
- Caller details are never logged.
