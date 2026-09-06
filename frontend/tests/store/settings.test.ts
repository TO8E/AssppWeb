import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "../../src/store/settings";

describe("store/settings", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the zustand store
    useSettingsStore.setState({
      defaultCountry: "US",
      defaultEntity: "iPhone",
      privacyMode: false,
    });
  });

  it("should have default country US", () => {
    const state = useSettingsStore.getState();
    expect(state.defaultCountry).toBe("US");
  });

  it("should have default entity iPhone", () => {
    const state = useSettingsStore.getState();
    expect(state.defaultEntity).toBe("iPhone");
  });

  it("should update default country", () => {
    useSettingsStore.getState().setDefaultCountry("GB");
    expect(useSettingsStore.getState().defaultCountry).toBe("GB");
  });

  it("should update default entity", () => {
    useSettingsStore.getState().setDefaultEntity("iPad");
    expect(useSettingsStore.getState().defaultEntity).toBe("iPad");
  });

  it('persists privacy mode and restores it after rehydration', async () => {
    useSettingsStore.getState().setPrivacyMode(true);
    const persisted = localStorage.getItem('asspp-settings')!;
    expect(JSON.parse(persisted).state.privacyMode).toBe(true);
    useSettingsStore.setState({ privacyMode: false });
    localStorage.setItem('asspp-settings', persisted);
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().privacyMode).toBe(true);
  });

  it('keeps existing settings compatible when privacy mode is absent', async () => {
    localStorage.setItem('asspp-settings', JSON.stringify({ state: { theme: 'dark' }, version: 0 }));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(useSettingsStore.getState().privacyMode).toBe(false);
  });
});
