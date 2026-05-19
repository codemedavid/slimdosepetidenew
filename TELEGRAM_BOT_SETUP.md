# Telegram Order Notifications — Setup

This adds two Supabase Edge Functions and one column to `orders`:

- `supabase/functions/telegram-notify-order` — sends a message to a private Telegram group when a new order is placed, with **Confirm** / **Cancel** inline buttons.
- `supabase/functions/telegram-webhook` — receives the button presses, checks the user is whitelisted, and updates the order status.
- Migration `20260501000000_add_telegram_message_id_to_orders.sql` — adds `telegram_message_id` to `orders`.
- Migration `20260519000000_add_telegram_legacy_message_id.sql` — adds `telegram_legacy_message_id` for the legacy mirror group.
- Migration `20260519000001_add_telegram_proof_message_ids.sql` — adds `telegram_proof_message_id` and `telegram_legacy_proof_message_id` so the bot can delete the payment-proof photo alongside the order summary when moving stages.

## 1. Create the bot

1. In Telegram, message **@BotFather** → `/newbot` → follow prompts.
2. Save the **bot token** (looks like `1234567890:ABC...`).
3. (Recommended) `/setprivacy` → **Disable** so the bot can read group messages if you ever need it. Not required for buttons.

## 2. Create the private group

1. Create a new private Telegram group.
2. Add your bot as a member, then **promote it to admin** (so it can send/edit messages).
3. Invite the admin users who should receive and confirm orders.

## 3. Get the group chat ID and admin user IDs

- **Group chat ID**: send any message in the group, then visit
  `https://api.telegram.org/bot<TOKEN>/getUpdates`
  Look for `"chat":{"id":-100xxxxxxxxxx,...}`. That negative number is the chat ID.
- **Admin user IDs**: each admin should DM the bot once, then in the same `getUpdates` response find `"from":{"id":12345678,...}`. Collect each admin's numeric `id`.

## 4. Apply the migration

```bash
supabase db push
# or paste supabase/migrations/20260501000000_add_telegram_message_id_to_orders.sql into the SQL editor
```

## 5. Set Edge Function secrets

```bash
supabase secrets set \
  TELEGRAM_BOT_TOKEN="123456:ABC..." \
  TELEGRAM_GROUP_CHAT_ID="-1001234567890" \
  TELEGRAM_ADMIN_IDS="11111111,22222222" \
  TELEGRAM_WEBHOOK_SECRET="$(openssl rand -hex 24)"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 5b. Topic IDs (forum group)

The group must be a **forum** (enable "Topics" in group settings). Create these
five topics, then set the matching secrets:

| Topic in Telegram | Env var                     | Triggered by                        |
| ----------------- | --------------------------- | ----------------------------------- |
| New Orders        | `TELEGRAM_TOPIC_NEW`        | Order placed on the site            |
| To Process        | `TELEGRAM_TOPIC_CONFIRMED`  | Status set to `confirmed`           |
| Shipped           | `TELEGRAM_TOPIC_SHIPPED`    | Status set to `shipped`             |
| Complete          | `TELEGRAM_TOPIC_DELIVERED`  | Status set to `delivered`           |
| Cancelled         | `TELEGRAM_TOPIC_CANCELLED`  | Status set to `cancelled`           |

```bash
supabase secrets set \
  TELEGRAM_TOPIC_NEW="2" \
  TELEGRAM_TOPIC_CONFIRMED="3" \
  TELEGRAM_TOPIC_SHIPPED="4" \
  TELEGRAM_TOPIC_DELIVERED="5" \
  TELEGRAM_TOPIC_CANCELLED="6"
```

To find a topic's numeric ID: open the topic in Telegram Web, the URL ends in
`/<chat>/<topic_id>`. Or post any message in the topic, then call
`https://api.telegram.org/bot<TOKEN>/getUpdates` and read `message_thread_id`.
Statuses without a configured topic are silently skipped (no message sent).

## 6. Deploy the functions

```bash
supabase functions deploy telegram-notify-order
supabase functions deploy telegram-move-order
supabase functions deploy telegram-webhook --no-verify-jwt
```

`--no-verify-jwt` is required for the webhook because Telegram does not send a Supabase JWT — auth is enforced via the `TELEGRAM_WEBHOOK_SECRET` header instead.

## 7. Register the webhook with Telegram

Replace `<PROJECT_REF>`, `<TOKEN>`, and `<SECRET>`:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook",
    "secret_token": "<SECRET>",
    "allowed_updates": ["callback_query"]
  }'
```

Verify: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`.

## 8. Test

Place a test order on the site. The group should receive:

- An order summary with **✅ Confirm Order** / **❌ Cancel** buttons.
- The payment proof image as a follow-up.

Tapping a button:

- **Confirm** → updates the order to `confirmed` / `paid`, deletes the message
  (and payment-proof photo) from the **new orders** topic, and reposts it in
  the **confirmed (to process)** topic with a single "▶️ Move to Processing"
  button.
- **Cancel** → updates the order to `cancelled` and reposts in the **cancelled**
  topic.
- Subsequent stages each show one forward button: confirmed → processing →
  shipped → delivered. The previous topic's order summary and payment-proof
  image are deleted on every move.
- Each reposted message includes a `By:` line showing which Telegram user (or
  `Web Admin` for moves made from the admin UI) triggered the move.

Changing the status from the admin UI (`processing` → `shipped` → `delivered`,
etc.) calls `telegram-move-order`, which deletes the current message and reposts
into the topic for the new status. If the new status has no `TELEGRAM_TOPIC_*`
configured, the move is skipped silently.

## Troubleshooting

- **No message arrives**: check the Edge Function logs in Supabase → Functions → `telegram-notify-order` → Logs. Most common: wrong chat ID, or bot not added to the group.
- **403 on webhook**: secret mismatch between `setWebhook` and `TELEGRAM_WEBHOOK_SECRET`.
- **Buttons do nothing**: re-run `setWebhook`, confirm `getWebhookInfo` shows the right URL and no `last_error_message`.
- **"Not authorized" for the right person**: their numeric Telegram ID must be in `TELEGRAM_ADMIN_IDS` (commas, no spaces, exact match).
