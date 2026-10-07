import { useShallow } from "zustand/react/shallow";
import { useGame } from "../store/game";
import { useUi } from "../store/ui";
import { classSkills, getClass } from "../data/classes";
import { getPath } from "../data/monarchPaths";
import { canLearnMove, MOVE_ROLE_COLOR, MOVE_ROLE_LABEL, moveEffect, moveUnlockReason } from "../lib/moves";
import { canLearnSkill, skillLockReason } from "../lib/story";
import { SystemWindow } from "./SystemWindow";
import type { BasicSkill, PathMove } from "../types";

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
          {state === "learned" ? "✓ LEARNED" : note.toUpperCase()}
        </p>
      </div>
      {onLearn && (
        <button className="sl-btn shrink-0 text-[10px] px-3" disabled={state !== "ready"} onClick={onLearn}>
          {state === "learned" ? "LEARNED" : `LEARN · ${cost} SP`}
        </button>
      )}
    </div>
  );
}

function Tree({ title, accent, subtitle, children }: { title: string; accent: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <SystemWindow title={title} accent={accent}>
      {subtitle && <p className="font-mono text-[9.5px] text-[color:var(--text-dim)] mb-3">{subtitle}</p>}
      <div className="space-y-2">{children}</div>
    </SystemWindow>
  );
}

export function SkillTreeModal() {
  const close = useUi((s) => s.closeSkillTree);
  const s = useGame(useShallow((state) => ({
    gameClass: state.gameClass, basicSkills: state.basicSkills, level: state.level, sp: state.sp,
    monarchPath: state.monarchPath, learnedMoves: state.learnedMoves, clearedGates: state.clearedGates,
    ascended: state.ascended, str: state.str, agi: state.agi, vit: state.vit,
    learnBasicSkill: state.learnBasicSkill, learnMove: state.learnMove,
    blocked: state.dead || state.inLockdown,
  })));
  const hunterClass = getClass(s.gameClass);
  const path = getPath(s.monarchPath);

  return (
    <div className="fixed inset-0 z-[85] sys-backdrop overflow-y-auto py-6 px-3 skilltree-overlay" role="dialog" aria-modal="true" aria-label="Skill Tree">
      <div className="max-w-[720px] mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="font-head text-[20px] tracking-widest text-[color:var(--cyan-bright)]" style={{ textShadow: "0 0 16px var(--cyan-glow)" }}>
            ✦ SKILL TREE
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-[15px]" style={{ color: "var(--cyan-bright)" }}>{s.sp}</div>
              <div className="font-sys text-[8px] tracking-[0.18em] text-[color:var(--text-dim)]">SKILL POINTS</div>
            </div>
            <button className="sl-btn sl-btn-danger px-3 text-[10px]" onClick={close}>✕ CLOSE</button>
          </div>
        </div>

        {hunterClass && (
          <Tree
            title={`${hunterClass.icon} ${hunterClass.name.toUpperCase()} · CLASS KIT`}
            accent={hunterClass.color}
            subtitle="CLASS SKILLS · ALL UNLOCKED BY LEVEL 30 · COSTS PAID IN SKILL POINTS (SP) FROM QUEST CLEARS"
          >
            {classSkills(s.gameClass).map((skill: BasicSkill) => {
              const learned = skill.starter || s.basicSkills.includes(skill.id);
              const ready = !learned && canLearnSkill(s, skill) && !s.blocked;
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
          </Tree>
        )}

        {path ? (
          <Tree
            title={`${path.icon} ${s.ascended ? path.monarchTitle.toUpperCase() : path.jobClass.toUpperCase()} · MONARCH PATH`}
            accent={path.color}
            subtitle="TRIAL MOVES · ONE UNLOCKED PER GATE · FIVE MOVES, FIVE ROLES · COSTS PAID IN SKILL POINTS"
          >
            {path.moves.map((move: PathMove) => {
              const learned = s.learnedMoves.includes(move.id);
              const ready = !learned && canLearnMove(s, move) && !s.blocked;
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
          </Tree>
        ) : (
          <SystemWindow title="MONARCH PATH" accent="var(--text-dim)">
            <p className="text-[12px] text-[color:var(--text-mid)] leading-relaxed">
              Sealed until the Job Change at level 40. All nine Monarch paths become freely available
              at the Job Change ceremony — whichever you pick extends this tree with five trial moves,
              one unlocked per Gate you clear.
            </p>
          </SystemWindow>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
