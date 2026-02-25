export type V4ToastTone = "info" | "success" | "warning" | "error";

export type V4Toast = {
  id: string;
  message: string;
  tone: V4ToastTone;
};

export type V4ToastQueueState = {
  visible: V4Toast[];
  queued: V4Toast[];
  maxVisible: number;
};

export function createInitialToastQueueState(maxVisible = 2): V4ToastQueueState {
  if (maxVisible < 1) {
    throw new Error("maxVisible must be at least 1.");
  }
  return {
    visible: [],
    queued: [],
    maxVisible
  };
}

export function enqueueToast(state: V4ToastQueueState, toast: V4Toast): V4ToastQueueState {
  const existingIds = new Set([...state.visible, ...state.queued].map((item) => item.id));
  if (existingIds.has(toast.id)) {
    return state;
  }
  if (state.visible.length < state.maxVisible) {
    return {
      ...state,
      visible: [...state.visible, toast]
    };
  }
  return {
    ...state,
    queued: [...state.queued, toast]
  };
}

export function dismissToast(state: V4ToastQueueState, toastId: string): V4ToastQueueState {
  const visibleIndex = state.visible.findIndex((toast) => toast.id === toastId);
  if (visibleIndex >= 0) {
    const visible = [...state.visible];
    visible.splice(visibleIndex, 1);
    const queued = [...state.queued];
    if (queued.length > 0 && visible.length < state.maxVisible) {
      const next = queued.shift();
      if (next) {
        visible.push(next);
      }
    }
    return {
      ...state,
      visible,
      queued
    };
  }

  const queuedIndex = state.queued.findIndex((toast) => toast.id === toastId);
  if (queuedIndex >= 0) {
    const queued = [...state.queued];
    queued.splice(queuedIndex, 1);
    return {
      ...state,
      queued
    };
  }

  return state;
}

