// Estado de UI efêmero (Zustand): rascunho do onboarding + modo responsável.
import { create } from "zustand";

export interface OnboardingDraft {
  consents: { account: boolean; ai_generation: boolean; progress_tracking: boolean; email_updates: boolean };
  display_name: string;
  birth_year: number | null;
  institution_id: string;
  class_id: string;
  grade: string;
  subjects: string[];
  priority_subject: string | null;
  prova: { title: string; exam_date: string; subject_id: string | null } | null;
}

const emptyDraft = (): OnboardingDraft => ({
  consents: { account: false, ai_generation: false, progress_tracking: false, email_updates: false },
  display_name: "",
  birth_year: null,
  institution_id: "bncc-padrao",
  class_id: "",
  grade: "",
  subjects: [],
  priority_subject: null,
  prova: null,
});

interface UIState {
  draft: OnboardingDraft;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
  resetDraft: () => void;
  parentMode: boolean; // gate do responsável destravado
  setParentMode: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  draft: emptyDraft(),
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  resetDraft: () => set({ draft: emptyDraft() }),
  parentMode: false,
  setParentMode: (v) => set({ parentMode: v }),
}));
