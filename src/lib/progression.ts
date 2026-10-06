import { ARCHETYPES, rankFromLevel } from "../data";
import type { GameState } from "../types";

/** XP comes from completed training. Adaptive rewards are set before this pipeline. */
export function awardXP(state: GameState, rawXP: number) {
  const effXP = Math.round(rawXP * ARCHETYPES[state.archetype].xpMult);
  const oldRank = rankFromLevel(state.level).id;
  state.xp += effXP;
  let leveled = false;
  while (state.xp >= state.xpMax) {
    state.xp -= state.xpMax;
    state.level += 1;
    state.xpMax = Math.round(state.xpMax * 1.3);
    state.pts += 5;
    state.str += 1;
    state.agi += 1;
    state.vit += 1;
    if (state.resurrectDebuff > 0) {
      state.resurrectDebuff -= 1;
      // The temporary -1 is restored once, after its three-level recovery window.
      if (state.resurrectDebuff === 0) {
        state.str += 1; state.agi += 1; state.vit += 1;
      }
    }
    state.hpMax = 100 + state.vit * 10;
    state.mpMax = 50 + state.vit * 3;
    state.hp = state.hpMax;
    state.mp = state.mpMax;
    leveled = true;
  }
  const newRank = rankFromLevel(state.level).id;
  return { effXP, leveled, rankChanged: oldRank !== newRank, newRank };
}