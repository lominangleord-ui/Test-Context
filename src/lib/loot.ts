import { getItem, rollLoot } from "../data";
import { goldEarned, pathBonuses } from "./monarch";
import type { GameState, LootRoll } from "../types";

/** A single reward path keeps the granted resource and its notification in sync. */
export function resolveLoot(state: GameState, roll: LootRoll) {
  let patch: Partial<GameState> = {};
  let message = "";

  if (roll.kind === "potions") {
    patch = { potions: state.potions + roll.amount };
    message = `<b>+${roll.amount} Recovery Potions</b><br/>Full HP and MP restoration when used.`;
  } else if (roll.kind === "token") {
    patch = { relapseTokens: state.relapseTokens + roll.amount };
    message = `<b>+${roll.amount} Relapse Token</b><br/>A way out of Lockdown.`;
  } else if (roll.kind === "gold") {
    const amount = goldEarned(state, roll.amount);
    patch = { gold: state.gold + amount };
    message = `<b>+${amount} gold</b><br/>Spend it on recovery, not XP shortcuts.`;
  } else if (roll.kind === "theme") {
    const item = getItem(roll.themeId);
    if (item) {
      patch = {
        inventory: [...new Set([...state.inventory, item.id])],
        hudTheme: item.theme,
      };
      message = `<b>${item.name}</b><br/>Cosmetic theme unlocked and applied. Switch back any time.`;
    }
  } else {
    const flourish = getItem(roll.flourishId);
    if (flourish?.pathFlourish) {
      patch = {
        inventory: [...new Set([...state.inventory, flourish.id])],
        equippedFlourishId: state.monarchPath === flourish.pathFlourish ? flourish.id : state.equippedFlourishId,
      };
      message = `<b>${flourish.name}</b><br/>Path flourish unlocked. It only personalizes your HUD once you have chosen that path at Job Change.`;
    }
  }

  return { patch, message };
}

/** One base roll, with at most one bounded bonus roll from an unlocked path skill. */
export function grantLoot(state: GameState, random = Math.random) {
  const working = { ...state };
  const attempts = 1 + Number(random() < pathBonuses(state).lootLuck);
  const messages: string[] = [];
  for (let i = 0; i < attempts; i++) {
    const roll = rollLoot(working.inventory, working.inventory, random);
    const { patch, message } = resolveLoot(working, roll);
    Object.assign(working, patch);
    if (message) messages.push(message);
  }
  return {
    patch: {
      inventory: working.inventory,
      equippedFlourishId: working.equippedFlourishId,
      hudTheme: working.hudTheme,
      gold: working.gold,
      potions: working.potions,
      relapseTokens: working.relapseTokens,
    },
    message: messages.join("<br/><br/>"),
  };
}