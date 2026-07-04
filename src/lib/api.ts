// Cliente HTTP tipado (contratos em shared/contracts). Envia cookie + header CSRF.
import type {
  MeResponse, Institution, TopicNode, TopicCandidate, GenerateBundle, TodayResponse,
  ParentSummary, ConsentScope, ConsentState, AppNotification, CoinState, LeaderboardResponse,
  CommunityPost, CommunityReply,
} from "../../shared/contracts";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const HEADERS = { "Content-Type": "application/json", "X-BM-Client": "pwa" };

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: HEADERS,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? "Algo deu errado.");
  }
  return data as T;
}

export interface CreateChildInput {
  display_name: string;
  birth_year: number;
  grade: string;
  institution_id?: string | null;
  class_id?: string | null;
  subjects?: string[];
  priority_subject?: string | null;
  avatar_seed?: string | null;
  consents: { account: boolean; ai_generation: boolean; progress_tracking: boolean; email_updates?: boolean };
}

export const api = {
  me: () => req<MeResponse>("GET", "/me"),
  register: (email: string, password: string) =>
    req<{ parent: unknown; needs_consent: boolean }>("POST", "/auth/register", { email, password }),
  login: (email: string, password: string) => req<{ parent: unknown }>("POST", "/auth/login", { email, password }),
  logout: () => req<{ ok: true }>("POST", "/auth/logout"),

  institutions: () => req<{ institutions: Institution[] }>("GET", "/catalog/institutions"),
  tree: (q: { institution: string; class: string; subject: string; term?: string }) =>
    req<{ topics: TopicNode[] }>(
      "GET",
      `/catalog/tree?institution=${encodeURIComponent(q.institution)}&class=${encodeURIComponent(q.class)}&subject=${encodeURIComponent(q.subject)}${q.term ? `&term=${q.term}` : ""}`,
    ),
  resolveTopic: (text: string, grade?: string) =>
    req<{ candidates: TopicCandidate[] }>("POST", "/catalog/resolve-topic", { text, grade }),

  createChild: (input: CreateChildInput) => req<MeResponse>("POST", "/children", input),
  setActiveChild: (child_id: string) => req<MeResponse>("POST", "/me/active-child", { child_id }),
  setConsent: (child_id: string, scope: ConsentScope, granted: boolean) =>
    req<{ consents?: ConsentState[]; deleted?: boolean }>("POST", "/consents", { child_id, scope, granted }),
  verifyPassword: (password: string) => req<{ ok: true }>("POST", "/me/verify-password", { password }),
  deleteAccount: () => req<{ deleted: true }>("POST", "/me/delete"),

  generate: (input: { child_id: string; bncc_code?: string; topic?: string; grade?: string; lang?: "pt" | "en" }) =>
    req<GenerateBundle>("POST", "/generate", input),
  review: (child_id: string, atom_id: string, rating: 1 | 2 | 3 | 4, duration_sec?: number) =>
    req<{
      due: string; state: string; retrievability: number; streak: number;
      counted_as_learning_event: boolean; coins_earned: number; achievements_unlocked: string[];
    }>("POST", "/mastery/review", { child_id, atom_id, rating, duration_sec }),
  today: (child_id: string) => req<TodayResponse>("GET", `/mastery/today?child_id=${encodeURIComponent(child_id)}`),
  createProva: (input: { child_id: string; title: string; subject_id?: string; exam_date: string; bncc_codes: string[] }) =>
    req<{ id: string }>("POST", "/provas", input),
  parentSummary: (child_id: string) =>
    req<ParentSummary>("GET", `/parent/summary?child_id=${encodeURIComponent(child_id)}`),

  // ---- Plataforma v2 (spec 12) ----
  createSelfProfile: (input: {
    display_name?: string; birth_year: number; grade: string;
    institution_id?: string | null; class_id?: string | null;
    subjects?: string[]; priority_subject?: string | null;
  }) => req<MeResponse>("POST", "/me/self-profile", input),
  setLeaderboardVisibility: (child_id: string, hidden: boolean) =>
    req<MeResponse>("POST", "/me/leaderboard-visibility", { child_id, hidden }),

  notifications: (child_id: string) =>
    req<{ items: AppNotification[]; unread: number }>("GET", `/notifications?child_id=${encodeURIComponent(child_id)}`),
  markNotificationsRead: (opts: { ids?: string[]; all?: boolean }) =>
    req<{ ok: true }>("POST", "/notifications/read", opts),

  coins: (child_id: string) => req<CoinState>("GET", `/coins?child_id=${encodeURIComponent(child_id)}`),
  leaderboard: (child_id: string) =>
    req<LeaderboardResponse>("GET", `/leaderboard?child_id=${encodeURIComponent(child_id)}`),

  communityPosts: (child_id: string, subject?: string) =>
    req<{ posts: CommunityPost[] }>(
      "GET",
      `/community/posts?child_id=${encodeURIComponent(child_id)}${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`,
    ),
  createPost: (input: { child_id: string; subject_id?: string | null; title: string; body: string }) =>
    req<{ id: string }>("POST", "/community/posts", input),
  getPost: (id: string, child_id: string) =>
    req<{ post: CommunityPost; replies: CommunityReply[] }>(
      "GET",
      `/community/posts/${encodeURIComponent(id)}?child_id=${encodeURIComponent(child_id)}`,
    ),
  replyPost: (post_id: string, child_id: string, body: string) =>
    req<{ id: string }>("POST", `/community/posts/${encodeURIComponent(post_id)}/replies`, { child_id, body }),
  reportContent: (kind: "post" | "reply", id: string) =>
    req<{ ok: true }>("POST", "/community/report", { kind, id }),

  // ---- LMS (spec 13) ----
  adminOverview: () =>
    req<{ role: string; institution_id: string | null; courses: number; published: number; students: number; pending_review: number }>("GET", "/admin/overview"),
  adminCourses: () => req<{ courses: AdminCourse[] }>("GET", "/admin/courses"),
  adminCreateCourse: (input: {
    institution_id: string; subject_id: string; class_id: string;
    term?: string | null; year?: number | null; title: string; description?: string | null; cover_emoji?: string;
  }) => req<{ id: string }>("POST", "/admin/courses", input),
  adminCourse: (id: string) => req<AdminCourseDetail>("GET", `/admin/courses/${encodeURIComponent(id)}`),
  adminPatchCourse: (id: string, patch: Record<string, unknown>) =>
    req<{ ok: true }>("PATCH", `/admin/courses/${encodeURIComponent(id)}`, patch),
  adminCreateModule: (courseId: string, input: { title: string; objectives?: string | null }) =>
    req<{ id: string }>("POST", `/admin/courses/${encodeURIComponent(courseId)}/modules`, input),
  adminCreateItem: (moduleId: string, input: {
    kind: string; title: string; payload?: Record<string, unknown> | null;
    source_file_id?: string | null; duration_min?: number | null;
  }) => req<{ id: string }>("POST", `/admin/modules/${encodeURIComponent(moduleId)}/items`, input),
  adminApproveItem: (id: string) => req<{ ok: true }>("POST", `/admin/items/${encodeURIComponent(id)}/approve`),
  adminDeleteItem: (id: string) => req<{ ok: true }>("DELETE", `/admin/items/${encodeURIComponent(id)}`),
  adminEnrich: (itemId: string, text?: string) =>
    req<{ job_id: string }>("POST", `/admin/items/${encodeURIComponent(itemId)}/enrich`, { text: text ?? null }),
  adminJob: (id: string) =>
    req<{ id: string; item_id: string; status: string; detail: string | null }>("GET", `/admin/jobs/${encodeURIComponent(id)}`),
  adminPreview: (itemId: string) =>
    req<{ bncc_code: string; lesson: unknown; quiz: { questions: unknown[] }; atoms: { id: string; text: string }[] }>(
      "GET", `/admin/items/${encodeURIComponent(itemId)}/preview`),
  adminUpload: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", {
      method: "POST", headers: { "X-BM-Client": "pwa" }, credentials: "include", body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = (data as { error?: { code: string; message: string } } | null)?.error;
      throw new ApiError(res.status, err?.code ?? "error", err?.message ?? "Falha no upload.");
    }
    return data as { id: string; name: string; mime: string; size: number };
  },
  adminInvites: () => req<{ invites: Record<string, unknown>[] }>("GET", "/admin/invites"),
  adminCreateInvite: (input: { email: string; role: string; institution_id?: string | null }) =>
    req<{ id: string; token: string; link: string }>("POST", "/admin/invites", input),
  adminStudents: (institution?: string) =>
    req<{ students: { id: string; display_name: string; grade: string; class_id: string | null }[] }>(
      "GET", `/admin/students${institution ? `?institution=${encodeURIComponent(institution)}` : ""}`),
  adminAssign: (courseId: string, child_ids: string[]) =>
    req<{ assigned: number }>("POST", `/admin/courses/${encodeURIComponent(courseId)}/assign`, { child_ids }),

  inviteInfo: (token: string) =>
    req<{ email: string; role: string; institution: string | null }>("GET", `/invites/${encodeURIComponent(token)}`),
  inviteAccept: (token: string, password: string) =>
    req<{ ok: true; role: string }>("POST", "/invites/accept", { token, password }),

  learnCatalog: (child_id: string) =>
    req<{ courses: CatalogCourse[] }>("GET", `/learn/catalog?child_id=${encodeURIComponent(child_id)}`),
  learnEnroll: (child_id: string, course_id: string) =>
    req<{ ok: true }>("POST", "/learn/enroll", { child_id, course_id }),
  learnCourse: (id: string, child_id: string) =>
    req<LearnCourse>("GET", `/learn/courses/${encodeURIComponent(id)}?child_id=${encodeURIComponent(child_id)}`),
  learnItemProgress: (item_id: string, child_id: string, status: "doing" | "done", score?: number) =>
    req<{ ok: true; module_completed: boolean; course_completed: boolean }>(
      "POST", `/learn/items/${encodeURIComponent(item_id)}/progress`, { child_id, status, score }),

  // ---- Live games (spec 14) ----
  liveStart: (item_id: string) => req<{ id: string; pin: string; total_questions: number }>("POST", "/admin/live/start", { item_id }),
  liveNext: (id: string) => req<{ state: string; current_q?: number }>("POST", `/admin/live/${encodeURIComponent(id)}/next`),
  liveResults: (id: string) => req<{ state: string; current_q: number; players: { nickname: string; score: number }[]; answered: number }>("GET", `/admin/live/${encodeURIComponent(id)}/results`),
  liveJoin: (pin: string, child_id: string) => req<{ session_id: string }>("POST", "/live/join", { pin, child_id }),
  liveState: (pin: string, child_id: string) =>
    req<LiveState>("GET", `/live/${encodeURIComponent(pin)}/state?child_id=${encodeURIComponent(child_id)}`),
  liveAnswer: (pin: string, child_id: string, choice: number) =>
    req<{ ok: true; delta: number }>("POST", `/live/${encodeURIComponent(pin)}/answer`, { child_id, choice }),

  // ---- Polls / Q&A ----
  createPoll: (input: { course_id: string; question: string; options: string[] }) => req<{ id: string }>("POST", "/admin/polls", input),
  polls: (course_id: string, child_id: string) =>
    req<{ polls: PollView[] }>("GET", `/polls?course_id=${encodeURIComponent(course_id)}&child_id=${encodeURIComponent(child_id)}`),
  votePoll: (id: string, child_id: string, choice: number) => req<{ ok: true }>("POST", `/polls/${encodeURIComponent(id)}/vote`, { child_id, choice }),
  qaList: (course_id: string, child_id: string) =>
    req<{ questions: QAItem[] }>("GET", `/qa?course_id=${encodeURIComponent(course_id)}&child_id=${encodeURIComponent(child_id)}`),
  qaAsk: (course_id: string, child_id: string, body: string) => req<{ id: string }>("POST", "/qa", { course_id, child_id, body }),
  qaVote: (id: string, child_id: string) => req<{ ok: true }>("POST", `/qa/${encodeURIComponent(id)}/vote`, { child_id }),
  qaAnswered: (id: string) => req<{ ok: true }>("POST", `/admin/qa/${encodeURIComponent(id)}/answered`),

  // ---- Chat ----
  chatChannel: (courseId: string, child_id: string, since?: string) =>
    req<{ messages: ChatMessage[] }>("GET", `/chat/course/${encodeURIComponent(courseId)}/channel?child_id=${encodeURIComponent(child_id)}${since ? `&since=${encodeURIComponent(since)}` : ""}`),
  chatChannelSend: (courseId: string, child_id: string | null, body: string) =>
    req<{ id: string }>("POST", `/chat/course/${encodeURIComponent(courseId)}/channel${child_id ? `?child_id=${encodeURIComponent(child_id)}` : ""}`, { body, child_id }),
  chatOpenThread: (course_id: string, child_id: string) => req<{ id: string }>("POST", "/chat/thread", { course_id, child_id }),
  chatStaffThread: (course_id: string, child_id: string) => req<{ id: string }>("POST", "/chat/thread/staff", { course_id, child_id }),
  chatThreadMsgs: (id: string, child_id: string, since?: string) =>
    req<{ messages: ChatMessage[] }>("GET", `/chat/thread/${encodeURIComponent(id)}?child_id=${encodeURIComponent(child_id)}${since ? `&since=${encodeURIComponent(since)}` : ""}`),
  chatThreadSend: (id: string, child_id: string, body: string) =>
    req<{ id: string }>("POST", `/chat/thread/${encodeURIComponent(id)}?child_id=${encodeURIComponent(child_id)}`, { body }),
  chatThreads: (child_id: string) => req<{ threads: { id: string; course_id: string; course_title: string }[] }>("GET", `/chat/threads?child_id=${encodeURIComponent(child_id)}`),
  chatStaffInbox: () => req<{ threads: { id: string; course_id: string; course_title: string; student: string; last_body: string | null; last_at: string | null }[] }>("GET", "/admin/chat/threads"),

  // ---- Coaching ----
  coaching: () => req<{ students: CoachStudent[] }>("GET", "/admin/coaching"),
  coachNotes: (childId: string) => req<{ notes: { id: string; body: string; created_at: string; author: string }[] }>("GET", `/admin/coaching/${encodeURIComponent(childId)}/notes`),
  coachAddNote: (childId: string, body: string) => req<{ id: string }>("POST", `/admin/coaching/${encodeURIComponent(childId)}/notes`, { body }),

  // ---- Certificates ----
  certificates: (child_id: string) => req<{ certificates: { code: string; issued_at: string; course_title: string; cover_emoji: string }[] }>("GET", `/certificates?child_id=${encodeURIComponent(child_id)}`),
  certVerify: (code: string) => req<{ code: string; issued_at: string; student: string; course_title: string; institution: string | null }>("GET", `/cert/${encodeURIComponent(code)}`),

  // ---- Moderation ----
  moderation: () => req<{ items: ModItem[]; count: number }>("GET", "/admin/moderation"),
  moderationHide: (kind: string, id: string) => req<{ ok: true }>("POST", "/admin/moderation/hide", { kind, id }),
  moderationRestore: (kind: string, id: string) => req<{ ok: true }>("POST", "/admin/moderation/restore", { kind, id }),
};

export interface LiveState {
  state: "lobby" | "question" | "reveal" | "ended";
  current_q: number;
  total: number;
  question: { index: number; prompt: string; options: string[]; answer_index?: number; started_at: string | null; window_ms: number } | null;
  answered: boolean;
  podium?: { nickname: string; score: number; child_id: string }[];
  players_count: number;
}
export interface PollView { id: string; question: string; options: string[]; open: boolean; tally: number[]; my_choice: number | null; total: number }
export interface QAItem { id: string; body: string; answered: number; created_at: string; author: string; votes: number; voted: number | null }
export interface ChatMessage { id: string; sender_child_id: string | null; sender_parent_id: string | null; sender_name: string; body: string; created_at: string }
export interface CoachStudent {
  id: string; display_name: string; grade: string; last_activity_days: number | null;
  min_readiness: number | null; at_risk: boolean; notes: number;
  flags: { streak_broken: boolean; low_readiness: boolean; inactive_7d: boolean };
}
export interface ModItem { kind: string; label: string; id: string; body: string; created_at: string }

// ---- Tipos LMS (client-side) ----
export interface AdminCourse {
  id: string; title: string; description: string | null; cover_emoji: string; subject_id: string;
  class_id: string; term: string | null; year: number | null; status: string; institution_id: string;
  modules: number; enrolled: number;
}
export interface AdminItem {
  id: string; kind: string; title: string; payload_json: string | null; source_file_id: string | null;
  display_order: number; duration_min: number | null; status: string;
  enrich: { status: string; detail: string | null } | null;
}
export interface AdminCourseDetail {
  course: AdminCourse;
  modules: { id: string; title: string; objectives: string | null; display_order: number; items: AdminItem[] }[];
}
export interface CatalogCourse {
  id: string; title: string; description: string | null; cover_emoji: string; subject_id: string;
  class_id: string; term: string | null; year: number | null; modules: number; enrolled_count: number;
  enrolled: boolean; completed_at: string | null;
}
export interface LearnItem {
  id: string; kind: string; title: string; duration_min: number | null;
  payload: Record<string, unknown> | null;
  progress: { status: "todo" | "doing" | "done"; score: number | null };
}
export interface LearnCourse {
  course: { id: string; title: string; description: string | null; cover_emoji: string };
  enrolled: boolean;
  completed_at: string | null;
  modules: {
    id: string; title: string; objectives: string | null; complete: boolean;
    backlog: { id: string; text: string; state: "new" | "reviewing" | "mastered" }[];
    items: LearnItem[];
  }[];
}

export const EXPORT_URL = "/api/me/export";
