# STORY BIBLE — the Ashenveil campaign
The single source of truth for steps S3–S9 of the story campaign. If a step's
instructions ever seem to contradict this file, this file wins; if this file
contradicts published *Solo Leveling* canon, canon wins (see §1).

Structure rule (whole job): every new story file lives in `src/game/story/<floor>.ts`
and is imported by `src/game/script.ts`. Old content is deleted **only after** its
replacement compiles — script.ts is ~155 KB, keep edits surgical.

---

## 1. Canon policy (Solo Leveling)
Locked canon, never contradicted for comedy or convenience:
- The **Rulers** and the **Nine Monarchs** exist; the war ended with the Architect
  **Kandiaru** building the **System** as a recruiting engine for a successor.
- **Ashborn**, the Shadow Monarch, chose one host and passed everything to him.
- The **Cup of Reincarnation** is real and appears in **exactly one ending**
  (§5, TWO NAMES). It is never mentioned before that ending earns it.
- **Only {PLAYER} has a System.** No other character has status screens, levels,
  windows, dailies, or "clauses." Everyone else uses Association paperwork and
  mundane language. A line that gives a System window to an NPC is a bug.
- This game is **post-canon-adjacent**: the canon protagonist's era is over;
  whatever the System is doing here, it is doing with a broken, local, HR-office
  configuration. It is not the global System. It is one dungeon's filing system
  that kept running.

## 2. The TRUTH (revealed, never stated flat until ladder rung 4)
1. {PLAYER} died in Chapter 1 at the **Stone Chapel**. Not "was chosen before the
   exam" — died. The hospital beat (rung 1) reframes this as a *filing error*.
2. {PLAYER} now is a **shadow wearing a dead hunter's memories**. Levels are not
   power progression; they are **personhood** — the shadow accumulating enough
   self to keep wearing the corpse's name without dissolving.
3. **Resonance** (battle.ts, damage ×0.35 when over-leveled at ≤half HP) is NOT the
   System protecting the player. The System has no budget for that. Something else
   is holding the shadow up — referred to in-system as **"the Original."** Resonance
   lines stay mechanically identical; the *voice* of them changes (S6/S7).
4. **Dailies are Anchors.** They exist to keep a shadow coherent, not to punish.
   **No line may shame a miss.** The current "punishment" framing is deleted in
   S8 polish; new daily text uses "if you're reading this, you're still here."
5. The System's voice is **lonely HR-speak**: clauses, filings, tenure metaphors,
   desperate politeness. It never threatens. It has been managing one employee for
   sixty-one years and it has opinions about the break room.

## 3. The reveal ladder (hard order — each rung gates on the floor shown)
| # | Rung | Where | Beats |
|---|------|-------|-------|
| 1 | The hospital filing error | S5 · Ch.1 + Verdant | Death notice misfiled as "reassignment"; first Resonance whisper calls it "clause 7" |
| 2 | Shadow lag / footprints | S5 · Marsh | Reflections arrive late; Pell the ferrywoman counts *two* sets of prints and says nothing |
| 3 | **Kang and Verity** | S5 end → S6 · Caverns | Kang (kept NPC) tells the E-rank philosophy outright; Verity confirms it with a barrier, then mercy (§6) |
| 4 | The Morgue Room | S6 · LV40 | **Job Change**: the LV40 event replaces the old ceremony (§6); {PLAYER} sees the chapel body. Truth is now *sayable* in dialogue |
| 5 | The Echo Gates | S7 · LV40+ | Every shadow claimed whispers "there is someone behind you" — because there is: the Original |
| 6 | The Choosing | S8 · LV100 | Five endings (§5); epilogue reads the route ledgers |

A rung's content may be *seeded* early (foreshadowing, visual gags) but no NPC may
state a rung's fact before it unlocks. Ladder state lives in flags (`ladder1..ladder6`,
§7). The F3/test gates assert the order (§8).

## 4. Tone
- Register: **deadpan workplace horror inside an apocalypse that HR still processes**.
  Filing cabinets in crypts, incident reports for hauntings, performance reviews for
  necromancy.
- Humor/horror mix: **70/30 funny→dread on floors 1–4** (Verdant, Marsh, Caverns,
  Citadel), then it **flips to 30/70 on Ashenveil** — the fifth floor stops joking
  around, and the jokes the System makes there are coping mechanisms.
- Every player-visible line that speaks of {PLAYER} in third person or second person
  must use the **pronoun tokens** (`{PLAYER}`, and the he/she/they table in
  appearance.ts `pronounTable`). Every line. No "he/she" hardcodes, no "s/he," no
  "they" as a gender default for NPCs other than actual plural they.
- No moralizing narration. The game never tells the player the genocide route is
  bad; the ledger just remembers (§7).

## 5. The five endings (S8 authors in full; names are load-bearing)
- **THE LIVING** — refuse all thrones; the dungeon is filed as closed; the shadow
  spends remaining personhood keeping the hunter's funeral public. 30/70 tone payoff.
- **THE THRONE** — take Ashenveil's seat; become the thing the Warden was; the
  System gets tenure and you get its job.
- **THE UNMAKING** — dissolve; the memories are returned to the families one filing
  at a time; the System keeps the desk light on.
- **THE CHAIR** — sit in Kandiaru's chair and *renegotiate the System* — the lonely
  HR thing finally gets a coworker; the dailies become mutual.
- **TWO NAMES (secret)** — requires Igris + Beru claimed AND the Cup of Reincarnation
  path (§1: the only place the Cup appears): the shadow and the Original swap places
  for one signature — the hunter is filed ALIVE under {PLAYER}'s name.
Epilogue text **reads the ledgers** (routes per floor, spared/killed bosses, names on
the MISSING BOARD) — no two saves print the same last page.

## 6. What REPLACES what (old-content kill list)
Deletions happen only after the replacement compiles. Old → new:
- **Bosses (floor slots keep their art-fit positions, ids change):**
  `hobgoblin` LV5 → **GRIK** LV5, the cook (S5; fight is won by feeding/seasoning,
  spare path = apron). `sentinel` LV12 → **PELL** LV12, the ferrywoman (S5; she
  counts your prints, ATK 1, the scripted unwinnable is hers). `irontusk` LV20 →
  **BRAKK** LV20 (S6; three signatures, tunnel law). `warden` LV38 → **kept id**,
  fully rewritten (S6; notifications-as-bullets — literally fires your unread dailies
  as projectiles). Verity LV30 is a **new boss after defending NPCs** (S6, barrier +
  mercy; not a floor-locker, unregistered-adjacent). The Veil door is gated by
  **warden down + LV40** (replaces the old `requires: "unregistered"` chain in S6,
  with save migration).
- **Mobs replaced (S5):** `crawler/rhound` → **moss_crawler**; `stalker` →
  **ledger_mite**; `lurker/reed` → **reed_whisperer**; `dsentry` → **lantern_eel**.
- **Mobs replaced (S6/S7 author their own bands):** `bat/golem/revenant` (caverns),
  `gsent/hknife/acolyte` (citadel), `hare/hound/imp/wight` + `alpha` + `kesh`
  (legacy ashenveil/special) — all deleted once new bands compile. `sentry`
  ("THE SYSTEM") and `architect` special fights are replaced by the Choosing (§5).
- **Old class ceremony DELETED (S6):** `ceremony()` / `ceremonyAnswer()` in
  script.ts and objective `t-ceremony` ("After the Warden, someone asks you a
  question") are removed; **the LV40 Job Change (Morgue Room) replaces them**.
  `normalizeSave` migrates old saves: `ceremonyYes/ceremonyNo`-style flags fold
  into `jobChangeDone` so pre-campaign saves don't strand.
- **Endings DELETED (S8):** `ENDINGS.neutral/pacifist/genocide` → the five above.
  `routeOf` keeps computing; only its epilogue readers change.
- **Old NPC roster DELETED as the new cast lands (S3→S6, floor by floor):**
  `seo` (×4 floors), `hana`, `jino`, `roan`, `sila`, `reed`, `ember`, `herald`,
  `ivy`, `miso`, `baek`, `kid`, `prof`, `skater`, `hermit`, `dog`. **Kept and
  re-voiced:** `kang` (rung 3, the E-rank philosophy survives nearly verbatim),
  `verity` (promoted NPC→boss, rung 3→S6). All dialogue keys for deleted actors
  (`hana.verdant`, `skater.ryu`, `inn.baek`, …) are removed with them.
- **Signs:** the sign *system* stays (25 `sign.*` keys rewritten in place, lines
  retargeted to the art-fit positions from ART_LAYOUT_NOTES.md).
- **Old daily "punishment" copy** is rewritten per §2.4 (S8 polish pass).

## 7. What KEEPS (structure this campaign must not touch)
- **5 floors** (verdant, marsh, caverns, citadel, ashenveil) with the art-fit
  collision.png / objects.json just shipped — story never moves art or geometry;
  actors stand where the layout says.
- **Exit-locking bosses** (`bossDown:<id>` seals the exit; pointer says SEALED).
- **Flag ledgers + `routeOf`** (floor.ts / world.ts): sparing/killing/forgiving all
  recorded, read at epilogue. New forks append flags; nothing is renamed out from
  under old saves (migrate instead).
- **Resonance mechanic** exactly as implemented in battle.ts (×0.35 clause) — only
  its dialogue attribution changes.
- **Quest ledger**: `questDate`/`tick()` daily machinery + SPECIAL_QUESTS stay;
  flavor re-voiced as Anchors.
- **Objective registry discipline**: EVERY objective, fork, target, and ladder rung
  gets an `objectives.ts` entry with `requires`/`done` flag lists. No unlogged story
  state exists.
- **Pronoun token pipeline** (appearance.ts) — and it must render he/she/they in
  tests (§8).
- **The CREATOR** (THE ARCHITECT / System voice, art `creatorfield`): stays as the
  lonely HR entity; its endgame fight becomes the Choosing (§5), not a stat-check.
- **Claim/shadow extraction gating**: `canClaim` NEVER true before Job Change
  (existing hard gate in battle.ts stays). REMNANT_IDS gets repopulated by S7 to
  the new roster, **including bosses killed on any floor** (a slain floor boss's
  remnant is claimable at the Echo Gates even though the player spared nothing else).

## 8. Hard gates (S9 rewrites tests to assert ALL of this)
1. `tsc --noEmit` clean, build clean, **82+ headless tests green** including the
   10k-step fuzz and connectivity per floor (art collision included).
2. **No-power-before-LV40 is a hard fail**: any battle state with claims/shadow
   skills before `jobChangeDone` must throw in test, not clamp.
3. **Five endings headless**: a scripted run reaches each of the five endings'
   text via flags alone; TWO NAMES unreachable without the Igris+Beru+flag path.
4. **Ladder order**: rung-N dialogue keys unreachable while `ladderN-1` flag unset
   (test walks objectives.ts `requires`).
5. **Pronoun render**: sample every dialogue key through he/she/they; no key may
   print a gendered pronoun that disagrees with the table.
6. **Actor art coverage**: every cast actor id (S3 table) has an art key in
   artset.ts (placeholder-allowed, missing-not-ok); ART_SPEC.md regenerated.
7. **Canon guard**: string test — no NPC besides {PLAYER}'s System window may say
   "status window/level up/daily quest" in the same breath as their own name.

## 9. Cast & art handoff (S3 fills this table; S9 verifies it)
Per floor the cast must supply: 1 anchor NPC (talk-shop-or-shrine), 1 quest-giver
tied to the ledger/board, 1 mob band with spare-paths, 1 exit-locking boss with a
non-combat answer. S3 deliverables: snake_case actor ids + voice notes + 2 sample
lines each + the five endings' participants + 9 lineage codas + the art-needs
table (front, turnaround, portrait, battle pose, overlay) fed to the pixel-sprite
pipeline. The MISSING BOARD (41 names, S5) is a ledger the epilogue reads.
