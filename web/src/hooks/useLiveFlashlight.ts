import { createSignal, onCleanup, onMount } from 'solid-js';
import { fetchNui } from '../utils/fetchNui';

export interface FlashlightSettings {
  enabled?: boolean;
  kelvin?: number;
  lumens?: number;
  minKelvin?: number;
  maxKelvin?: number;
  minLumens?: number;
  maxLumens?: number;
}

export function useLiveFlashlight() {
  const [supported, setSupported] = createSignal(false);
  const [enabled, setEnabled] = createSignal(false);
  const [panelOpen, setPanelOpen] = createSignal(false);
  const [kelvin, setKelvin] = createSignal(5200);
  const [lumens, setLumens] = createSignal(1200);
  const [kelvinRange, setKelvinRange] = createSignal({ min: 2600, max: 9000 });
  const [lumensRange, setLumensRange] = createSignal({ min: 350, max: 2200 });

  let pressTimer: number | undefined;
  let longPressTriggered = false;

  const loadSettings = async () => {
    if (!supported()) return;

    const settings = await fetchNui<FlashlightSettings>('cameraGetFlashlightSettings', {}, {
      enabled: false,
      kelvin: 5200,
      lumens: 1200,
      minKelvin: 2600,
      maxKelvin: 9000,
      minLumens: 350,
      maxLumens: 2200,
    });

    setEnabled(settings.enabled === true);
    setKelvin(settings.kelvin || 5200);
    setLumens(settings.lumens || 1200);
    setKelvinRange({ min: settings.minKelvin || 2600, max: settings.maxKelvin || 9000 });
    setLumensRange({ min: settings.minLumens || 350, max: settings.maxLumens || 2200 });
  };

  const loadCapabilities = async () => {
    const capabilities = await fetchNui<{ flashlight?: boolean }>('cameraGetCapabilities', {}, { flashlight: false });
    const nextSupported = capabilities?.flashlight === true;
    setSupported(nextSupported);

    if (nextSupported) {
      await loadSettings();
    }
  };

  const saveSettings = async (next: { kelvin?: number; lumens?: number }) => {
    const result = await fetchNui<FlashlightSettings>('cameraSetFlashlightSettings', next, {
      kelvin: next.kelvin || kelvin(),
      lumens: next.lumens || lumens(),
    });

    if (typeof result.kelvin === 'number') setKelvin(result.kelvin);
    if (typeof result.lumens === 'number') setLumens(result.lumens);
  };

  const toggle = async () => {
    if (!supported()) return false;

    const nextState = !enabled();
    const result = await fetchNui<{ success?: boolean; enabled?: boolean }>('cameraToggleFlashlight', { enabled: nextState }, { success: true, enabled: nextState });
    if (result?.success) {
      const isEnabled = result.enabled === true;
      setEnabled(isEnabled);
      if (!isEnabled) {
        setPanelOpen(false);
      }
      return isEnabled;
    }

    return enabled();
  };

  const turnOff = async () => {
    if (!enabled()) return;

    const result = await fetchNui<{ success?: boolean; enabled?: boolean }>('cameraToggleFlashlight', { enabled: false }, { success: true, enabled: false });
    if (result?.success) {
      setEnabled(false);
      setPanelOpen(false);
    }
  };

  const applyPreset = async (nextKelvin: number, nextLumens = lumens()) => {
    setKelvin(nextKelvin);
    setLumens(nextLumens);
    await saveSettings({ kelvin: nextKelvin, lumens: nextLumens });
  };

  const beginPress = () => {
    if (!supported()) return;

    longPressTriggered = false;
    if (pressTimer) window.clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => {
      longPressTriggered = true;
      setPanelOpen(true);
      void loadSettings();
    }, 420);
  };

  const endPress = () => {
    if (pressTimer) {
      window.clearTimeout(pressTimer);
      pressTimer = undefined;
    }

    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }

    void toggle();
  };

  const cancelPress = () => {
    if (pressTimer) {
      window.clearTimeout(pressTimer);
      pressTimer = undefined;
    }
  };

  onMount(() => {
    void loadCapabilities();
  });

  onCleanup(() => {
    if (pressTimer) {
      window.clearTimeout(pressTimer);
    }
  });

  return {
    supported,
    enabled,
    panelOpen,
    kelvin,
    lumens,
    kelvinRange,
    lumensRange,
    setPanelOpen,
    setKelvin,
    setLumens,
    loadSettings,
    loadCapabilities,
    saveSettings,
    toggle,
    turnOff,
    applyPreset,
    beginPress,
    endPress,
    cancelPress,
  };
}
