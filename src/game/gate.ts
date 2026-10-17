// Boss-gate math — one honest number on every boss door.
// The design keeps XP tied to real-world training (the System counts logged
// training, dungeon kills pay skill points), so a boss being "too high a level"
// is a REAL state players hit. These helpers make that state legible instead of
// a silent loss: before the hub has been seen once, the gate is a hard wall that
// explains the numbers; after that, it becomes a warning you can sign past.
export type BossGateDecision = "open" | "warn" | "block";

/**
 * open  — you meet or beat the recommended level: no friction at all.
 * warn  — under level, but the player has been through the hub's check-in once:
 *         the fight is offered with the numbers spelled out (soft gate).
 * block — under level AND the hub flow has not been seen yet: the door refuses
 *         and a gate line explains exactly what the number means and how to move it.
 */
export function bossGateDecision(opts: { playerLevel: number; recLevel: number; hubSeen: boolean }): BossGateDecision {
  if (!Number.isFinite(opts.recLevel)) return "open";
  if (opts.playerLevel >= opts.recLevel) return "open";
  return opts.hubSeen ? "warn" : "block";
}

export interface GateLine { who?: string; text: string }

/** The dialogue the gate speaks. Written in the System's voice, in-world. */
export function bossGateLines(bossName: string, rec: number, lv: number, mode: "block" | "warn"): GateLine[] {
  if (mode === "warn") {
    return [{
      who: "SYSTEM",
      text: `RATING GAP: ${bossName} is LV ${rec}. You are LV ${lv}. The gap will not negotiate and neither will it gloat — the contract is signable at your own risk. The door will not judge you twice.`,
    }];
  }
  return [
    {
      who: "SYSTEM",
      text: `CONTRACT RATING: LV ${rec}. YOUR RATING: LV ${lv}. CLEARANCE REQUIRED. The System has read both numbers and chosen the door.`,
    },
    {
      text: `Not today, ${bossName} — and the System hasn't the decency to sound sorry about it. Know the math: LEVELS ARE TRAINED, NOT GRINDED. Only logged training (the real-world ledger the System reads) raises the number on your plate. Dungeon kills pay SP, and SP buys the skill tree — [X] to spend. The tree sharpens; training outlevels. Both count. Neither is wasted.`,
    },
    {
      text: "Meanwhile the floor has jobs for you: check in with the handler, work the survey board, take the debts the journal [J] lists. Paperwork builds legends. Go be legible.",
    },
  ];
}
