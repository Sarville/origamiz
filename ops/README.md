# ops

Server-side config that isn't part of the game build but is required to run it in VK. These
files are **not deployed automatically** - they're edited here, then copied to the server by
hand. There is no CI for this.

The server (`server-games`, SSH alias) hosts multiple unrelated VK games behind one Caddy
instance - Origamiz shares it with Colorit (`../../flowit` on this machine). **`Caddyfile` is a
single shared file** - see the note below before editing it.

- `Caddyfile` → lives on the server at `/opt/games/Caddyfile`, bind-mounted into the `caddy-games`
  container as `/etc/caddy/Caddyfile`. Serves every game's static export, plus hotlink protection,
  caching, and each game's VK launch-auth gate (`forward_auth` to that game's `vk-payments-*`
  container).
- `vk-payments/server.js` → lives on the server at `/opt/games/vk-payments-origamiz/server.js`,
  bind-mounted into the `vk-payments-origamiz` container (runs on `node:22-alpine`,
  `node /server.js`, listens on :3000). Handles the VK payments webhook, the launch-params
  signature check used by the Caddy gate above, and the entitlement ledger described below. Needs
  `VK_APP_SECRET` set in the container's environment (not in this repo - configured directly on
  the server) and a bind-mounted `/data` volume for `entitlements.json` to survive restarts.

**Caddyfile is shared with Colorit - don't just overwrite it.** Before copying this file to the
server, diff it against what's actually live (`ssh server-games cat /opt/games/Caddyfile`) to make
sure Colorit's blocks are still present and unchanged - if that project has deployed a Caddy
change since this file was last synced here, merge forward instead of clobbering it. The
`@vkColoritEntry`/`@soundsDirect`/`@static` blocks are shared infrastructure both games' rules
live inside; only `@vkOrigamizEntry` and the `handle /vk/origamiz-*` blocks are Origamiz-specific.

See [`docs/`](../docs/) and the flowit/Colorit project's `docs/vk-gotchas.md` before changing
either file - VK's order-box response types being wrong, the 4096-byte storage cap, Caddy's
directive ordering and `path` wildcard limitations, and the two different VK signature schemes
are all documented there and apply here too.

## Why an entitlement ledger (unlike Colorit)

Colorit only sells one item with no "already owns it" state to track (a repeatable donation).
Origamiz sells a one-time `disable_ads` purchase and a repeatable `currency_pack_10k` - VK's
bridge has no client-side "list my purchases" call the way Yandex's SDK does, so `server.js`
persists what each `vk_user_id` has bought (from the payments webhook) to a JSON file, and the
client (`src/js/platform/vk_wrapper.js`) asks it at boot via `/vk/origamiz-entitlements` and after
a purchase via `/vk/origamiz-consume`.

## Item pricing

`ITEMS` in `vk-payments/server.js` prices `disable_ads`/`currency_pack_10k` in VK "voices"
(голоса) at a confirmed 1 voice = 1 rub for this app, matching Origamiz's Yandex build prices
(150 rub / 100 rub) directly.

## Deploying a change

```bash
# Caddyfile - diff against live first (see warning above), then:
ssh server-games "cp /opt/games/Caddyfile /opt/games/Caddyfile.bak-$(date +%Y%m%d%H%M%S)"
scp ops/Caddyfile server-games:/opt/games/Caddyfile.new
ssh server-games "docker exec -i caddy-games caddy validate --config /dev/stdin --adapter caddyfile" < ops/Caddyfile
ssh server-games "cp /opt/games/Caddyfile.new /opt/games/Caddyfile && rm -f /opt/games/Caddyfile.new"
ssh server-games "docker exec caddy-games caddy reload --config /etc/caddy/Caddyfile"

# vk-payments/server.js
node --check ops/vk-payments/server.js
node ops/vk-payments/server.test.js
ssh server-games "mkdir -p /opt/games/vk-payments-origamiz"
scp ops/vk-payments/server.js server-games:/opt/games/vk-payments-origamiz/server.js
ssh server-games "docker restart vk-payments-origamiz || docker run -d --name vk-payments-origamiz \
    --network games-net --restart unless-stopped \
    -e VK_APP_SECRET=<secret> \
    -v /opt/games/vk-payments-origamiz/server.js:/server.js:ro \
    -v /opt/games/vk-payments-origamiz/data:/data \
    node:22-alpine node /server.js"

# Static build
npm run build-vk
rsync -az --delete build/ server-games:/opt/games/site/vk/origamiz/
```

After either change, verify against the live site (status codes, headers) rather than trusting the
deploy alone.

**Keep this directory in sync with the server.** If you edit the live files directly over SSH
during an incident, copy the final version back here and commit it afterward so the repo doesn't
silently drift from what's actually running.
