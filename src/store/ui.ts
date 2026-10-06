import { create } from "zustand";
import type { CameraExercise, CameraPurpose, TierNumber } from "../types";
import { PATH_TIERS, pathForClass } from "../data/monarchPaths";
import { getEpisode } from "../data/story";
import { episodeAvailability } from "../lib/story";
import { useGame } from "./game";
import { audio, voice } from "../lib/audio";

interface UiState {
  inventoryOpen: boolean;
  settingsOpen: boolean;
  avatarOpen: boolean;
  skillTreeOpen: boolean;
  camExercise: CameraExercise | null;
  camPurpose: CameraPurpose;
  activeGateBattle: TierNumber | null;
  activeStoryLevel: number | null;
  openInventory: () => void;
  openSettings: () => void;
  openAvatar: () => void;
  toggleSkillTree: () => void;
  closeSkillTree: () => void;
  closeAll: () => void;
  openCamera: (ex: CameraExercise, penalty?: boolean, purpose?: CameraPurpose) => void;
  openGateBattle: (tier: TierNumber) => void;
  closeGateBattle: () => void;
  openStoryBattle: (level: number) => void;
  closeStoryBattle: () => void;
  closeCamera: () => void;
}

export const useUi = create<UiState>((set) => ({
  inventoryOpen: false,
  settingsOpen: false,
  avatarOpen: false,
  skillTreeOpen: false,
  camExercise: null,
  camPurpose: "daily",
  activeGateBattle: null,
  activeStoryLevel: null,
  openInventory: () => set({ inventoryOpen: true }),
  openSettings: () => set({ settingsOpen: true }),
  openAvatar: () => set({ avatarOpen: true }),
  toggleSkillTree: () => set((s) => ({ skillTreeOpen: !s.skillTreeOpen })),
  closeSkillTree: () => set({ skillTreeOpen: false }),
  closeAll: () =>
    set({ inventoryOpen: false, settingsOpen: false, avatarOpen: false, skillTreeOpen: false, activeGateBattle: null, activeStoryLevel: null }),
  openCamera: (ex, penalty = false, purpose = "daily") => {
    audio.unlock();
    if (useGame.getState().settings.voiceCounting) voice.say("Camera verification ready");
    if (!penalty && purpose === "daily") useGame.getState().lockDailyTargets();
    set({ camExercise: ex, camPurpose: penalty ? "penalty" : purpose });
  },
  openGateBattle: (tier) => {
    const state = useGame.getState();
    const path = pathForClass(state.gameClass);
    const band = PATH_TIERS[tier - 1];
    if (!path || !band || state.level < band.min || state.dead || state.inLockdown) return;
    audio.unlock();
    if (state.settings.voiceCounting) voice.say("Gate battle ready");
    set({ activeGateBattle: tier });
  },
  closeGateBattle: () => set({ activeGateBattle: null }),
  openStoryBattle: (level) => {
    const state = useGame.getState();
    const episode = getEpisode(level);
    if (!episode || state.dead || state.inLockdown) return;
    const availability = episodeAvailability(state, episode);
    if (availability.status !== "ready" && availability.status !== "cleared") return;
    audio.unlock();
    if (state.settings.voiceCounting) voice.say(`${episode.enemy} engaged`);
    set({ activeStoryLevel: level });
  },
  closeStoryBattle: () => set({ activeStoryLevel: null }),
  closeCamera: () => set({ camExercise: null, camPurpose: "daily" }),
}));
