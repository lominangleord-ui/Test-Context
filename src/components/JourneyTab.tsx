import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUi } from "../store/ui";
import { useGame } from "../store/game";
import { classSkills, getClass } from "../data/classes";
import { STORY_NPCS, STORY_REGIONS, getEpisode, type StoryRegion } from "../data/story";
import { getPath, PATH_TIERS } from "../data/monarchPaths";
import { MOVE_ROLE_COLOR, moveEffect } from "../lib/moves";
import { currentEpisode, episodeAvailability, storyTotals } from "../lib/story";
import { SystemWindow } from "./SystemWindow";
import { ArtImage } from "./BattleStage";
import type { BasicSkill, StoryEpisode } from "../types";

const KIND_GLYPH: Record<StoryEpisode["kind"], string> = { field: "⚔", story: "✦", boss: "✵", job: "♛" };

const ACT_II_REGIONS = [
  { id: "tier1", name: "Nascent Plane", from: 40, to: 54, art: "/art/map-citadel.jpg", blurb: "The first Monarch Gate — prove the dead answer you." },
  { id: "tier2", name: "Ascendant Plane", from: 55, to: 74, art: "/art/map-caverns.jpg", blurb: "A-Rank territory. The trials stop being survivable by accident." },
  { id: "tier3", name: "Dominion Plane", from: 75, to: 99, art: "/art/map-marsh.jpg", blurb: "S-Rank. The world starts noticing the name on your file." },
  { id: "tier4", name: "Sovereign Plane", from: 100, to: 119, art: "/art/map-verdant.jpg", blurb: "National-level Hunters answer to you, not the other way around." },
  { id: "tier5", name: "Throne of the Monarch", from: 120, to: 999, art: "/art/map-citadel.jpg", blurb: "The throne is empty. The System is asking whether you'll sit." },
];

function regionFor(level: number): StoryRegion | typeof ACT_II_REGIONS[number] {
  const act1 = STORY_REGIONS.find((r) => level >= r.from && level <= r.to);
  if (act1) return act1;
  return ACT_II_REGIONS.find((r) => level >= r.from && level <= r.to) ?? ACT_II_REGIONS[ACT_II_REGIONS.length - 1];
}

function Tile({
  level, title, glyph, state, selected, current, onClick,
}: {
  level: number; title: string; glyph: string; state: string; selected: boolean; current: boolean; onClick: () => void;
}) {
  return (
    <button
      className={`nes-tile data-${state}`}
      data-selected={selected}
      data-current={current}
      onClick={onClick}
      title={`Lvl ${level} · ${title}`}
    >
      <span className="nes-tile-num">{level}</span>
      <span className="nes-tile-glyph">{glyph}</span>
    </button>
  );
}

function EpisodePanel({ episode, region }: { episode: StoryEpisode; region: StoryRegion | typeof ACT_II_REGIONS[number] }) {
  const open = useUi((s) => s.openStoryBattle);
  const state = useGame(useShallow((game) => ({
    level: game.level, sp: game.sp, str: game.str, agi: game.agi, vit: game.vit,
    fatigueLevel: game.fatigueLevel, gameClass: game.gameClass, basicSkills: game.basicSkills,
    storyCleared: game.storyCleared, monarchPath: game.monarchPath,
    blocked: game.dead || game.inLockdown,
  })));
  const availability = episodeAvailability(state, episode);
  const npc = episode.npc ? STORY_NPCS[episode.npc] : null;
  const art = episode.enemyArt ?? region.art;
  const ready = availability.status === "ready" || availability.status === "cleared";
  const forecastColor = availability.forecast.verdict === "favoured" ? "var(--green)" : availability.forecast.verdict === "even" ? "var(--gold)" : "var(--red)";

  return (
    <SystemWindow title={`TILE ${episode.level} · ${episode.title.toUpperCase()}`} accent={ready ? "var(--cyan)" : "var(--text-dim)"}>
      <div className="story-art" style={{ backgroundImage: `url(${art})` }}>
        <span className="story-art-tag">{episode.kind.toUpperCase()} · {region.name.toUpperCase()}</span>
      </div>

      <p className="text-[12px] text-[color:var(--text-mid)] leading-relaxed mt-3">{episode.prose}</p>
      <p className="font-mono text-[10px] text-[color:var(--cyan-bright)] mt-2">&gt; {episode.briefing}</p>

      {npc && (
        <div className="story-npc">
          {npc.art && <ArtImage className="story-npc-art" src={npc.art} alt="" />}
          <div className="min-w-0">
            <div className="font-sys text-[11px] tracking-wide text-[color:var(--text-bright)]">{npc.name}</div>
            <div className="text-[11px] text-[color:var(--text)] leading-snug mt-0.5">"{npc.line}"</div>
          </div>
        </div>
      )}

      <div className="story-statgrid">
        <div><span>ENEMY</span><b>{availability.enemy.name}</b></div>
        <div><span>HP / ATK / DEF</span><b>{availability.enemy.hp} / {availability.enemy.atk} / {availability.enemy.def}</b></div>
        <div><span>REWARD</span><b>{episode.kind === "job" ? "JOB CHANGE" : `+${episode.kind === "field" ? 1 : 2} SP · ${episode.gold} GOLD`}</b></div>
        <div><span>REQUIREMENT</span><b>LV {episode.level}{episode.level > 1 ? " · PREV TILE" : ""}</b></div>
      </div>

      <div className="story-forecast" style={{ borderColor: forecastColor }}>
        <div className="font-sys text-[9.5px] tracking-[0.2em]" style={{ color: forecastColor }}>
          FORECAST · {availability.forecast.verdict.toUpperCase()}
        </div>
        <p className="font-mono text-[10px] text-[color:var(--text)] mt-1">
          You need ~{availability.forecast.turnsToKill} turns to kill it; you survive ~{availability.forecast.turnsToSurvive}.
        </p>
        <p className="text-[11px] text-[color:var(--text-mid)] mt-1">{availability.forecast.note}</p>
      </div>

      <div className="flex items-center justify-between gap-3 mt-3">
        <span className="font-mono text-[9.5px]" style={{ color: ready ? "var(--green)" : "var(--gold)" }}>{availability.reason}</span>
        <button
          className="sl-btn sl-btn-solid shrink-0"
          disabled={!ready || state.blocked}
          onClick={() => open(episode.level)}
        >
          {availability.status === "cleared" ? "▶ REPLAY" : "▶ ENTER BATTLE"}
        </button>
      </div>
    </SystemWindow>
  );
}

function Trials() {
  const openGate = useUi((s) => s.openGateBattle);
  const s = useGame(useShallow((state) => ({
    level: state.level, monarchPath: state.monarchPath, clearedGates: state.clearedGates,
    blocked: state.dead || state.inLockdown,
  })));
  const path = getPath(s.monarchPath);
  return (
    <SystemWindow title="MONARCH TRIALS" accent={path?.color ?? "var(--text-dim)"}>
      {!path ? (
        <p className="text-[12px] text-[color:var(--text-mid)] leading-relaxed">
          Act II begins at the Job Change (level 40). All nine Monarch pathways will be offered, and
          your choice is permanent for this hunter. Each unlocks five trials, one per rank band.
        </p>
      ) : (
        <>
          <p className="font-mono text-[9.5px] tracking-[0.14em] text-[color:var(--text-dim)] mb-2">
            GATES CLEARED · {s.clearedGates.length} / 5 — ONE PER RANK BAND
          </p>
          <div className="story-tiles trials">
            {PATH_TIERS.map((tier) => {
              const cleared = s.clearedGates.includes(tier.number);
              const unlockable = s.level >= tier.min;
              return (
                <button
                  key={tier.number}
                  className="story-tile key"
                  data-state={cleared ? "cleared" : unlockable ? "current" : "locked"}
                  style={{ ["--tile-accent" as string]: path.color }}
                  disabled={!unlockable || s.blocked}
                  title={unlockable ? `Tier ${tier.number} — ${tier.name} at level ${tier.min}` : `Sealed until level ${tier.min}`}
                  onClick={() => openGate(tier.number)}
                >
                  <span className="story-tile-num">{tier.number}</span>
                  <span className="story-tile-glyph">{cleared ? "✓" : unlockable ? "🔑" : "🔒"}</span>
                  <span className="story-tile-name">{tier.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </SystemWindow>
  );
}

function KitPreview({ gameClass, learned }: { gameClass: ReturnType<typeof getClass>; learned: string[] }) {
  if (!gameClass) return null;
  return (
    <SystemWindow title="KIT PREVIEW" accent={gameClass.color}>
      <p className="font-mono text-[9.5px] text-[color:var(--text-dim)] mb-2">
        {gameClass.icon} {gameClass.name.toUpperCase()} · CLICK ✦ IN THE TOP BAR TO SPEND POINTS
      </p>
      <div className="flex flex-wrap gap-1.5">
        {classSkills(gameClass.id).slice(0, 8).map((skill: BasicSkill) => {
          const owned = skill.starter || learned.includes(skill.id);
          return (
            <span
              key={skill.id}
              className="kit-chip"
              style={{
                borderColor: owned ? `${MOVE_ROLE_COLOR[skill.role]}88` : "#ffffff14",
                color: owned ? MOVE_ROLE_COLOR[skill.role] : "var(--text-faint)",
                background: owned ? `${MOVE_ROLE_COLOR[skill.role]}14` : "transparent",
              }}
              title={`${skill.name} — ${moveEffect(skill)}`}
            >
              {owned ? "✓" : "·"} {skill.name}
            </span>
          );
        })}
      </div>
    </SystemWindow>
  );
}

export function JourneyTab() {
  const s = useGame(useShallow((state) => ({
    gameClass: state.gameClass, level: state.level, pts: state.pts, sp: state.sp, storyCleared: state.storyCleared,
    basicSkills: state.basicSkills, dead: state.dead, inLockdown: state.inLockdown,
    monarchPath: state.monarchPath, ascended: state.ascended, clearedGates: state.clearedGates,
  })));
  const open = useUi((st) => st.openStoryBattle);
  const [selected, setSelected] = useState<number | null>(null);
  const current = currentEpisode(s);
  const selectedLevel = selected ?? current.level;
  const episode = getEpisode(selectedLevel) ?? current;
  const region = regionFor(episode.level);
  const totals = useMemo(() => storyTotals(s.storyCleared), [s.storyCleared]);
  const hunterClass = getClass(s.gameClass);
  const path = getPath(s.monarchPath);

  const title = path
    ? (s.ascended ? path.monarchTitle : path.jobClass)
    : (hunterClass?.name ?? "Hunter");

  // Region gating: hide a region until all tiles in every earlier region are cleared.
  const regionTiles: Record<string, [number, number]> = { "verdant-ruins": [1,9], "sunken-marsh": [10,19], "red-caverns": [20,32], "crimson-citadel": [33,40] };
  const regionOrder = ["verdant-ruins", "sunken-marsh", "red-caverns", "crimson-citadel"];
  function regionUnlocked(rid: string): boolean {
    const idx = regionOrder.indexOf(rid);
    for (let i = 0; i < idx; i++) {
      const [lo, hi] = regionTiles[regionOrder[i]];
      for (let lv = lo; lv <= hi; lv++) if (!s.storyCleared.includes(lv)) return false;
    }
    return true;
  }

  return (
    <div className="space-y-4">
      <SystemWindow title="THE JOURNEY" accent="var(--cyan)">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-head text-[15px] tracking-wide text-[color:var(--text-bright)]">
              {hunterClass?.icon} {title.toUpperCase()}
            </div>
            <p className="text-[12px] text-[color:var(--text-mid)] leading-relaxed mt-1">
              Act I: Levels 1–40. One tile per level, walked in order; clear a tile to unlock the next. Tiles cost <b>nothing</b> to enter — only level and the previous tile are required. Clearing tiles grants skill points for the ✦ Skill Tree; stat points come from dailies &amp; level-ups and buy STR / AGI / VIT.
            </p>
            <p className="font-mono text-[9.5px] text-[color:var(--text-dim)] mt-2">
              {totals.clears} / 40 ACT I TILES · {totals.spEarned} SP EARNED · {s.sp} SP IN HAND · {s.pts} STAT PT{s.pts !== 1 ? "S" : ""} IN HAND
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-[18px]" style={{ color: "var(--cyan-bright)", textShadow: "0 0 12px var(--cyan-glow)" }}>LV {s.level}</div>
            <div className="font-sys text-[8px] tracking-[0.18em] text-[color:var(--text-dim)]">HUNTER LEVEL</div>
          </div>
        </div>
      </SystemWindow>

      {/* NES-style grid map — regions only render once every prior region is fully cleared. */}
      {STORY_REGIONS.filter((sr) => regionUnlocked(sr.id)).map((storyRegion) => {
        const tiles = Array.from({ length: storyRegion.to - storyRegion.from + 1 }, (_, i) => storyRegion.from + i);
        const clearedInRegion = tiles.filter((lvl) => s.storyCleared.includes(lvl)).length;
        return (
          <SystemWindow key={storyRegion.id} title={storyRegion.name.toUpperCase()} accent="var(--cyan)">
            <div className="story-map region nes-map" style={{ backgroundImage: `url(${storyRegion.art})` }}>
              <div className="story-map-veil" />
              <div className="story-map-inner">
                <p className="story-map-blurb">{storyRegion.blurb}</p>
                <div className="nes-tile-grid">
                  {tiles.map((level) => {
                    const tile = getEpisode(level);
                    if (!tile) return null;
                    const cleared = s.storyCleared.includes(level);
                    const prevCleared = level <= 1 || s.storyCleared.includes(level - 1);
                    const isCurrent = level === current.level && !cleared;
                    const unlocked = s.level >= level && prevCleared;
                    const state = cleared ? "cleared" : isCurrent ? "current" : unlocked ? "open" : "locked";
                    const enterable = state === "cleared" || state === "current" || state === "open";
                    return (
                      <Tile
                        key={level}
                        level={level}
                        title={tile.title}
                        glyph={cleared ? "✓" : KIND_GLYPH[tile.kind]}
                        state={state}
                        selected={level === episode.level}
                        current={isCurrent}
                        onClick={() => {
                          setSelected(level);
                          // Clicking an enterable tile walks straight into it; locked tiles
                          // just open the detail panel so you can read the requirement.
                          if (enterable && !s.dead && !s.inLockdown) open(level);
                        }}
                      />
                    );
                  })}
                </div>
                <p className="font-mono text-[9px] text-[color:var(--text-dim)] mt-2">
                  {clearedInRegion} / {tiles.length} CLEARED · CLICK A TILE FOR DETAILS
                </p>
              </div>
            </div>
          </SystemWindow>
        );
      })}

      {/* Act II tiles, shown after job change */}
      {s.monarchPath && (
        <SystemWindow title="ACT II · THE MONARCH TRIALS" accent={path?.color ?? "var(--gold)"}>
          <div className="space-y-3">
            <p className="text-[12px] text-[color:var(--text-mid)] leading-relaxed">
              Five trials stand between the Job Change and the throne. Each unlocks at a new rank band
              (B → A → S → National → Monarch). Clear one, learn its move, step onto the next tile.
            </p>
            <div className="nes-tile-grid">
              {PATH_TIERS.map((tier, idx) => {
                const cleared = s.clearedGates.includes(tier.number);
                const unlocked = s.level >= tier.min;
                const isCurrent = !cleared && unlocked && s.clearedGates.length === idx;
                const state = cleared ? "cleared" : isCurrent ? "current" : unlocked ? "open" : "locked";
                return (
                  <button
                    key={tier.number}
                    className={`nes-tile data-${state} trial-tile`}
                    data-current={isCurrent}
                    onClick={() => {
                      // Trial battles open directly through the Trials panel
                    }}
                    title={`Tier ${tier.number} — ${tier.name}`}
                    style={{ ["--path-color" as string]: path?.color ?? "var(--cyan)" }}
                  >
                    <span className="nes-tile-num">{tier.number}</span>
                    <span className="nes-tile-glyph">{cleared ? "✓" : unlocked ? "♛" : "🔒"}</span>
                    <span className="nes-tile-name">{tier.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </SystemWindow>
      )}

      {hunterClass && <KitPreview gameClass={hunterClass} learned={s.basicSkills} />}

      <EpisodePanel episode={episode} region={region} />
      <Trials />
      <div className="h-4" />
    </div>
  );
}
