import { createContext, useContext, ParentComponent, createMemo } from 'solid-js';
import { usePhoneState } from '../../../store/phone';
import type { IconShape } from '../../../types/home';

const ICON_SHAPE_RADIUS: Record<IconShape, string> = {
  squircle: '16px',
  circle: '50%',
  rounded: '8px',
  square: '0px',
};

interface IconPackContextValue {
  shape: () => IconShape;
  borderRadius: () => string;
}

const IconPackContext = createContext<IconPackContextValue>();

export const IconPackProvider: ParentComponent = (props) => {
  const state = usePhoneState();
  const shape = createMemo<IconShape>(() => (state.settings.iconShape as IconShape) || 'squircle');
  const borderRadius = createMemo(() => ICON_SHAPE_RADIUS[shape()]);

  return (
    <IconPackContext.Provider value={{ shape, borderRadius }}>
      {props.children}
    </IconPackContext.Provider>
  );
};

export function useIconPack() {
  const ctx = useContext(IconPackContext);
  if (!ctx) throw new Error('useIconPack must be used within IconPackProvider');
  return ctx;
}
