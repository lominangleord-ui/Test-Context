import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUi } from "../store/ui";
import { useGame } from "../store/game";
import { HUNTER_CLASSES, classSkills, getClass } from "../data/classes";
import { STORY_ACTS, STORY_NPCS, STORY_REGIONS, getEpisode, type StoryRegion } from "../data/story";
import { getPath, PATH_TIERS } from "../data/monarchPaths";
import { canLearnMove, MOVE_ROLE_COLOR, MOVE_ROLE_LABEL, moveEffect, moveUnlockReason } from "../lib/moves";
import {
  canLearnSkill, currentEpisode, episodeAvailability, kitGuarantee, skillLockReason, storyTotals,
} from "../lib/story";
import { SystemWindow } from "./SystemWindow";
import { ArtImage } from "./BattleStage";
import type { BasicSkill, PathMove, StoryEpisode } from "../types";

const KIND_GLYPH: Record<StoryEpisode["kind"], string> = { field: "⚔", story: "✦", boss: "✵", job: "♛" };

function regionFor(regionId: string): StoryRegion {
  return STORY_REGIONS.find((region) => region.id === regionId) ?? STORY_REGIONS[0];
}

/** One node on either tree. Class nodes and Monarch moves share the shape. */
function SkillNode({
  name, tag, tagColor, effect, state, cost, note, onLearn,
}: {
  name: string;
  tag: string;
  tagColor: string;
  effect: string;
  state: "learned" | "ready" | "locked";
  cost: number;
  note: string;
  onLearn?: () => void;
}) {
  return (
    <div className={`skill-node ${state}`}>
      <div className="skill-node-rail" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-sys text-[12px] font-bold tracking-wide text-[color:var(--text-bright)]">{name}</span>
          <span className="font-sys text-[7.5px] tracking-[0.2em] px-1.5 py-0.5 border" style={{ color: tagColor, borderColor: `${tagColor}66` }}>
            {tag}
          </span>
        </div>
        <p className="font-mono text-[9.5px] text-[color:var(--text-dim)] mt-1">{effect}</p>
        <p className="font-mono text-[9px] mt-1" style={{ color: state === "learned" ? "var(--green)" : state === "ready" ? tagColor : "var(--text-dim)" }}>
          {state === "learned" ? "LEARNED" : note.toUpperCase()}
        </p>
      </div>
      {onLearn && (
        <button className="sl-btn shrink-0 text-[10px] px-3" disabled={state !== "ready"} onClick={onLearn}>
          {state === "learned" ? "LEARNED" : `LEARN / ${cost}`}
        </button>
      )}
    </div>
  );
}

function ClassPicker() {
  const chooseGameClass = useGame((s) => s.chooseGameClass);
  return (
    <SystemWindow title="CHOOSE A CLASS" accent="var(--cyan)">
      <p className="text-[12px] text-[color:var(--text-mid)] leading-relaxed mb-3">
        Your class decides the eight-skill tree you fight Act I with. Every class can own its entire kit
        by level 30, and the Job Change at level 40 replaces it with a Monarch path.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {HUNTER_CLASSES.map((entry) => (
          <button key={entry.id} className="class-card" style={{ borderColor: `${entry.color}44` }} onClick={() => chooseGameClass(entry.id)}>
            <span className="class-card-icon" style={{ color: entry.color }}>{entry.icon}</span>
            <span className="min-w-0">
              <span className="block font-head text-[15px] tracking-wide" style={{ color: entry.color }}>{entry.name}</span>
              <span className="block font-mono text-[9px] text-[color:var(--text-dim)] mt-0.5">{entry.role.toUpperCase()} · LEANS {entry.stats.map((s) => s.toUpperCase()).join(" / ")}</span>
              <span className="block text-[11px] text-[color:var(--text)] mt-1.5 leading-snug">{entry.flavor}</span>
            </span>
          </button>
        ))}
      </div>
    </SystemWindow>
  );
}

function EpisodePanel({ episode, region }: { episode: StoryEpisode; region: StoryRegion }) {
  const open = useUi((s) => s.openStoryBattle);
  const state = useGame(useShallow((game) => ({
    level: game.level, pts: game.pts, str: game.str, agi: game.agi, vit: game.vit,
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
          <ArtImage className="story-npc-art" src={npc.art} alt="" />
          <div className="min-w-0">
            <div className="font-sys text-[11px] tracking-wide text-[color:var(--text-bright)]">{npc.name}</div>
            <div className="text-[11px] text-[color:var(--text)] leading-snug mt-0.5">"{npc.line}"</div>
          </div>
        </div>
      )}

      <div className="story-statgrid">
        <div><span>ENEMY</span><b>{availability.enemy.name}</b></div>
        <div><span>HP / ATK / DEF</span><b>{availability.enemy.hp} / {availability.enemy.atk} / {availability.enemy.def}</b></div>
        <div><span>COST</span><b>{episode.cost} PT</b></div>
        <div><span>REWARD</span><b>{episode.gold} GOLD</b></div>
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
          {availability.status === "cleared" ? "REPLAY" : "ENTER"}
        </button>
      </div>
    </SystemWindow>
  );
}

function SkillTrees() {
  const s = useGame(useShallow((state) => ({
    gameClass: state.gameClass, basicSkills: state.basicSkills, level: state.level, pts: state.pts,
    monarchPath: state.monarchPath, learnedMoves: state.learnedMoves, clearedGates: state.clearedGates,
    ascended: state.ascended, str: state.str, agi: state.agi, vit: state.vit,
    learnBasicSkill: state.learnBasicSkill, learnMove: state.learnMove, setTab: state.setTab,
    blocked: state.dead || state.inLockdown,
  })));
  const hunterClass = getClass(s.gameClass);
  const path = getPath(s.monarchPath);
  const guarantee = s.gameClass ? kitGuarantee(s.gameClass) : null;

  return (
    <>
      <SystemWindow title="CLASS SKILL TREE" accent={hunterClass?.color ?? "var(--cyan)"}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="font-head text-[16px] tracking-wide" style={{ color: hunterClass?.color }}>
              {hunterClass?.icon} {hunterClass?.name.toUpperCase()}
            </div>
            <div className="font-mono text-[9px] text-[color:var(--text-dim)] mt-1">
              EIGHT NODES · ALL REACHABLE BY LEVEL {guarantee?.levelCap ?? 30} FOR {guarantee?.cost ?? 27} POINTS
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[15px]" style={{ color: "var(--cyan-bright)" }}>{s.pts}</div>
            <div className="font-sys text-[8px] tracking-[0.18em] text-[color:var(--text-dim)]">UNSPENT POINTS</div>
          </div>
        </div>
        <div className="space-y-2">
          {classSkills(s.gameClass).map((skill: BasicSkill) => {
            const learned = skill.starter || s.basicSkills.includes(skill.id);
            const ready = !learned && canLearnSkill(s, skill);
            const reason = skillLockReason(s, skill);
            return (
              <SkillNode
                key={skill.id}
                name={skill.name}
                tag={MOVE_ROLE_LABEL[skill.role]}
                tagColor={MOVE_ROLE_COLOR[skill.role]}
                effect={`LV ${skill.level} · ${moveEffect(skill)}`}
                state={learned ? "learned" : ready ? "ready" : "locked"}
                cost={skill.cost}
                note={learned ? "" : reason ?? ""}
                onLearn={skill.starter ? undefined : () => s.learnBasicSkill(skill.id)}
              />
            );
          })}
        </div>
        <p className="font-mono text-[9px] text-[color:var(--text-dim)] mt-3">
          {hunterClass?.flavor}
        </p>
      </SystemWindow>

      {path ? (
        <SystemWindow title="MONARCH PATH SKILL TREE" accent={path.color}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <div className="font-head text-[16px] tracking-wide" style={{ color: path.color }}>
                {path.icon} {s.ascended ? path.monarchTitle.toUpperCase() : path.jobClass.toUpperCase()}
              </div>
              <div className="font-mono text-[9px] text-[color:var(--text-dim)] mt-1">
                FIVE NODES · ONE PER TRIAL · CLEARING A TRIAL OPENS ITS NODE
              </div>
            </div>
            <button className="sl-btn text-[10px]" onClick={() => s.setTab("path")}>OPEN PATH TAB</button>
          </div>
          <div className="space-y-2">
            {path.moves.map((move: PathMove) => {
              const learned = s.learnedMoves.includes(move.id);
              const ready = !learned && canLearnMove(s, move);
              const reason = moveUnlockReason(s, move);
              return (
                <SkillNode
                  key={move.id}
                  name={move.name}
                  tag={MOVE_ROLE_LABEL[move.role]}
                  tagColor={MOVE_ROLE_COLOR[move.role]}
                  effect={`TIER ${move.tier} · ${moveEffect(move)}`}
                  state={learned ? "learned" : ready ? "ready" : "locked"}
                  cost={move.cost}
                  note={learned ? "" : reason ?? ""}
                  onLearn={() => s.learnMove(move.id)}
                />
              );
            })}
          </div>
        </SystemWindow>
      ) : (
        <SystemWindow title="MONARCH PATH SKILL TREE" accent="var(--text-dim)">
          <p className="text-[12px] text-[color:var(--text-mid)] leading-relaxed">
            Sealed until the Job Change at level 40. Whatever you pick then will not be the class you
            started with, and its five trial moves will replace this tree.
          </p>
        </SystemWindow>
      )}
    </>
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
    <SystemWindow title="TRIAL KEYS" accent={path?.color ?? "var(--text-dim)"}>
      {!path ? (
        <p className="text-[12px] text-[color:var(--text-mid)] leading-relaxed">
          Act II begins at the Job Change. The nine lineages each hold five trials, and the map will hand
          you a key to the first one the moment you take a path.
        </p>
      ) : (
        <>
          <p className="font-mono text-[9.5px] tracking-[0.14em] text-[color:var(--text-dim)] mb-2">
            KEYS EARNED · {s.clearedGates.length} / 5 — ONE PER TRIAL, UNLOCKED BY LEVEL
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

export function GameTab() {
  const s = useGame(useShallow((state) => ({
    gameClass: state.gameClass, level: state.level, pts: state.pts, storyCleared: state.storyCleared,
    basicSkills: state.basicSkills, dead: state.dead, inLockdown: state.inLockdown,
  })));
  const [selected, setSelected] = useState<number | null>(null);
  const current = currentEpisode(s);
  const selectedLevel = selected ?? current.level;
  const episode = getEpisode(selectedLevel) ?? current;
  const region = regionFor(episode.region);
  const totals = useMemo(() => storyTotals(s.storyCleared), [s.storyCleared]);
  const act = STORY_ACTS[0];

  if (!s.gameClass) {
    return (
      <div className="space-y-4">
        <ClassPicker />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SystemWindow title={act.name.toUpperCase()} accent="var(--cyan)">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-[color:var(--text-mid)] leading-relaxed">{act.note}</p>
            <p className="font-mono text-[9.5px] text-[color:var(--text-dim)] mt-2">
              {totals.clears} / 40 TILES · {totals.pointsSpent} POINTS SPENT HERE · {s.pts} IN HAND
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-[15px]" style={{ color: "var(--cyan-bright)" }}>LV {s.level}</div>
            <div className="font-sys text-[8px] tracking-[0.18em] text-[color:var(--text-dim)]">HUNTER LEVEL</div>
          </div>
        </div>
      </SystemWindow>

      {/* ── The map: one tile per level, walked in order ── */}
      {STORY_REGIONS.map((storyRegion) => {
        const tiles = Array.from({ length: storyRegion.to - storyRegion.from + 1 }, (_, index) => storyRegion.from + index);
        const clearedInRegion = tiles.filter((level) => s.storyCleared.includes(level)).length;
        return (
          <SystemWindow key={storyRegion.id} title={storyRegion.name.toUpperCase()} accent="var(--cyan)">
            <div className="story-map region" style={{ backgroundImage: `url(${storyRegion.art})` }}>
              <div className="story-map-veil" />
              <div className="story-map-inner">
                <p className="story-map-blurb">{storyRegion.blurb}</p>
                <div className="story-tiles">
                  {tiles.map((level) => {
                    const tile = getEpisode(level);
                    if (!tile) return null;
                    const cleared = s.storyCleared.includes(level);
                    const isCurrent = level === current.level && !cleared;
                    const unlocked = s.level >= level;
                    const state = cleared ? "cleared" : isCurrent ? "current" : unlocked ? "open" : "locked";
                    return (
                      <button
                        key={level}
                        className="story-tile"
                        data-state={state}
                        data-selected={level === episode.level}
                        onClick={() => setSelected(level)}
                        title={`Level ${level} — ${tile.title}`}
                      >
                        <span className="story-tile-num">{level}</span>
                        <span className="story-tile-glyph">{cleared ? "✓" : KIND_GLYPH[tile.kind]}</span>
                        <span className="story-tile-name">{tile.title}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="font-mono text-[9px] text-[color:var(--text-dim)] mt-2">
                  {clearedInRegion} / {tiles.length} CLEARED IN THIS REGION
                </p>
              </div>
            </div>
          </SystemWindow>
        );
      })}

      <EpisodePanel episode={episode} region={region} />
      <SkillTrees />
      <Trials />
    </div>
  );
}
