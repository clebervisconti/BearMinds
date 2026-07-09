// Contratos compartilhados server ⇄ client (tipos puros, sem runtime).
// Fonte única da verdade para os artefatos de geração (spec 05) e o payload da API.

export type AgeBand = "8-10" | "11-14" | "15-18";
export type Lang = "pt" | "en";
export type ArtifactKind = "lesson" | "explorable" | "quiz";
export type ConsentScope = "account" | "ai_generation" | "progress_tracking" | "email_updates" | "media_recording";

// ---------- Artefatos gerados ----------
export interface LessonSection {
  claim: string;
  explanation: string;
  source_id: string; // id do chunk que embasa a afirmação (grounding)
}
export interface Lesson {
  refused: boolean;
  reason?: string | null;
  warmup_question: string; // think-first: mostrada ANTES de qualquer conteúdo
  sections: LessonSection[];
  recap_questions: string[];
  companion_note: string; // fala do 🐻
}

export interface Explorable {
  title: string;
  instruction: string;
  html: string;
  css: string;
  js: string;
  success_check?: string;
}

export type QuizKind = "mcq" | "numeric" | "short";
export interface QuizQuestion {
  id: string;
  atom_id: string | null;
  kind: QuizKind;
  prompt: string;
  options?: string[]; // mcq
  answer_index?: number; // mcq
  answer_number?: number; // numeric
  accept?: string[]; // short (respostas aceitas, normalizadas)
  needs_math_check?: boolean;
  hints: [string, string, string]; // 3 dicas socráticas em camadas (nunca a resposta antes da 3ª)
  misconception_feedback?: Record<string, string>;
  explanation: string; // revelado só após acerto ou esgotar tentativas
}
export interface Quiz {
  questions: QuizQuestion[];
}

export interface Citation {
  id: string;
  ref: string;
}

// Bundle retornado por POST /api/generate
export interface GenerateBundle {
  bncc_code: string;
  grade: string;
  grade_band: string;
  age_band: AgeBand;
  lang: Lang;
  title: string;
  cached: boolean;
  lesson: Lesson;
  explorable: Explorable | null;
  quiz: Quiz;
  citations: Citation[];
  atoms: { id: string; text: string }[];
}

// ---------- Catálogo ----------
export interface InstitutionClass {
  id: string;
  label: string;
  grade_equiv: string;
  age: string;
}
export interface InstitutionSubject {
  id: string;
  label: string;
  icon: string;
  lang: Lang;
}
export interface Institution {
  id: string;
  name: string;
  kind: "default" | "network" | "school";
  classes: InstitutionClass[];
  subjects: InstitutionSubject[];
  terms: string[];
}
export interface TopicNode {
  bncc_code: string;
  title: string;
  description: string;
  has_cache: boolean;
  atom_count: number;
}
export interface TopicCandidate {
  bncc_code: string;
  description: string;
  title: string;
  confidence: number;
}

// ---------- Auth / perfis ----------
export type ProfileKind = "self" | "child";
export interface Child {
  id: string;
  display_name: string;
  birth_year: number;
  grade: string;
  age_band: AgeBand;
  institution_id: string | null;
  class_id: string | null;
  subjects: string[];
  priority_subject: string | null;
  avatar_seed: string | null;
  kind: ProfileKind;
  leaderboard_hidden: boolean;
}
export interface ConsentState {
  scope: ConsentScope;
  granted: boolean;
  policy_version: string;
}
export type StaffRole = "guardian" | "professor" | "tutor" | "institution_admin" | "platform_admin";
export interface MeResponse {
  parent: { id: string; email: string; email_verified: boolean; role: StaffRole; staff_institution_id: string | null };
  children: Child[];
  consents: ConsentState[];
  active_child_id: string | null;
  policy_version: string;
  needs_consent: boolean;
}

// ---------- Mastery / provas ----------
export interface ReviewItem {
  atom_id: string;
  bncc_code: string;
  title: string;
  question: QuizQuestion;
}
export interface ProvaCountdown {
  id: string;
  title: string;
  subject_id: string | null;
  exam_date: string;
  days_left: number;
  readiness: number; // 0..1 (média de retrievability dos atoms da prova)
}
export interface TodayResponse {
  reviews: ReviewItem[];
  provas: ProvaCountdown[];
  streak: number;
  cap: number;
}

// ---------- Parent dashboard ----------
export interface ParentSummary {
  child_id: string;
  week: { active_days: number; reviews: number; streak: number };
  provas: { title: string; date: string; readiness: number; days_left: number }[];
  mastery_by_subject: { subject_id: string; remembered: number; reviewing: number; total: number }[];
}

// ---------- Plataforma v2 (spec 12) ----------
export interface AppNotification {
  id: string | null; // null = derivada (não persistida)
  kind: "achievement" | "reply" | "system" | "reviews_due" | "prova_soon";
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  derived: boolean;
  at: string;
}

export interface CoinState {
  balance: number;
  week: number;
  ledger: { delta: number; reason: string; created_at: string }[];
  achievements: { code: string; unlocked_at: string }[];
}

export interface LeaderboardEntry {
  rank: number;
  display_name: string; // apelido apenas (minimização)
  coins: number;
  me: boolean;
}
export interface LeaderboardResponse {
  institution: string;
  entries: LeaderboardEntry[];
  me: { rank: number | null; coins: number };
}

export interface CommunityPost {
  id: string;
  subject_id: string | null;
  title: string;
  body: string;
  created_at: string;
  author: string; // apelido
  replies?: number;
}
export interface CommunityReply {
  id: string;
  body: string;
  created_at: string;
  author: string; // apelido
}

// ---------- Erros ----------
export interface ApiError {
  error: { code: string; message: string };
}
