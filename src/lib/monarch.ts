import { getClearedSkills, getPath, gateTitleId } from "../data/monarchPaths";
import { todayISO } from "./utils";
import type { GameState, PathId, PathSkill, ShopItem, TierNumber } from "../types";

export function mondayKey(at = Date.now()): string {
  const date = new Date(at);
  const delta = (date.getDay() + 6) % 7;
  return todayISO(new Date(date.getFullYear(), date.getMonth(), date.getDate() - delta).getTime());
}

export function pathBonuses(state: Pick<GameState, "monarchPath" | "clearedGates">) {
  const skills = getClearedSkills(getPath(state.monarchPath), state.clearedGates);
  let goldBonus = 0;
  let fatigueResist = 0;
  let lootLuck = 0;
  let staminaDiscount = 0;
  let potionFatigue = 0;
  let draftPower = 0;
  let shieldMax = 0;
  let signature: Extract<PathSkill, { kind: "signatureMove" }> | null = null;
  for (const skill of skills) {
    switch (skill.kind) {
      case "goldBonus": goldBonus += skill.amount; break;
      case "fatigueResist": fatigueResist += skill.amount; break;
      case "lootLuck": lootLuck += skill.amount; break;
      case "streakShield": shieldMax += skill.charges; break;
      case "recoveryBoost":
        if (skill.mode === "staminaDiscount") staminaDiscount += skill.amount;
        if (skill.mode === "potionFatigue") potionFatigue += skill.amount;
        if (skill.mode === "draftPower") draftPower += skill.amount;
        break;
      case "signatureMove": signature = skill; break;
    }
  }
  return { goldBonus, fatigueResist, lootLuck, staminaDiscount, potionFatigue, draftPower, shieldMax, signature };
}

export function goldEarned(state: Pick<GameState, "monarchPath" | "clearedGates">, raw: number) {
  return Math.round(raw * (1 + pathBonuses(state).goldBonus));
}

export function fatigueEarned(state: Pick<GameState, "monarchPath" | "clearedGates">, raw: number) {
  return raw * Math.max(0, 1 - pathBonuses(state).fatigueResist);
}

export function shopCost(state: Pick<GameState, "monarchPath" | "clearedGates">, item: ShopItem): number {
  return item.kind === "stamina" ? Math.round(item.cost * (1 - pathBonuses(state).staminaDiscount)) : item.cost;
}

export function isPathTitleValid(state: Pick<GameState, "monarchPath" | "clearedGates">, titleId: string) {
  return state.monarchPath !== null && state.clearedGates.some((tier) => gateTitleId(state.monarchPath!, tier) === titleId);
}

export function pathTitle(pathId: PathId, tier: TierNumber) {
  const path = getPath(pathId);
  return path ? { id: gateTitleId(pathId, tier), name: `Cleared: ${path.tiers[tier - 1].gateName}`, icon: path.icon } : null;
}