# ART_SPEC — the manifest-driven art layer (V3)

Everything the game draws is addressable by a **string key**. The engine asks
`Art.urlFor(key)` / `Art.art(key, label, slot)` for every sprite; if a file is
wired to that key in the manifest it is used, and if it is not, a labelled,
uniquely-coloured **placeholder card** is drawn instead. Nothing ever crashes
on missing art — a checkout with zero image files is fully playable.

## 1. Wiring files in: the manifest

`public/art/manifest.json`:

```json
{
  "assets": {
    "actor:seo:front": "actors/seo/front.png",
    "battle:goo": { "file": "enemies/goo.png", "anchor": "bottom-center", "scale": 0.5 },
    "floor:verdant:ground": "floors/verdant/ground.png"
  }
}
```

* Relative paths resolve under `public/art/`. Absolute (`/…`) and full URLs pass through.
* A bare string is shorthand for `{ "file": "…" }`.
* `anchor`: `"bottom-center"` (default — feet/baseline pinned) or `"center"`.
* `scale`: multiplier applied at draw time (default 1). Use it when your art
  runs at a different pixel density than the game's 1×-pixel world.
* Unknown keys in the manifest are ignored (logged once, never a crash).
* `music` (optional): `{ "town": "audio/town.ogg", "battle": "…" }` — real
  audio files take over from the procedural loops automatically; missing or
  broken files fall back to the tone-loop synth.

## 2. Hot-swap and dev reload

* `Art.applyManifest(json)` is callable at runtime (console:
  `window.__art` is exported in dev builds for poking).
* In a **dev server** (`npm run dev`), `startDevReload()` polls
  `/art/manifest.json` every 2 s; when the manifest fingerprint changes, every
  sprite cache, paper-doll composite, battle sprite cache and floor layer is
  rebuilt without a page reload. Drop a PNG in `public/art/`, add its line to
  the manifest, look back at the game: it is there.
* The manifest is fetched once at boot in production; there is no polling there.

## 3. Key naming (the contract)

| family | key | slot (placeholder canvas size) |
|---|---|---|
| overworld actor | `actor:<id>:front` · `actor:<id>:back` · `actor:<id>:side` | 32×44 |
| talking portrait | `portrait:<id>:talk` · `portrait:<id>:neutral` | 96×112 |
| battle sprite | `battle:<enemyId>` | 128×128 |
| prop / interactable | `prop:<interactId>` | varies (48×48 typical) |
| floor layers | `floor:<id>:ground`, `:overlay`, `:collision`, `:objects` | 1920×1080 ground |
| floor ground alt | `floor:<id>:ground_cx_cy` (centre-anchored variant) | — |
| player parts | `playerpart:<slot>:<variant>:<facing>` | 24×40 per slot |

* A missing facing **falls back to `front`** (a side actor drawn mirrored; a
  backless actor gets the front flipped for "away" — never a blank).
* `slot` also names the reserved palette: **the player's placeholder colour is
  reserved** — no NPC, prop, or enemy may generate it. Every other actor gets
  a deterministic, collision-probed unique colour, tinted silhouette, and its
  name printed on the card.

## 4. NO CLONES (hard rule, enforced by tests)

* Every named actor has its own id; the art key is derived from that id
  (`actorKey(id, facing)`), so **two named characters can never share a
  sprite** while the ids differ. `player` is reserved: only the player doll
  ever reads `playerpart:*` keys, and the doll never reads any actor's art.
* Reusing one procedural humanoid grid across NPCs is exactly what V3 exists
  to end; when you supply art, supply **per-actor** files, and the manifest
  will keep them separate. The test suite asserts actor-key uniqueness, the
  player reservation, and placeholder-colour distinctness (`tests/game.test.ts`).
* Bosses are actors too: `actor:warden:front` + `battle:warden` + `portrait:warden:talk`.

## 5. F4 — ART_STATUS

Press **F4** in the field: an inventory overlay lists every key the game
expects this session with `FOUND` / `PLACEHOLDER` / `PENDING` state and the
file path it looked at, and a header summarising the counts. It scrolls with
↑/↓ and closes with F4. It is read-only; it never needs the console.

## 6. Floor pack files (unchanged from V2, now manifest-routable)

`public/art/floors/<id>/` may contain `ground.png` (1920×1080, 1 world px = 1
art px), `overlay.png`, `collision.png` (any size — resampled to the mask
grid, non-zero = solid), `objects.json` (prop colliders/labels/zones/rest
pads/exit overrides). The manifest keys `floor:<id>:ground|overlay|collision|objects`
override those fixed paths, so an art drop can live anywhere; a missing layer
falls back to the procedural generator, and the fixed-path fetch is only tried
when no manifest entry exists.

## 7. Authoring sizes

* World art px: 10 units = 1 m ≈ 20 px; the player doll is 32×44 drawn at
  1× in a 640×360 viewport.
* Sprites should include their own soft shadow if you want one; the engine
  draws a lagging ground ellipse only under the player doll (1-frame-lag
  `shadowPrev` for squash/landing reads).
* Portraits must read at 96×112 with the chin near the bottom third; talk
  pages shift text right by 122 px when a portrait is present.

## 8. What an artist drops, in order

1. `public/art/actors/<id>/front.png` (+ `back.png`, `side.png` optional — front is mirrored as fallback)
2. `public/art/portraits/<id>.png` (one file covers `:talk` and `:neutral` until you split them)
3. `public/art/enemies/<id>.png` for battles
4. `public/art/floors/<id>/ground.png` when a whole floor plate is ready
5. one manifest line per file. Dev reload picks them up mid-session.

Until each drop happens, the labelled placeholder shows *what is missing,
right where it belongs* — the art queue is the F4 screen.
