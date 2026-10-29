# Browser instrumentation training session notes

Sessions: 2026-10-28 and 2026-10-29. Environment: Honeycomb team `honeycomb-web-sdk`, environment `dev`.

A write-up of a hands-on session instrumenting the React Meminator with the Honeycomb Web SDK and exploring the results in Honeycomb. It covers what was built, what was learned, and the queries worth keeping.

## Running the app

All scripts live in the repo root and must be run from there, because `docker compose` looks for `docker-compose.yaml` in the current directory.

| Command | What it does |
|---|---|
| `./run` | Builds and starts all services; the app is at http://localhost:10114/ |
| `./run react` | Rebuilds and restarts only the React service |
| `./stop` | `docker compose down` |

Docker Desktop must be running first (`open -a Docker`).

The React app is compiled into its Docker image, so source changes need `./run react`. nginx sends no `Cache-Control` header, and the bundle filename changes on every build, so browsers keep serving the old page after a rebuild. Open the page with a cache-busting query string, for example `http://localhost:10114/?v=123`.

Cursor's Simple Browser can't open `target="_blank"` or `blob:` links; the download link landed on a Google search. Test anything involving new tabs or downloads in Chrome.

## Where attribute values come from

There's no OpenTelemetry Collector here: every service exports straight to `api.honeycomb.io`. A span's fields come from four layers:

1. **SDK resource attributes**, read once at startup and copied onto every span:
   - Node: `host.*` and `process.*` (detected automatically); `service.name` from `OTEL_SERVICE_NAME`; `service.namespace`, `service.version` and `service.instance.id` hard-coded in `tracing.ts`
   - Browser: `browser.*`, `screen.*`, `page.*`, `entry_page.*`, `network.effectiveType` and `session.id` (from `HoneycombWebSDK`), plus anything set in `resourceAttributes`
2. **Instrumentation libraries**, read per span from the real request or event: `http.*`, `url.*`, `target_xpath`, the `middleware - …` spans and Web Vitals (`lcp.*`, `fcp.*`, `ttfb.*`, `cls.*`)
3. **Your code**: `span.setAttribute(name, value)`. The name is any string you choose, and the value is whatever the variable holds at that moment. For example, `app.imageResult` is the URL image-picker chose at random, after backend-for-frontend runs `JSON.parse` on the reply.
4. **Honeycomb at ingest**: `duration_ms`, `trace.*`, `meta.*`, `span.num_events`

`app.*` is only a naming convention, used to keep custom attributes apart from OTel's reserved names.

## Changes made to the React app

| File | Change |
|---|---|
| `main.tsx` | `resourceAttributes`: `feature_flag.key`, `feature_flag.result.variant`, `user.name`, `browser.tab.id` |
| `main.tsx` | Fetch instrumentation `applyCustomAttributesOnSpan` hook: copies the request body's `phrase` onto the `HTTP POST` span as `feature.textinput` |
| `main.tsx` | `sessionProvider` that uses `getSession()` |
| `features.ts` | `ALLOW_USER_QUESTIONS: true`, which shows the text box and **GO** button |
| `session-management.ts` | Session kept in `localStorage`, so it's shared across tabs and expires after 5 idle minutes; per-tab `getTabId()` kept in `sessionStorage` |
| `user-identity.ts` (new) | A stable random name such as `lucky-walrus-721`, kept in `localStorage` |
| `Meminator.tsx` | Shows `user.name = session.id`, adds a **Download image** link that opens the meme in a new tab, creates the image's object URL once and frees the previous one, and calls `updateExpireTime()` on each click |
| `vite.config.ts`, `Dockerfile`, `docker-compose.yaml` | Pass `HONEYCOMB_API_KEY` through to the browser build |

### Design decisions

- **`feature.textinput` is on `HTTP POST`, not `click`.** The click span is about 0 ms long and has no status. The request span carries the user's wait time and `http.status_code`, so one field there answers more questions. It's also read from the request body, so it records exactly what was sent.
- **Identity has three levels:**

  | Field | Scope | Stored in |
  |---|---|---|
  | `user.name` | This browser, permanently | `localStorage`, never expires |
  | `session.id` | All tabs, until 5 idle minutes | `localStorage`, expires |
  | `browser.tab.id` | One tab | `sessionStorage` |

  Per-tab sessions broke the link to a user's original session whenever the app opened a new tab. The image tab shows only a `blob:` URL and never runs the SDK, so opening or closing it doesn't affect the session. This was verified in Chrome.
- **Two attributes for the feature flag:** `feature_flag.key` and `feature_flag.result.variant` follow the OTel convention. A resource can only hold one `feature_flag.key`, so additional flags should each get their own attribute.

## What the traces showed

- **About 2 s of every request is hidden.** `Create Picture` waits on `sleepy activity root span`, five 400 ms calls to `/sleep`, which starts in a separate root trace and is only linked to the request.
- **Phrases containing `!`, `#` or `$` return a 500.** meminator rejects them, but it sets its `app.meminator.*` attributes after that check, so the failing span has no phrase. Suggested fix: move the `setAttributes` call above the validation.
- **`app.*` attributes in Express land on the `request handler - …` span**, not on the server span, because `trace.getActiveSpan()` returns the handler span.
- **Slow memes are big memes.** P50 payload was 247 KB for fast requests, 740 KB for ok and 1039 KB for slow. The image chosen matters far more than the phrase.
- **Span events have no `session.id`.** Rows like `fetchStart` are span events, and the SDK doesn't copy `session.id` onto them. `user.name` is a resource attribute, so it appears on every row.
- **Each GO click produces two nested `click` spans.** Attributes set in the handler land on the inner one, so use `parent.X` from `HTTP POST`; `root.X` won't find them.

## Useful queries

All in dataset `academy-instrumentation-browser`, filtered to `name = HTTP POST` unless noted otherwise.

- **Phrase vs. outcome:** group by `feature.textinput` and `http.status_code`; calculate `COUNT` and `P50(duration_ms)`
- **By user, then session:** `COUNT_DISTINCT(trace.trace_id)` and `COUNT`, grouped by `user.name` and `session.id`
- **Image × text (environment-wide):** filter `any.app.imageResult exists` and group by `any.app.imageResult`, `feature.textinput`. A breakdown on `any.` needs a matching `any.` filter.
- **Trace vs. span counts:** `COUNT_DISTINCT(trace.trace_id)` counts traces; `COUNT` counts spans.

## Calculated fields

| Name | Expression | Use |
|---|---|---|
| `phrase_source` | `IF(EXISTS($feature.textinput), "user typed", "random (phrase-picker)")` | Splits typed phrases from random ones |
| `has_special_chars` | `REG_MATCH(COALESCE($feature.textinput, ""), "[!#$]")` | Predicts the 500 |
| `is_error` | `IF(GTE($http.status_code, 500), 1, 0)` | `SUM` this, then use the formula `$errors / $requests * 100` |
| `who` | `CONCAT(COALESCE($user.name, "(before user.name)"), " / ", REG_VALUE($session.id, "^([0-9a-f]{8})"))` | A short user and session label |
| `browser_app` | `IF(CONTAINS($user_agent.original, "Cursor"), "Cursor Simple Browser", "Chrome")` | A friendly browser name |
| `payload_kb` | `DIV($http.response_content_length, 1024)` | Response size |
| `kb_per_sec` | `DIV(MUL($http.response_content_length, 1000), MUL($duration_ms, 1024))` | Separates slow network from slow server |
| `latency_band` | `IF(GTE($duration_ms, 3000), "3 slow (3s+)", IF(GTE($duration_ms, 2500), "2 ok (2.5-3s)", "1 fast (<2.5s)"))` | Readable latency groups; the number prefixes keep them in order |
| `image_ext` (backend-for-frontend, `Create Picture`) | `TO_LOWER(REG_VALUE($app.imageResult, "\.([A-Za-z]+)$"))` | Combines `.JPG` and `.jpg` |
| `image_name` (backend-for-frontend) | `REG_VALUE($app.imageResult, "/([^/]+)$")` | A short image name |

Rules:
- Calculated fields can't reference other calculated fields.
- Expressions compare with functions (`GTE`, `EQUALS`); filters use symbols (`>=`, `=`).
- A missing field returns null, so wrap optional fields in `COALESCE`.
- On the TOTAL row, a formula's value is the sum of the per-row values, which means nothing for percentages.

## Follow-ups not done

- Move meminator's `setAttributes` above the phrase validation
- Instrument `download.ts` (`app.download.bytes`, `usedDefault`, `status_code`) and `shellOut.ts`
- Make the hidden `/sleep` time visible on the request, for example with `app.sleep.duration_ms`
- Add `Cache-Control: no-cache` for `index.html` in the React nginx config
- Serve each meme at its own URL, so the download link works in any browser
- Save the most useful calculated fields at the dataset level and add a trigger on `has_special_chars`
