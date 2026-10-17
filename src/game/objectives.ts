// Objective graph V3 — replaces the hand-rolled if-chain tracker.
// Today: nextObjective(flags, regionId) returns one hardcoded string per milestone,
// T marks "seen", and the chip vanishes — a player who skips it is on their own.
// V3: a DATA graph of nodes (MAIN chain, FORK groups, SIDE quests) + a pointer
// (diamond over the target, edge arrow off-screen, metres at 1 u = 10 m… precisely
// 1 m = 10 world units), with cross-floor routing that never points at a locked exit.
import type { WorldFlags } from "./world";
import type { Floor } from "./floor";

export type Route = "MERCY" | "BLOOD" | "NEUTRAL";
export interface ObjNode {
  id: string;
  kind: "MAIN" | "FORK" | "SIDE";
  group?: string;              // fork group id — parallel members
  route?: Route;               // labels stay neutral; never says which is "right"
  title: string;
  hint: string;                // no spoilers, never "best"/"correct"
  floor: string;               // where the target lives
  target: string;              // npc:<dialogueKey> · prop:<interactId> · exit:<floorId> · boss · x,y
  requires?: string[];         // all must be TRUE for the node to be ACTIVE
  done?: string[];             // ANY true marks the node completed
  side?: boolean;              // SIDE quests also list under sideQuest
}

// ---------- flag mini-language (shared with tests) ----------
// "hasKey" | "!gateOpen" | "met:seo.verdant" (count>0) | "bossDown:hobgoblin"
// | "sparedStory:kesh" | "visited:caverns" | "killsTotal>=14" | "sparedHare"
export function flagOn(expr: string, f: WorldFlags): boolean {
  const neg = expr.startsWith("!");
  const e = neg ? expr.slice(1) : expr;
  let v = false;
  const cmp = /^([A-Za-z]+)(>=|<=|>|<)(\d+)$/.exec(e);
  const colon = e.indexOf(":");
  if (cmp) {
    const lhs = (f as unknown as Record<string, number>)[cmp[1]] ?? 0;
    const n = Number(cmp[3]);
    v = cmp[2] === ">=" ? lhs >= n : cmp[2] === "<=" ? lhs <= n : cmp[2] === ">" ? lhs > n : lhs < n;
  } else if (colon > 0) {
    const [map, key] = [e.slice(0, colon), e.slice(colon + 1)];
    if (map === "met") v = ((f.met[key] ?? 0) as number) > 0;
    else if (map === "bossDown") v = !!f.bossDown[key];
    else if (map === "sparedStory") v = !!f.sparedStory[key];
    else if (map === "visited") v = !!(f as { visitedFloors?: Record<string, boolean> }).visitedFloors?.[key];
    else if (map === "bought") v = ((f.bought[key] ?? 0) as number) > 0;
    else v = !!(f as unknown as Record<string, Record<string, boolean>>)[map]?.[key];
  } else {
    v = !!(f as unknown as Record<string, boolean | number>)[e];
  }
  return neg ? !v : v;
}
const all = (xs: string[] | undefined, f: WorldFlags) => !xs || xs.every((x) => flagOn(x, f));
const any = (xs: string[] | undefined, f: WorldFlags) => !!xs && xs.some((x) => flagOn(x, f));

// ---------- the graph ----------
export const OBJECTIVES: ObjNode[] = [
  // — VERDANT RUINS —
  { id: "v-seo", kind: "MAIN", title: "Check in", hint: "Handler Seo waits at the plaza. Paperwork first, heroes later.", floor: "verdant", target: "npc:seo.verdant", done: ["met:seo.verdant"] },
  { id: "v-hana", kind: "MAIN", title: "Brief the survey team", hint: "Hana has the missing board's list. Find her among the columns.", floor: "verdant", target: "npc:hana.verdant", requires: ["met:seo.verdant"], done: ["met:hana.verdant"] },
  { id: "v-roan", kind: "SIDE", title: "The waiting fawn", hint: "Something fawn-coloured keeps turning up at the east shrine.", floor: "verdant", target: "npc:roan.verdant", side: true, done: ["met:roan.verdant", "killsTotal>=20"] },
  { id: "v-dog", kind: "SIDE", title: "A lost something", hint: "A kid at the plaza is looking for a pet. Dogs like rocks; rocks like dogs.", floor: "ashenveil", target: "npc:kid.lost", side: true, done: ["dogReturned"] },
  { id: "v-boss", kind: "MAIN", title: "The shrine's tenant", hint: "Someone lives at the north shrine and keeps it raked. Settle with the tenant — how is up to you.", floor: "verdant", target: "boss", requires: ["met:hana.verdant"], done: ["bossDown:hobgoblin"] },
  { id: "v-exit", kind: "MAIN", title: "Go up", hint: "The north arch opens when the floor's business is closed. The marsh is one floor above.", floor: "verdant", target: "exit:marsh", requires: ["bossDown:hobgoblin"], done: ["visited:marsh"] },
  // — SUNKEN MARSH —
  { id: "m-sila", kind: "MAIN", title: "Find the smuggler", hint: "The stilt village talks to SILA before it talks to anyone else.", floor: "marsh", target: "npc:sila.marsh", done: ["met:sila.marsh"] },
  { id: "m-reed", kind: "SIDE", title: "The polite drowning", hint: "A monk is drowning courteously in the south bog. South bog = south island.", floor: "marsh", target: "npc:reedwatcher.marsh", side: true, done: ["met:reedwatcher.marsh"] },
  { id: "m-boss", kind: "MAIN", title: "The idol on the top step", hint: "The drowned stair's idol woke up annoyed. Settle with it.", floor: "marsh", target: "boss", requires: ["met:sila.marsh"], done: ["bossDown:sentinel"] },
  { id: "m-exit", kind: "MAIN", title: "Climb down", hint: "Below the boardwalk a ladder descends into heat. The caverns want their six years back.", floor: "marsh", target: "exit:caverns", requires: ["bossDown:sentinel"], done: ["visited:caverns"] },
  // — ASHEN CAVERNS (fork: who do you learn from first) —
  { id: "c-help", kind: "FORK", group: "c-help", title: "Two under the lava", hint: "A retired master in the stal rooms; a service in the lava hall. Both will talk. Choose.", floor: "caverns", target: "npc:kang.caverns", done: ["met:kang.caverns"] },
  { id: "c-verity", kind: "FORK", group: "c-help", route: "NEUTRAL", title: "The lava hall service", hint: "The cult's service is open to attendance. Listening is load-bearing.", floor: "caverns", target: "npc:verity.caverns", done: ["met:verity.caverns"] },
  { id: "c-chains", kind: "SIDE", title: "Which way the chains strain", hint: "Before the boss hall: the chains. Somebody here knows them.", floor: "caverns", target: "npc:kang.caverns", side: true, requires: ["killsTotal>=12"], done: ["chainedTusk"] },
  { id: "c-boss", kind: "MAIN", title: "The tenant in the hall", hint: "Far east, past the second lava pool. The tenant is chained. Think about that sentence.", floor: "caverns", target: "boss", requires: ["met:kang.caverns", "met:verity.caverns"], done: ["bossDown:irontusk"] },
  { id: "c-exit", kind: "MAIN", title: "Ride the lift", hint: "The mine-lift at the hall's south end climbs to the Citadel. It was always running. That should bother you.", floor: "caverns", target: "exit:citadel", requires: ["bossDown:irontusk"], done: ["visited:citadel"] },
  // — MONARCH'S CITADEL —
  { id: "t-herald", kind: "MAIN", title: "The waiting room", hint: "A herald keeps the queue in the throne hall. Names matter here; yours does too.", floor: "citadel", target: "npc:herald.citadel", done: ["met:herald.citadel"] },
  { id: "t-pair", kind: "SIDE", title: "Forty-one names", hint: "The missing board is in the Citadel's keeping. Seo knows where you'd find it.", floor: "citadel", target: "npc:seo.citadel", side: true, done: ["savedPair"] },
  { id: "t-boss", kind: "MAIN", title: "The Warden of records", hint: "The Warden holds the ledger for this floor. Resolve it — either column.", floor: "citadel", target: "boss", requires: ["met:herald.citadel"], done: ["bossDown:warden"] },
  { id: "t-ceremony", kind: "MAIN", title: "The answer they want", hint: "After the Warden, someone asks you a question. Any answer moves the door. Refusing is an answer.", floor: "citadel", target: "boss", requires: ["bossDown:warden"], done: ["unregistered"] },
  { id: "t-exit", kind: "MAIN", title: "The unregistered door", hint: "The west door remembers your answer. Beyond it: the floor with your block's name on it.", floor: "citadel", target: "exit:ashenveil", requires: ["unregistered"], done: ["visited:ashenveil"] },
  // — ASHENVEIL (the fork the whole floor leans on) —
  { id: "a-town", kind: "MAIN", title: "Come home to the floor", hint: "The town is yours to walk again. The Gate is not where the story ends; the arch is.", floor: "ashenveil", target: "npc:shop.miso", done: ["met:shop.miso"] },
  { id: "a-key", kind: "SIDE", title: "The ridge key", hint: "The innkeep keeps something for a kid who lost a dog. Errands are a currency.", floor: "ashenveil", target: "npc:inn.baek", side: true, done: ["hasKey"] },
  { id: "a-gate", kind: "SIDE", title: "Open the ridge", hint: "With the key in your pocket, the gate wants turning.", floor: "ashenveil", target: "prop:gate", side: true, requires: ["hasKey"], done: ["gateOpen"] },
  { id: "a-arch", kind: "FORK", group: "a-final", route: "MERCY", title: "The arch", hint: "Under the arch waits what the floor made you. FIGHT and MERCY both exist here.", floor: "ashenveil", target: "prop:bossGate", done: ["sparedStory:alpha"] },
  { id: "a-final", kind: "FORK", group: "a-final", route: "BLOOD", title: "The den", hint: "If the count reached fourteen, the den has decided you are an audience.", floor: "ashenveil", target: "prop:bossGate", done: ["bossDown:alpha"] },
  { id: "a-end", kind: "MAIN", title: "The last page", hint: "The arch is the floor's door: go through with an answer ready.", floor: "ashenveil", target: "prop:bossGate", requires: ["met:shop.miso"], done: ["keshKilled", "sparedKesh"] },
];

// ---------- state: what is active / done ----------
export const nodeActive = (n: ObjNode, f: WorldFlags) => all(n.requires, f);
export const nodeDone = (n: ObjNode, f: WorldFlags) => any(n.done, f);
export function groupDone(group: string, f: WorldFlags): boolean {
  const members = OBJECTIVES.filter((n) => n.group === group);
  return members.some((m) => nodeDone(m, f)); // completing ONE resolves the group
}
export function nodeDoneEff(n: ObjNode, f: WorldFlags) {
  return nodeDone(n, f) || (n.group ? groupDone(n.group, f) : false);
}

export function openNodes(f: WorldFlags, kind?: ObjNode["kind"]): ObjNode[] {
  const out: ObjNode[] = [];
  const seenGroup = new Set<string>();
  for (const n of OBJECTIVES) {
    if (kind && n.kind !== kind) continue;
    if (n.kind === "SIDE" && kind === undefined) continue; // sides are opt-in; listed in the journal
    if (n.group) { if (groupDone(n.group, f) || seenGroup.has(n.group)) continue; seenGroup.add(n.group); }
    if (!nodeDoneEff(n, f) && nodeActive(n, f)) out.push(n);
  }
  return out;
}
export function journalRows(f: WorldFlags) {
  const rows: { node: ObjNode; done: boolean; active: boolean }[] = [];
  for (const n of OBJECTIVES) rows.push({ node: n, done: nodeDoneEff(n, f), active: !n.group ? nodeActive(n, f) : nodeActive(n, f) && !groupDone(n.group, f) });
  return rows;
}
/** The default tracked item: first open MAIN (or FORK group entry) in document order. */
export function defaultTracked(f: WorldFlags): ObjNode | null {
  const main = openNodes(f, "MAIN")[0] ?? openNodes(f, "FORK")[0] ?? null;
  return main;
}

// ---------- target resolution + pointer ----------
export type Target = { x: number; y: number; label: string; sealed?: boolean; kind: "here" | "exit" };

export function resolveTarget(node: ObjNode, floor: Floor, f: WorldFlags): Target | null {
  if (node.floor !== floor.id) return crossFloor(node, floor, f);
  const t = node.target;
  if (t.startsWith("npc:")) {
    const key = t.slice(4);
    const n = floor.objects.npcs.find((x) => x.dialogue === key);
    return n ? { x: n.x, y: n.y - 10, label: key.split(".")[0], kind: "here" } : null;
  }
  if (t.startsWith("prop:")) {
    const p = floor.objects.props.find((x) => x.interactId === t.slice(5));
    return p ? { x: p.x + p.w / 2, y: p.y + p.h - 8, label: t.slice(5), kind: "here" } : null;
  }
  if (t === "boss") {
    const b = floor.objects.boss;
    return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2, label: b.name, kind: "here" } : null;
  }
  if (t.startsWith("exit:")) {
    const e = floor.objects.exits.find((x) => x.to === t.slice(5));
    if (!e) return null;
    return exitTarget(e.to, floor, f);
  }
  const xy = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(t);
  if (xy) return { x: Number(xy[1]), y: Number(xy[2]), label: node.title, kind: "here" };
  return null;
}

function exitLocked(floor: Floor, to: string, f: WorldFlags): boolean {
  const e = floor.objects.exits.find((x) => x.to === to);
  if (!e) return true;
  const b = floor.objects.boss;
  if (b && !f.bossDown[b.id]) return true;
  if (e.requires && !flagOn(e.requires, f)) return true;
  return false;
}
function exitTarget(to: string, floor: Floor, f: WorldFlags): Target | null {
  const e = floor.objects.exits.find((x) => x.to === to);
  if (!e) return null;
  if (exitLocked(floor, to, f)) return { x: e.x + e.w / 2, y: e.y + e.h / 2, label: "SEALED", kind: "exit", sealed: true };
  return { x: e.x + e.w / 2, y: e.y + e.h / 2, label: `TO ${to.toUpperCase()}`, kind: "exit" };
}

/** Cross-floor routing: walk the exit graph toward the node's floor and point at
 *  the FIRST exit on the way — unless it is locked, then the pointer goes dark
 *  (never point at a locked exit; the journal still lists what to do here). */
export function crossFloor(node: ObjNode, floor: Floor, f: WorldFlags): Target | null {
  if (node.floor === floor.id) return null;
  const prev = new Map<string, string>(); // reached floor -> the floor it came from
  const seen = new Set([floor.id]);
  const q = [floor.id];
  let found = false;
  while (q.length && !found) {
    const cur = q.shift()!;
    for (const e of floorFor(cur).objects.exits) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, cur);
      if (e.to === node.floor) { found = true; break; }
      q.push(e.to);
    }
  }
  if (!found) return null;
  let hop = node.floor;
  while (prev.get(hop) && prev.get(hop) !== floor.id) hop = prev.get(hop)!;
  if (exitLocked(floor, hop, f)) return null; // never point at a locked exit
  return exitTarget(hop, floor, f);
}

// late-bound so floor.ts types stay out of the data file
import { makeFloor } from "./floor";
const floorCache = new Map<string, Floor>();
let floorForProvider: (id: string) => Floor = (id) => {
  let fl = floorCache.get(id);
  if (!fl) { fl = makeFloor(id); floorCache.set(id, fl); }
  return fl;
};
export const floorFor = (id: string) => floorForProvider(id);
export function provideFloorFactory(fn: (id: string) => Floor) { floorForProvider = (id) => { const fl = fn(id); floorCache.set(id, fl); return fl; }; }

export const METRES = (units: number) => Math.max(1, Math.round(units / 10)); // 1 m = 10 world units
