import { create } from "zustand";
import type { CameraExercise, CameraPurpose, TierNumber } from "../types";
import { getPath, PATH_TIERS } from "../data/monarchPaths";
import { useGame } from "./game";
import { audio, voice } from "../lib/audio";

interface UiState {
  inventoryOpen: boolean;
  settingsOpen: boolean;
  avatarOpen: boolean;
  camExercise: CameraExercise | null;
  camPurpose: CameraPurpose;
  activeGateBattle: TierNumber | null;
  openInventory: () => void;
  openSettings: () => void;
  openAvatar: () => void;
  closeAll: () => void;
  openCamera: (ex: CameraExercise, penalty?: boolean, purpose?: CameraPurpose) => void;
  openGateBattle: (tier: TierNumber) => void;
  closeGateBattle: () => void;
  closeCamera: () => void;
}

export const useUi = create<UiState>((set) => ({
  inventoryOpen: false,
  settingsOpen: false,
  avatarOpen: false,
  camExercise: null,
  camPurpose: "daily",
  activeGateBattle: null,
  openInventory: () => set({ inventoryOpen: true }),
  openSettings: () => set({ settingsOpen: true }),
  openAvatar: () => set({ avatarOpen: true }),
  closeAll: () =>
    set({ inventoryOpen: false, settingsOpen: false, avatarOpen: false, activeGateBattle: null }),
  openCamera: (ex, penalty = false, purpose = "daily") => {
    audio.unlock();
    if (useGame.getState().settings.voiceCounting) voice.say("Camera verification ready");
    if (!penalty && purpose === "daily") useGame.getState().lockDailyTargets();
    set({ camExercise: ex, camPurpose: penalty ? "penalty" : purpose });
  },
  openGateBattle: (tier) => {
    const state = useGame.getState();
    const path = getPath(state.monarchPath);
    const band = PATH_TIERS[tier - 1];
    if (!path || !band || state.level < band.min || state.dead || state.inLockdown) return;
    audio.unlock();
    if (state.settings.voiceCounting) voice.say("Gate battle ready");
    set({ activeGateBattle: tier });
  },
  closeGateBattle: () => set({ activeGateBattle: null }),
  closeCamera: () => set({ camExercise: null, camPurpose: "daily" }),
}));
