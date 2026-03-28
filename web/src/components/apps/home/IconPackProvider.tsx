import { createContext, useContext, ParentComponent, createMemo } from 'solid-js';
import { usePhoneState } from '../../../store/phone';
import type { IconShape } from '../../../types/home';

const ICON_SHAPE_CLASS: Record<IconShape, string> = {
  squircle: 'icon-squircle',
  circle: 'icon-circle',
  rounded: 'icon-rounded',
  square: 'icon-square',
};

interface IconPackContextValue {
  shape: () => IconShape;
  className: () => string;
}

const IconPackContext = createContext<IconPackContextValue>();

export const IconPackProvider: ParentComponent = (props) => {
  const state = usePhoneState();
  const shape = createMemo<IconShape>(() => (state.settings.iconShape as IconShape) || 'squircle');
  const className = createMemo(() => ICON_SHAPE_CLASS[shape()]);

  return (
    <IconPackContext.Provider value={{ shape, className }}>
      {props.children}
    </IconPackContext.Provider>
  );
};

export function useIconPack() {
  const ctx = useContext(IconPackContext);
  if (!ctx) throw new Error('useIconPack must be used within IconPackProvider');
  return ctx;
}
