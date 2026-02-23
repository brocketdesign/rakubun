import { useSyncExternalStore } from 'react';

export interface OnboardingStep {
  id: 'add-site' | 'create-article' | 'create-schedule' | 'create-cron-job';
  completed: boolean;
}

export interface OnboardingState {
  steps: OnboardingStep[];
  dismissed: boolean;
  completedAt: string | null;
}

const STORAGE_KEY = 'rakubun-onboarding';

function loadFromStorage(): { dismissed: boolean; completedAt: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { dismissed: false, completedAt: null };
}

function saveToStorage(data: { dismissed: boolean; completedAt: string | null }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

let state: OnboardingState = {
  steps: [
    { id: 'add-site', completed: false },
    { id: 'create-article', completed: false },
    { id: 'create-schedule', completed: false },
    { id: 'create-cron-job', completed: false },
  ],
  ...loadFromStorage(),
};

const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function getSnapshot(): OnboardingState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const onboardingActions = {
  /**
   * Update step completion based on actual store data.
   * Called reactively from the onboarding component.
   */
  updateStepCompletion(stepId: OnboardingStep['id'], completed: boolean): void {
    const step = state.steps.find((s) => s.id === stepId);
    if (!step || step.completed === completed) return;

    const updatedSteps = state.steps.map((s) =>
      s.id === stepId ? { ...s, completed } : s
    );

    const allComplete = updatedSteps.every((s) => s.completed);

    state = {
      ...state,
      steps: updatedSteps,
      completedAt: allComplete && !state.completedAt ? new Date().toISOString() : state.completedAt,
    };

    if (allComplete && !state.completedAt) {
      saveToStorage({ dismissed: state.dismissed, completedAt: state.completedAt });
    }

    emitChange();
  },

  dismiss(): void {
    state = { ...state, dismissed: true };
    saveToStorage({ dismissed: true, completedAt: state.completedAt });
    emitChange();
  },

  restore(): void {
    state = { ...state, dismissed: false };
    saveToStorage({ dismissed: false, completedAt: state.completedAt });
    emitChange();
  },

  reset(): void {
    state = {
      steps: [
        { id: 'add-site', completed: false },
        { id: 'create-article', completed: false },
        { id: 'create-schedule', completed: false },
        { id: 'create-cron-job', completed: false },
      ],
      dismissed: false,
      completedAt: null,
    };
    saveToStorage({ dismissed: false, completedAt: null });
    emitChange();
  },

  getCompletedCount(): number {
    return state.steps.filter((s) => s.completed).length;
  },

  getTotalCount(): number {
    return state.steps.length;
  },

  isAllComplete(): boolean {
    return state.steps.every((s) => s.completed);
  },
};

export function useOnboarding(): OnboardingState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
