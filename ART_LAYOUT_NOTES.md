# Floor layout — art-fit notes & unsure spots (fix in F2)

collision.png + objects.json were drafted from the painted ground.png (art never moved or
resized). Everything below is a judgement call I made that you may want to overrule in the
F2 editor. Coordinates are ground.png px (= world units, 1920×1080).

## VERDANT
1. ROAN stands at (1024,332) on the east road — the art has no "east shrine" clearing; his
   dialogue says east-shrine. Move him to (1300,290) if you want him at the garden shrine.
2. BOSS hobgoblin fights on the garden stair at (1300,150) — arena is tight; the plaza
   (668,378) is the roomier alternative.
3. The two purple cracked sinkholes (E at ~1370,740 and the one by the camp) are SOLID.
   If they're meant to be wadeable cracked floor, tell me and I'll make them hazard.
4. BUS/WRECK hulls are solid; the drive-around gaps between them are carved 34px roads —
   verify they feel right.
5. sign.v.pond (1382,424) points at the N pond edge — the pond itself is solid water;
   there is a second dark water patch W (220,500) with no sign.
6. zone:thicket sits on the W root-road strip (200,330,240,170); it covers ~35% solid —
   encounter spawns only on the walkable sliver.

## MARSH
7. REEDWATCHER reed stands on a hand-carved rock islet at (556,470) beside the glowing
   blue flowers — there is NO dry ground there in the art; it exists so he doesn't drown.
   Alternative: move him onto the W boardwalk at (620,470).
8. shop.sila hut placed at the CAMP (1116,560). The art also has a dock-side hut cluster
   W (230,470) with the boats — swap if the shop belongs there instead.
9. BOSS sentinel is on the N idol islet, arena carved r≈66 around the stairs — small.
10. EXIT→caverns is where the S boardwalk plunges into the water (952,1079 edge). The E
    boardwalk also runs off-map at (1900,470) — if THAT is the caverns road, move the exit.
11. The NE fog shelf (1300,60)-(1500,150) has lit ground but is sealed by water — it's
    unreachable void-masked; if it should be reachable, the reed band at (1350,120) is solid.

## CAVERNS
12. Small lava cracks on the W road (~500-620, 600-720) are HAZARD (you can wade, it burns).
    The big NE + E lava rivers: narrow sections hazard-crossable at the rail bridge
    (1380,240) band, wide lakes forced SOLID (black). Check which crossings you want alive.
13. The dark water pool mid-N hall (1130,290) and the S pit (940,470) are SOLID specks —
    if the S "pool" is actually a floor shadow, I've made it a hole by mistake.
14. den (bones) placed on the W ledge at (240,256) — the art shows a dark shelf there; the
    "den entrance" is my interpretation.
15. EXIT→citadel pad (1128,1016) is painted just OUTSIDE the amphitheater's bottom wall;
    you'll touch it from inside through the arch gap — visually it sits on the wall line.
16. sign.c.tusk (1330,942) + BOSS irontusk (1444,900) are at the boss-hall E edge where
    the floor dims; walkable per art, but verify.
17. zone:shafts (980,430,300,100) sits ON the rail corridor — rails read walkable end-to-end,
    so the zone fights will spawn mid-bridge.

## CITADEL
18. All four green marble pools are SOLID, including the bottom pair that the side aisles
    brush against. The colonnade columns are solid discs placed ±10px from painted shafts —
    expect the odd shoulder-bump; F2 nudge as needed.
19. sign.t.crack (1700,545): the E corridor walkable rect stops at x≈1860; I assume the
    "crack" is at the dim far end. Move to taste.
20. herald (1120,340) stands inside zone:hall — hall encounters can spawn next to him.
    Shrink the zone to (600,300,560,420) if it bothers you.
21. EXIT→ashenveil (6,486) is painted onto the W banner-corridor; the "unregistered door"
    glyph there is faint — pad is 100×92 so it's forgiving.
22. bossGate prop "KNEEL OR FIGHT" sits at the dais foot (960,214); the actual warden fight
    triggers from it — it's a prop, not a boss trigger on the throne itself.

## ASHENVEIL
23. The six market NPCs (miso/baek/kid/prof/skater/dog) are lined up in the narrow S street
    (y 850-880) between the two forced-solid cabinet blocks — dense on purpose (art reads a
    street market), but the dog at (1120,878) nearly overlaps prof at (1122,856).
24. BOSS portal (1370,488) — MOVED onto the E glyph pad. Nothing in the art marks it as
    the boss gate; the arch ruin in the SE void (1600,760) is another candidate.
25. gate prop (1630,168) in the NE door-hall — I assume that hall's painted arch is THE gate.
26. sign.pond (1700,702) sits on the E ring walk; there is no visible pond there — rewrite
    the line or move it.
27. zone:pines (1120,620) is painted tile, not pines — the name is legacy; move to the N
    dais approach if you want forest flavor.
28. SPAWN (952,978) — squeezed into the gap between the two bottom cabinet blocks; if that
    reads too claustrophobic, widen the gap (solidRects in groundfit) or move spawn to (960,880).

## GLOBAL
29. Every floor: exit pads are EXIT-colored cells (green in F3) stamped where I judged the
    doorway is; arrival spawn on the NEXT floor is that floor's own spawn, not the matched
    edge — floors don't have to line up at borders yet.
30. Hazards are walk-and-burn (red cells); water/void are full solid. If you'd rather have
    swim-shallow water anywhere, that's a mask-color change (blue→red) in groundfit, not F2.

## GAMEPLAY FEEL V3 (boss doors, ambush treadmill, growth legibility)
31. BOSS GATE MATH lives in src/game/gate.ts (pure, tested): playerLevel >= rec → open;
    under rec but the hub check-in was seen (flags.met["seo.verdant"]) → ONE honest warn
    line + a SIGN ANYWAY / BACK OUT choice; under rec with the hub unseen → the door
    refuses and the System explains the numbers, the lever (training raises level; kills
    pay SP for the tree [X]) and the jobs that are available instead.
32. Every boss prompt shows the numbers before you press anything:
    "CHALLENGE — <NAME> · REC LV n · YOU LV m"; locked exits read "BOSS FIRST — <NAME> ·
    REC LV n"; the tracked-boss hint panel carries a [REC LV n — YOU LV m] tag that the
    truncation never clips. Floors' rec levels: verdant 5, marsh 12, caverns 20,
    citadel 38, ashenveil arch 12 (gen: 30), alpha den 30.
33. The top-right under the minimap is now a permanent readout: LV / XP progress / SP
    (gold when SP > 0, since SP is spendable right now) / this floor's BOSS REC.
34. Encounter treadmill fixed: ambush cadence is ~14-30 s of walking (was ~4-8), with
    graces — 6 s on floor arrival, 8 s post-battle (was 1.8), 10 s after death. Dash
    halves your step footprint, so running from trouble is now mechanically real.
35. FIELD XP: dungeon kills pay real XP now (kill = 80+34×foeLv, boss = 60×rec², spare ≈ 75%
    of the kill rate, first NPC meeting = +60). awardBattle(sp, gold, xp) is the single
    pipeline; the System complains while granting it. Real-world training still pays BEST
    (daily quest = 500/1000 XP) — the dungeon pays NOW. A Lv-1 player clears the verdant
    arc in ~15-20 min and arrives at the Warden's door near the ladder.
36. BOSS LADDER retuned to actual play speed: verdant 3, marsh 7, caverns 13, citadel 17,
    ashenveil arch 8 (genocide: 24), alpha den 24 — one number per boss, in objects.json
    AND floor.ts defaults (keep them in sync; gate.test.ts checks the ladder climbs).
37. THE SILENT `after:` BUG (fixed): updatePages finished dialogues by calling onDone ->
    pageAfter only. Every page that embeds `after:` (boss gate -> beginBattle, bossAfter ->
    ceremony/save/unlock, shop intro/return, CREATION_INTRO -> openCreator, architect) had
    been finishing into the void — the flow ended and nothing happened. Both completion
    paths (auto-settle and confirm) now capture and fire pages.after AFTER onDone, so the
    callback's own mode wins. That single bug was the whole "challenge never starts".
38. Legacy saves: a save parked on the prototype map (region ashenveil without the campaign
    behind it) is re-filed to verdant at boot; flags/gold/ledger stay intact.
39. Prop colliders hug the silhouette: rect props inset ~16%/12% per side (min 2/1u, cap
    10/8u) and ellipse props stamp a TRUE ellipse instead of a max(w,h)/2 circle — the foot
    box is 20x12u, so full-slot boxes around thin props read as invisible walls.
40. The den's "quiet" now states its requirement and your progress (killsTotal vs 14);
    hard-gate refusals end in a real BACK OUT / SIGN ANYWAY choice, never in nothing.
41. VERDANT MASK V4 = designer-traced bitmap: public/art/floors/verdant/trace-ref.png
    (black=solid, blue=water, green=exit) is imported by scripts/traceimport.mts into
    scripts/verdant.cells.json (480x270, 3x3 majority vote >=5/9 so thin line-art can
    never become a wall; stray-hairline removal + pinhole fill = the rounded corners).
    floorpolys `bitmap:` spec mode loads it verbatim, then the normal guarantees run
    (prop stamps — verdant has none with colliders — NPC/sign/rest/boss/spawn/exit pads,
    border ring preserving EXIT cells). roads/plaza/camp aisles are OPEN by construction.
    scripts/maskdiff.mts re-verifies agreement against the ref (0.04%).
