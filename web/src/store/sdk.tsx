import { createContext, useContext, type ParentComponent } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { useNuiCustomEvent } from '../utils/useNui';
import { fetchNui } from '../utils/fetchNui';
import type { SDKModalPayload, SDKModalResult } from '../types/sdk';

export interface SDKState {
  activeModal: SDKModalPayload | null;
  queue: SDKModalPayload[];
}

export interface SDKActions {
  openModal: (payload: SDKModalPayload) => void;
  submitResult: (result: SDKModalResult) => void;
  cancelActive: () => void;
}

type SDKStore = [SDKState, SDKActions];

const SDKContext = createContext<SDKStore>();

const MAX_QUEUE = 5;
const TIMEOUT_MS = 60000;

export const SDKProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<SDKState>({
    activeModal: null,
    queue: [],
  });

  let timeoutTimer: number | undefined;

  const clearTimeout_ = () => {
    if (timeoutTimer) {
      window.clearTimeout(timeoutTimer);
      timeoutTimer = undefined;
    }
  };

  const startTimeout = () => {
    clearTimeout_();
    timeoutTimer = window.setTimeout(() => {
      if (state.activeModal) {
        cancelActive();
      }
    }, TIMEOUT_MS);
  };

  const showNext = () => {
    clearTimeout_();
    if (state.queue.length > 0) {
      const next = state.queue[0];
      setState(produce((s) => {
        s.queue.splice(0, 1);
        s.activeModal = next;
      }));
      startTimeout();
    } else {
      setState('activeModal', null);
    }
  };

  const submitResult = (result: SDKModalResult) => {
    clearTimeout_();
    fetchNui('phoneSDKResult', result);
    showNext();
  };

  const cancelActive = () => {
    const modal = state.activeModal;
    if (!modal) return;
    submitResult({
      requestId: modal.requestId,
      cancelled: true,
    });
  };

  const openModal = (payload: SDKModalPayload) => {
    if (!payload?.requestId) return;

    if (!state.activeModal) {
      setState('activeModal', payload);
      startTimeout();
    } else if (state.queue.length < MAX_QUEUE) {
      setState('queue', (q) => [...q, payload]);
    } else {
      fetchNui('phoneSDKResult', {
        requestId: payload.requestId,
        cancelled: true,
        error: 'QUEUE_FULL',
      });
    }
  };

  useNuiCustomEvent<SDKModalPayload>('gcphone:sdk:open', openModal);

  useNuiCustomEvent('gcphone:sdk:close', () => {
    clearTimeout_();
    setState({ activeModal: null, queue: [] });
  });

  useNuiCustomEvent<{ resourceName: string }>('gcphone:sdk:resourceStopped', (data) => {
    if (!data?.resourceName) return;
    setState('queue', (q) => q.filter((m) => m.resourceName !== data.resourceName));
    if (state.activeModal?.resourceName === data.resourceName) {
      showNext();
    }
  });

  const actions: SDKActions = { openModal, submitResult, cancelActive };

  return (
    <SDKContext.Provider value={[state, actions]}>
      {props.children}
    </SDKContext.Provider>
  );
};

export function useSDK(): SDKStore {
  const ctx = useContext(SDKContext);
  if (!ctx) throw new Error('useSDK must be used within SDKProvider');
  return ctx;
}

export function useSDKState() {
  const [state] = useSDK();
  return state;
}

export function useSDKActions() {
  const [, actions] = useSDK();
  return actions;
}
