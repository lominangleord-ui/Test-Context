import { useShallow } from "zustand/react/shallow";
import { useGame } from "../store/game";
import { useUi } from "../store/ui";
import { ITEMS, SHOP_ITEMS } from "../data";
import { getPath, MONARCH_PATHS, PATH_FLOURISH_IDS } from "../data/monarchPaths";
import { pathBonuses, shopCost } from "../lib/monarch";
import { SystemWindow } from "./SystemWindow";

export function InventoryModal() {
  const open = useUi((s) => s.inventoryOpen);
  const closeAll = useUi((s) => s.closeAll);
  const s = useGame(useShallow((state) => ({
    gold: state.gold,
    inventory: state.inventory,
    hudTheme: state.hudTheme,
    potions: state.potions,
    staminaDrafts: state.staminaDrafts,
    elixirs: state.elixirs,
    relapseTokens: state.relapseTokens,
    monarchPath: state.monarchPath,
    clearedGates: state.clearedGates,
    equippedFlourishId: state.equippedFlourishId,
    level: state.level,
    hp: state.hp,
    hpMax: state.hpMax,
    mp: state.mp,
    mpMax: state.mpMax,
    fatigueLevel: state.fatigueLevel,
    blocked: state.inLockdown || state.dead,
    buyItem: state.buyItem,
    equipItem: state.equipItem,
    consumePotion: state.consumePotion,
    consumeStamina: state.consumeStamina,
    consumeElixir: state.consumeElixir,
  })));

  if (!open) return null;
  const owned = ITEMS.filter((item) => s.inventory.includes(item.id));
  const path = getPath(s.monarchPath);
  const sigil = path ? PATH_FLOURISH_IDS[MONARCH_PATHS.findIndex((entry) => entry.id === path.id)] : null;
  const bonuses = pathBonuses(s);

  return (
    <div className="fixed inset-0 z-[65] sys-backdrop flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Inventory">
      <div className="w-full max-w-[520px] max-h-[88dvh] overflow-y-auto">
        <SystemWindow title="INVENTORY">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[15px] text-[color:var(--gold)]">{s.gold.toLocaleString()} GOLD</span>
            <button onClick={closeAll} className="sl-btn px-3 py-1 text-[10px]">CLOSE</button>
          </div>

          <p className="text-[12px] text-[color:var(--text-mid)] mb-3">
            Recovery and cosmetics only. Nothing in this shop increases XP.
          </p>
          <div className="space-y-2 mb-4">
            {SHOP_ITEMS.map((item) => {
              const cost = shopCost(s, item);
              const count = item.kind === "recovery" ? s.potions : item.kind === "stamina" ? s.staminaDrafts
                : item.kind === "elixir" ? s.elixirs : item.kind === "token" ? s.relapseTokens : Number(sigil !== null && s.inventory.includes(sigil));
              const canUse = count > 0 && !s.blocked && (
                item.kind === "recovery" ? s.hp < s.hpMax || s.mp < s.mpMax || (bonuses.potionFatigue > 0 && s.fatigueLevel > 0)
                  : item.kind === "stamina" ? s.fatigueLevel > 0
                    : item.kind === "elixir" ? s.hp < s.hpMax || s.mp < s.mpMax || s.fatigueLevel > 0
                      : false
              );
              const canBuy = !s.blocked && s.gold >= cost && (item.kind !== "sigil" || (path && sigil !== null && !s.inventory.includes(sigil)));
              const use = item.kind === "recovery" ? s.consumePotion : item.kind === "stamina" ? s.consumeStamina : s.consumeElixir;
              return (
                <div key={item.id} className="p-3 border border-[#ffffff12] bg-[#04101d66]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-sys text-[13px] font-semibold text-[color:var(--text-bright)]">{item.name}</div>
                      <div className="text-[11px] text-[color:var(--text)] mt-1">{item.desc}</div>
                      {item.kind === "recovery" && bonuses.potionFatigue > 0 && <div className="text-[10px] text-[color:var(--green)] mt-1">Frost skill: also clears {bonuses.potionFatigue} fatigue.</div>}
                      {item.kind === "stamina" && bonuses.draftPower > 0 && <div className="text-[10px] text-[color:var(--green)] mt-1">Legia skill: clears {40 + bonuses.draftPower} fatigue.</div>}
                    </div>
                    <span className="font-mono text-[12px] text-[color:var(--green)] shrink-0">{item.kind === "sigil" ? count ? "OWNED" : "COSMETIC" : `HELD ${count}`}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="sl-btn flex-1 text-[10px]" disabled={!canBuy} onClick={() => s.buyItem(item.id)}>
                      {item.kind === "sigil" && !path ? "JOB CHANGE REQUIRED" : item.kind === "sigil" && count ? "OWNED" : `BUY / ${cost} GOLD`}
                    </button>
                    {item.kind !== "sigil" && <button className="sl-btn sl-btn-gold flex-1 text-[10px]" disabled={!canUse} onClick={use}>
                      {item.kind === "token" ? "USE DURING LOCKDOWN" : "USE"}
                    </button>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="font-sys text-[9px] tracking-[0.3em] text-[color:var(--text-dim)] uppercase mb-2">HUD Themes & Path Sigils</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {owned.map((item) => {
              const selected = item.theme ? s.hudTheme === item.theme : s.equippedFlourishId === item.id;
              const available = !!item.theme || (s.monarchPath === item.pathFlourish && s.level >= 40);
              return (
                <button key={item.id} disabled={!available || s.blocked} onClick={() => s.equipItem(item.id)} aria-pressed={selected} className="p-3 border text-left transition-all" style={{
                  borderColor: selected ? "var(--cyan)" : "#ffffff12",
                  background: selected ? "var(--cyan-glow)" : "#04101d66",
                  opacity: available ? 1 : .55,
                }}>
                  <div className="font-sys text-[11px] font-semibold text-[color:var(--text-bright)]">{item.icon} {item.name}</div>
                  <div className="font-mono text-[9px] mt-2 text-[color:var(--cyan-bright)]">{available ? selected ? item.theme ? "ACTIVE" : "REMOVE FINISH" : "APPLY COSMETIC" : "AFTER MATCHING JOB CHANGE"}</div>
                </button>
              );
            })}
          </div>
          <p className="text-[10.5px] text-[color:var(--text)] mt-3">Theme colors are freely switchable. Sigils can drop before Job Change as teasers; their personal flourish only works for your chosen Monarch path after level 40.</p>
        </SystemWindow>
      </div>
    </div>
  );
}