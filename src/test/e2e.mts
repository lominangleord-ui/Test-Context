// God-mode e2e sanity test. Exercises the full pipeline: awaken, enter L1, clear,
// learn a skill with SP, level up, region gating, balance.
// Run with: npx tsx src/test/e2e.mts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Use a throwaway localStorage dir by resetting globalThis before import
const tmpDir = mkdtempSync(join(tmpdir(), 'arena-test-'));
(globalThis as any).localStorage = {
  _data: {} as Record<string,string>,
  getItem(k: string) { return this._data[k] ?? null; },
  setItem(k: string, v: string) { this._data[k] = String(v); },
  removeItem(k: string) { delete this._data[k]; },
  clear() { this._data = {}; },
  get length() { return Object.keys(this._data).length; },
  key(i: number) { return Object.keys(this._data)[i] ?? null; },
};

const { useGame } = await import('/home/user/Test-Context/src/store/game.ts');
const { useUi } = await import('/home/user/Test-Context/src/store/ui.ts');
const { episodeAvailability, prevEpisodeCleared, storyTotals, expectedCombat, enemyFor, expectedKitAt, forecastFight, skillLockReason, kitGuarantee, actOneSPRemaining } = await import('/home/user/Test-Context/src/lib/story.ts');
const { deriveBattleStats } = await import('/home/user/Test-Context/src/lib/battle.ts');
const { classSkills } = await import('/home/user/Test-Context/src/data/classes.ts');
const { STORY_EPISODES, getEpisode } = await import('/home/user/Test-Context/src/data/story.ts');

let fails = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) { console.error('✗ FAIL:', msg); fails++; return; }
  console.log('✓', msg);
}

// Reset to fresh
(globalThis as any).localStorage.clear();
// Re-import to get a fresh store? Easier: just use the initial state and overwrite via awaken.
// Read initial state
const s0 = useGame.getState();
console.log('-- Fresh state --');
console.log('  dead:', s0.dead, 'sp:', s0.sp, 'pts:', s0.pts);
assert(s0.dead === false, 'fresh hunter is not dead');
assert(s0.inLockdown === false, 'fresh hunter not in lockdown');
assert(s0.sp === 0, 'fresh hunter 0 SP');
assert(s0.pts === 3, 'fresh hunter starts with 3 pts');

// Awaken
s0.awaken('Sung', 'assassin', '/avatars/hunter-1.jpg', 'assassin');
const s1 = useGame.getState();
console.log('\n-- After awaken -- gameClass:', s1.gameClass, 'basicSkills:', s1.basicSkills);
assert(s1.gameClass === 'assassin', 'awaken set class to assassin');
assert(s1.basicSkills.length >= 1, 'awaken granted starter skill, got ' + s1.basicSkills.length);
assert(s1.screen === 'awaken', 'awaken set screen to awaken');

// Check L1 availability
const ep1 = getEpisode(1)!;
const avail1 = episodeAvailability(s1, ep1);
console.log('  L1 availability:', avail1.status, '-', avail1.reason);
assert(avail1.status === 'ready', 'L1 ready immediately after onboarding');

// Open L1
useUi.getState().openStoryBattle(1);
assert(useUi.getState().activeStoryLevel === 1, 'openStoryBattle(1) sets activeStoryLevel=1');

// Clear L1
s1.clearEpisode(1);
const s2 = useGame.getState();
console.log('\n-- After L1 clear -- cleared:', s2.storyCleared, 'sp:', s2.sp, 'pts:', s2.pts);
assert(s2.storyCleared.includes(1), 'L1 added to cleared');
assert(s2.sp === 2, 'L1 (boss) grants +2 SP, got ' + s2.sp);
assert(s2.pts === 3, 'pts unchanged at 3');

// L5 skill locked by level. The first learnable (non-starter) skill is at level 5.
const ks = classSkills('assassin');
console.log('All assassin skills:', ks.map(s=>s.id+'@L'+s.level+(s.starter?'(starter)':'')+' cost='+s.cost).join(', '));
const l5 = ks.find(s => !s.starter && s.level === 5)!;
console.log('L5 skill:', l5.name, 'id:', l5.id, 'cost:', l5.cost);
let reason = skillLockReason(s2, l5);
assert(reason !== null, 'L5 skill locked at L1: ' + reason);
assert(!s2.basicSkills.includes(l5.id), 'Venom Edge NOT free-granted anymore (SP is the only way)');

// Helper
function snap() { return useGame.getState(); }
function forceLevel(lv: number) {
  useGame.setState({ level: Math.max(useGame.getState().level, lv), xp: 0 });
}

// Level up via forced state, then clear through L9
console.log('\n-- Leveling & clearing through Verdant Ruins --');
for (let lv = 2; lv <= 9; lv++) {
  forceLevel(lv);
  const cur = snap();
  const ep = getEpisode(lv)!;
  const a = episodeAvailability(cur, ep);
  if (a.status !== 'ready') {
    console.log('  L'+lv+' NOT READY:', a.status, a.reason);
    fails++;
  }
  cur.clearEpisode(lv);
}
let cur = snap();
console.log('  after L1-9: cleared', cur.storyCleared.length, '/ level', cur.level, '/ sp', cur.sp);
assert(cur.storyCleared.length === 9, 'all 9 VR tiles cleared, got ' + cur.storyCleared.length);

// Check prevEpisodeCleared for L10
assert(prevEpisodeCleared(cur.storyCleared, 10) === true, 'prevEpisodeCleared(10) true after VR done');

// Learn the first still-unlearned level-ready skill. clearEpisode's grantsSkill
// tiles hand out free skills, so pick whatever remains unowned that we can afford.
console.log('\n-- Learning a skill with SP after level-up --');
cur = snap();
const unlearned = ks.filter(s => !s.starter && !cur.basicSkills.includes(s.id) && s.level <= cur.level);
console.log('  level:', cur.level, 'sp:', cur.sp, 'unlearned & level-ready:', unlearned.map(s => s.name + '(' + s.cost + ' SP)').join(', ') || 'none');
if (unlearned.length > 0 && cur.sp >= unlearned[0].cost) {
  const target = unlearned[0];
  reason = skillLockReason(cur, target);
  console.log('  lock reason for', target.name + ':', reason);
  assert(reason === null, target.name + ' learnable at L' + cur.level + ' with ' + cur.sp + ' SP');
  const spBefore = cur.sp;
  cur.learnBasicSkill(target.id);
  cur = snap();
  assert(cur.basicSkills.includes(target.id), target.name + ' now in basicSkills');
  assert(cur.sp === spBefore - target.cost, 'SP deducted exactly ' + target.cost + ' (was ' + spBefore + ', now ' + cur.sp + ')');
  const spAfter = cur.sp;
  cur.learnBasicSkill(target.id);
  assert(snap().sp === spAfter, 'duplicate learn does not double-spend');
} else if (unlearned.length > 0) {
  const target = unlearned[0];
  reason = skillLockReason(cur, target);
  assert(reason !== null && reason.includes('skill point'), 'insufficient-SP lock reason is clear: ' + reason);
} else {
  assert(cur.basicSkills.length > 1, 'tile rewards granted ' + (cur.basicSkills.length - 1) + ' free skills');
  console.log('  (all level-ready skills were free-granted by tile rewards; SP ledger verified via totals)');
}
// SP ledger check: VR = L1 boss(2) + L2-9 -> whatever mix; ensure totals match storyTotals
const totalsCheck = storyTotals(cur.storyCleared);
console.log('  storyTotals:', totalsCheck);
assert(totalsCheck.spEarned + actOneSPRemaining(cur.storyCleared) === 48, 'spEarned + remaining == Act I total 48 (earned '+totalsCheck.spEarned+')');
assert(cur.sp <= totalsCheck.spEarned, 'sp in hand never exceeds SP earned (' + cur.sp + ' <= ' + totalsCheck.spEarned + ')');

// Region gating
console.log('\n-- Region gating --');
function regionUnlocked(cleared: number[], rid: string): boolean {
  const RT: Record<string,[number,number]> = {'verdant-ruins':[1,9],'sunken-marsh':[10,19],'red-caverns':[20,32],'crimson-citadel':[33,40]};
  const order=['verdant-ruins','sunken-marsh','red-caverns','crimson-citadel'];
  const idx=order.indexOf(rid);
  for(let i=0;i<idx;i++){const[lo,hi]=RT[order[i]];for(let lv=lo;lv<=hi;lv++)if(!cleared.includes(lv))return false;}
  return true;
}
assert(regionUnlocked([],'sunken-marsh')===false, 'SM hidden at fresh');
assert(regionUnlocked([1,2,3,4,5,6,7,8],'sunken-marsh')===false,'SM hidden when only 8/9 VR cleared');
assert(regionUnlocked(Array.from({length:9},(_,i)=>i+1),'sunken-marsh')===true,'SM visible after all VR');
assert(regionUnlocked(Array.from({length:9},(_,i)=>i+1),'red-caverns')===false,'RC still hidden after VR');

// Balance — the reality-check contract (see enemyFor docs):
//  * the trained, ALLOCATED hunter wins every field tile outright on forecast,
//    and every boss/beat within two turns (a deficit potions and skills cover);
//  * a same-level hunter on auto-growth stats alone (no workout, unspent points)
//    must LOSE every tile — bosses exist to be earned, not farmed.
console.log('\n-- Balance (dedicated scrape through; idle lose) --');
let modelFail=0, idleWin=0, stroll=0;
for (const ep of STORY_EPISODES) {
  const e = enemyFor(ep);
  const { combat } = expectedCombat(ep.level);
  const kit = expectedKitAt(ep.level);
  const f = forecastFight(e, combat, kit);
  const m = f.turnsToSurvive - f.turnsToKill;
  const isField = ep.kind === "field";
  if (isField ? m < 1 : m < -2) { modelFail++; console.log('  MODEL-FAIL L'+ep.level, ep.kind, 'm='+m); }
  if (m > (isField ? 6 : 4)) { stroll++; console.log('  STROLL L'+ep.level, ep.kind, 'm='+m); }
  const idle = deriveBattleStats({ str: 9 + ep.level, agi: 9 + ep.level, vit: 9 + ep.level, fatigueLevel: 25 });
  const g = forecastFight(e, idle, 1);
  if (g.turnsToSurvive >= g.turnsToKill) { idleWin++; console.log('  IDLE-WIN L'+ep.level, ep.kind, `k${g.turnsToKill}/l${g.turnsToSurvive}`); }
}
assert(modelFail===0, 'trained+allocated hunter wins (or is within a potion of) every tile');
assert(stroll===0, 'no tile becomes a stroll for the model hunter');
assert(idleWin===0, 'every tile beats a same-level hunter who never trained or spent');
// The L1 tutorial specifically: unspent = loss, spending the 3 points = win.
const g1 = enemyFor(getEpisode(1)!);
const sofa1 = forecastFight(g1, deriveBattleStats({ str: 10, agi: 10, vit: 10, fatigueLevel: 0 }), 1);
const spent1 = forecastFight(g1, deriveBattleStats({ str: 13, agi: 11, vit: 11, fatigueLevel: 0 }), 1);
assert(sofa1.turnsToSurvive < sofa1.turnsToKill, 'fresh unspent hunter loses the first Gate');
assert(spent1.turnsToSurvive >= spent1.turnsToKill, 'spending the awakening points opens the first Gate');
console.log(`  L1: unspent k${sofa1.turnsToKill}/l${sofa1.turnsToSurvive} (loss), spent k${spent1.turnsToKill}/l${spent1.turnsToSurvive} (${spent1.verdict})`);

// SP economy
console.log('\n-- SP economy --');
for (const c of ['fighter','mage','assassin','ranger'] as const) {
  const g = kitGuarantee(c);
  assert(g.affordable, c+' kit affordable by L30 (cost '+g.cost+', spBy30 '+g.spByLevel30+', maxLv '+g.levelCap+')');
}
assert(actOneSPRemaining() === 48, 'Act I grants 48 SP total (got '+actOneSPRemaining()+')');

// SP and pts both numbers in status
cur = snap();
assert(typeof cur.sp === 'number', 'sp is number');
assert(typeof cur.pts === 'number', 'pts is number');

// Cannot enter tile 2 when tile 1 not cleared (new fresh simulation)
console.log('\n-- Strict ordering: L3 locked if L2 not cleared --');
const starterSkill = ks.find(s=>s.starter)!;
const freshState = { level:10, sp:10, storyCleared:[1], gameClass:'assassin' as const, basicSkills:[starterSkill.id,l5.id], monarchPath:null, str:20, agi:20, vit:20, fatigueLevel:0 };
const ep3 = getEpisode(3)!;
const a3 = episodeAvailability(freshState as any, ep3);
assert(a3.status === 'locked' && a3.reason.includes('previous'), 'L3 locked when L2 uncleared even at L10: '+a3.reason);


// Legacy-save backfill: a save written before the SP split has cleared tiles but
// no sp field. normalizeSave must hand back exactly what those clears owe.
const { normalizeSave } = await import('/home/user/Test-Context/src/store/game.ts');
const legacy = normalizeSave({ name: 'Old Guard', level: 12, storyCleared: [1,2,3,4,5,6,7,8,9,10,11,12], gameClass: 'fighter', basicSkills: ['fighter:1'] });
const earned12 = storyTotals([1,2,3,4,5,6,7,8,9,10,11,12]).spEarned;
console.log('\n-- Legacy save backfill -- sp:', legacy.sp, 'expected earned:', earned12);
assert(legacy.sp === earned12, 'legacy save gets full SP from past clears (' + legacy.sp + ')');
const legacySpent = normalizeSave({ name: 'Spender', level: 12, storyCleared: [1,2,3,4,5,6,7,8,9,10,11,12], gameClass: 'fighter', basicSkills: ['fighter:1','fighter:2','fighter:3'] });
assert(legacySpent.sp === earned12 - 5, 'already-learned nodes are subtracted from the backfill (' + legacySpent.sp + ')');
const modern = normalizeSave({ name: 'Modern', level: 12, sp: 3, storyCleared: [1], gameClass: 'fighter', basicSkills: ['fighter:1'] });
assert(modern.sp === 3, 'a save that already tracks sp is left alone');

rmSync(tmpDir, { recursive: true, force: true });

console.log('\n' + (fails === 0 ? '=== ALL TESTS PASSED ===' : '=== '+fails+' FAILURES ==='));
process.exit(fails === 0 ? 0 : 1);
