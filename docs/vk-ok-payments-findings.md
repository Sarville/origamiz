# VK + OK payments findings (from adding OK payments to Colorit)

Carried over from the session that added Odnoklassniki (OK) payments to `../../flowit`
(Colorit) alongside its existing VK payments. Written here because Origamiz shares the same
`ops/vk-payments/server.js` pattern (and the same physical server/Caddyfile) as Colorit, and will
hit the same platform quirks if/when OK payments get added here too. Full implementation to copy
from: `flowit/ops/vk-payments/server.js`, `flowit/ops/Caddyfile`, `flowit/docs/vk-gotchas.md`
("OK (Odnoklassniki) payments" section).

## OK is not a separate platform to build for - it's a mode of the same VK Mini App

OK integrated the VK Mini Apps platform, so a VK Mini App runs on OK with **no client-side
changes**: the same `vk_user_id`/`sign` launch params work (OK just adds one extra param,
`vk_client=ok`, on top rather than replacing them), and the same `VKWebAppShowOrderBox` bridge
call is used for purchases on both platforms. Don't build a separate OK client integration -
detect `vk_client=ok` only where you need platform-specific behavior (price label, currency).

## Payments are a genuinely separate channel, though

Source: [dev.vk.ru virtual-goods/ok](https://dev.vk.ru/ru/api/payments/virtual-goods/ok),
[dev.vk.ru notifications/ok](https://dev.vk.ru/ru/api/payments/notifications/ok).

- **`get_item` for an OK purchase still arrives on VK's existing classic POST webhook** (the same
  `isValidSig`/`APP_SECRET` as regular VK notifications). The request's `site` param says `"ok"` so
  the server can answer with the OK-currency price instead of the VK one. No new endpoint needed
  for this part.
- **The purchase *confirmation* is a separate notification**: a GET request (not POST) to its own
  URL, which must be set as a distinct "URL для платёжных уведомлений Одноклассников" field in the
  dev.vk.ru app cabinet (separate from the classic VK notification URL). In Colorit this was added
  as a second path (`/vk/colorit-payments/ok`) on the *same* Node process/container - no need for a
  second container just for this route.
- **Signature formula is identical** to VK's classic one for both channels (sort params except
  `sig`, concatenate as `key=value` with no separator, append the secret, md5) - confirmed from
  OK's own published PHP example, not just inferred from VK's docs.
- **One app, one secret - not two.** It's tempting to assume OK issues its own
  `application_secret_key` (true for a *standalone* OK app registered directly on apiok.ru), but
  for an app linked as a VK Mini App there is only `VK_APP_SECRET` - confirmed by inspecting the
  live container's env (`docker inspect <container> --format '{{range .Config.Env}}{{println .}}{{end}}'`).
  Don't add a second secret env var without checking the actual server/cabinet first.
- **OK's response shape is different from VK's classic one**: a bare JSON boolean `true` on
  success (not `{response: {...}}`), and `{error_code, error_msg, error_data}` plus an
  `Invocation-error` HTTP header on failure (not `{error: {...}}`).
- **Not verified against a real captured OK notification** - unlike VK's launch-params signature
  (which was checked against a real captured URL before shipping), the OK payment flow in Colorit
  was built from docs/public examples only, no live OK app was available to capture a real request
  from. Before trusting this in production: use OK's own "Тестовый" probe in the payments cabinet
  and check the real request's exact param names/casing, and whether the response needs to be XML
  instead of JSON (the dashboard has a "Версия API" setting that may select this).

## Currency pricing - the actual bug this session found and fixed

**Neither VK "голоса" nor OK "ОКи" convert 1:1 to RUB, and they don't convert 1:1 to each other
either.** There is no API method to look up the exchange rate (checked
`payment.getUserAccountBalance` on OK's side - that only returns a user's balance, not a rate).
The only reliable source is each platform's own purchase-pack UI showing what a real user pays.

Confirmed from real screenshots of the purchase-pack cabinets (single-unit price, no bulk
discount): **100 RUB ≈ 10 VK voices ≈ 80 OK OKi.** Colorit had been shipped with `ITEM_PRICE = 100`
(voices) - i.e. VK's own "Тестовый" purchase dialog was showing "Стоимость: 100 голосов", which is
**~1000 RUB**, a 10x overcharge bug, not the intended ~100 RUB. Fixed by setting real per-platform
prices (`ITEM_PRICE`/`ITEM_PRICE_OK` in `server.js`, mirrored client-side in `lib/support.ts` for
the button label) explicitly, rather than assuming any 1:1 conversion.

**⚠ Worth double-checking here in Origamiz**: `ops/vk-payments/server.js`'s `ITEMS` comment claims
"VK charges in "voices" (голоса) - confirmed 1 voice = 1 rub for this app", pricing `disable_ads`
at 150 voices and `currency_pack_10k` at 100 voices to match the Yandex build's 150/100 RUB
prices. The voice-to-RUB conversion is a platform-wide VK mechanism (governed by VK's own
purchase-pack pricing), not something that varies per app, so if Colorit's real cabinet shows
10 voices ≈ 100 RUB (not 1:1), Origamiz's assumption is likely the same 10x-style mismatch Colorit
had - unless "confirmed" there refers to an actual live test purchase that verified the real RUB
amount charged (which would be more reliable than Colorit's original assumption was). Re-verify
against Origamiz's own VK app cabinet's purchase-pack pricing before trusting the current 150/100
figures.

## Developer payout / commission (not verified current, needs re-checking in the dev cabinet)

The price the *player* pays for a voice/OKi pack is not what the *developer* receives per unit
spent - VK/OK take a commission, and the payout rate does not depend on which pack size the player
originally bought into. Found one concrete but likely-outdated number: a ~2021 article on VK's
switch to voices-only Mini App payments cited a ~45% VK commission, netting developers ~3.6 RUB
per voice. Nothing reliable found for OK's general commission (one hit mentioned "10% for
purchases made with Bonus OKi" specifically, not general OKi - don't treat that as the general
rate). **No public API for this either** - check the actual current payout rate in dev.vk.ru's
Финансы/Монетизация section (and apiok.ru's equivalent) before relying on any number above for
real revenue projections.

## Architecture decision made (for reference, not prescriptive)

Given OK's dashboard forces two different notification URLs (classic VK one for `get_item`, OK's
own for confirmation) but doesn't require two different secrets or two different servers, Colorit
kept everything in the existing single `vk-payments-colorit` Node process/container, adding the OK
confirmation handling as one more route (`/vk/colorit-payments/ok`) and one more `path` alternative
in the Caddyfile's existing `handle` block. No new container, no new deploy step beyond the usual
one. The same approach should work for Origamiz's `vk-payments-origamiz` container if OK payments
get added here.
