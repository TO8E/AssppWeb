import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeType = "light" | "dark" | "system";

interface SettingsState {
  defaultCountry: string;
  defaultEntity: "iPhone" | "iPad";
  theme: ThemeType;
  privacyMode: boolean;
  autoFetchVersionNumbers: boolean;
  setDefaultCountry: (country: string) => void;
  setDefaultEntity: (entity: "iPhone" | "iPad") => void;
  setTheme: (theme: ThemeType) => void;
  setPrivacyMode: (enabled: boolean) => void;
  setAutoFetchVersionNumbers: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultCountry: "US",
      defaultEntity: "iPhone",
      theme: "light",
      privacyMode: false,
      autoFetchVersionNumbers: false,
      setDefaultCountry: (country) => set({ defaultCountry: country }),
      setDefaultEntity: (entity) => set({ defaultEntity: entity }),
      setTheme: (theme) => set({ theme }),
      setPrivacyMode: (privacyMode) => set({ privacyMode }),
      setAutoFetchVersionNumbers: (autoFetchVersionNumbers) => set({ autoFetchVersionNumbers }),
    }),
    {
      name: "asspp-settings",
    },
  ),
);
