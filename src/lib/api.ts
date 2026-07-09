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

  // ---- Gestão & automação (spec 16 / P5b) ----
  adminGradebook: (courseId: string) =>
    req<Gradebook>("GET", `/admin/courses/${encodeURIComponent(courseId)}/gradebook`),
  adminCourseReports: (courseId: string) =>
    req<CourseReports>("GET", `/admin/courses/${encodeURIComponent(courseId)}/reports`),
  adminEnrollmentRules: (courseId: string) =>
    req<{ rules: EnrollmentRule[] }>("GET", `/admin/courses/${encodeURIComponent(courseId)}/enrollment-rules`),
  adminCreateEnrollmentRule: (courseId: string, input: { grade?: string | null; class_id?: string | null }) =>
    req<{ id: string }>("POST", `/admin/courses/${encodeURIComponent(courseId)}/enrollment-rules`, input),
  adminDeleteEnrollmentRule: (ruleId: string) =>
    req<{ ok: true }>("DELETE", `/admin/enrollment-rules/${encodeURIComponent(ruleId)}`),
  adminDuplicateCourse: (courseId: string, input: { title: string; class_id: string }) =>
    req<{ id: string }>("POST", `/admin/courses/${encodeURIComponent(courseId)}/duplicate`, input),

  myGrades: (child_id: string) =>
    req<{ courses: GradeCourse[] }>("GET", `/my/grades?child_id=${encodeURIComponent(child_id)}`),
  myTimeline: (child_id: string) =>
    req<{ timeline: TimelineItem[] }>("GET", `/my/timeline?child_id=${encodeURIComponent(child_id)}`),

  // ---- Grupos dentro do curso (spec 16.6) ----
  courseGroups: (courseId: string) =>
    req<{ groups: CourseGroup[]; unassigned: number }>("GET", `/admin/courses/${encodeURIComponent(courseId)}/groups`),
  createCourseGroup: (courseId: string, title: string) =>
    req<{ id: string }>("POST", `/admin/courses/${encodeURIComponent(courseId)}/groups`, { title }),
  deleteCourseGroup: (groupId: string) => req<{ ok: true }>("DELETE", `/admin/groups/${encodeURIComponent(groupId)}`),
  assignToGroup: (groupId: string, child_ids: string[]) =>
    req<{ assigned: number }>("POST", `/admin/groups/${encodeURIComponent(groupId)}/assign`, { child_ids }),
  unassignFromGroup: (courseId: string, child_id: string) =>
    req<{ ok: true }>("POST", `/admin/courses/${encodeURIComponent(courseId)}/groups/unassign`, { child_id }),

  // ---- Quick Updates + Checklists (spec 17.1) ----
  checklist: (itemId: string, child_id: string) =>
    req<{ steps: ChecklistStep[] }>("GET", `/learn/items/${encodeURIComponent(itemId)}/checklist?child_id=${encodeURIComponent(child_id)}`),
  toggleChecklistStep: (itemId: string, step: number, child_id: string) =>
    req<{ done: boolean; all_done: boolean }>("POST", `/learn/items/${encodeURIComponent(itemId)}/checklist/${step}/toggle`, { child_id }),

  // ---- Exemplares de pares (spec 17.2) ----
  promoteExemplar: (submissionId: string, note?: string | null) =>
    req<{ id: string }>("POST", `/admin/submissions/${encodeURIComponent(submissionId)}/promote-exemplar`, { note: note ?? null }),
  courseExemplarsAdmin: (courseId: string) =>
    req<{ exemplars: AdminExemplar[] }>("GET", `/admin/courses/${encodeURIComponent(courseId)}/exemplars`),
  deleteExemplar: (id: string) => req<{ ok: true }>("DELETE", `/admin/exemplars/${encodeURIComponent(id)}`),
  pendingExemplars: () => req<{ pending: PendingExemplar[] }>("GET", "/exemplars/pending"),
  consentExemplar: (id: string, granted: boolean) => req<{ ok: true }>("POST", `/exemplars/${encodeURIComponent(id)}/consent`, { granted }),
  courseExemplars: (courseId: string, child_id: string) =>
    req<{ exemplars: Exemplar[] }>("GET", `/learn/courses/${encodeURIComponent(courseId)}/exemplars?child_id=${encodeURIComponent(child_id)}`),

  // ---- Auto-avaliação vs professor (spec 17.3) ----
  selfAssess: (submissionId: string, input: { rubric_id?: string | null; selections?: number[][] | null; points?: number | null; reflection?: string | null }) =>
    req<{ ok: true; points: number }>("POST", `/learn/submissions/${encodeURIComponent(submissionId)}/self-assess`, input),
  mySelfAssessment: (submissionId: string) =>
    req<{ self_assessment: { points: number; reflection: string | null; created_at: string } | null }>("GET", `/learn/submissions/${encodeURIComponent(submissionId)}/self-assess`),
  selfAssessmentGap: (courseId: string) =>
    req<{ submissions: SelfAssessGapRow[]; average_gap: number | null; pending_teacher_review: number }>("GET", `/admin/courses/${encodeURIComponent(courseId)}/self-assessment-gap`),

  // ---- Readiness 2.0 (spec 17.4) ----
  courseReadiness: (courseId: string) =>
    req<{ students: StudentReadiness[]; course_average: number | null }>("GET", `/admin/courses/${encodeURIComponent(courseId)}/readiness`),
  myReadiness: (child_id: string) =>
    req<{ courses: CourseReadiness[] }>("GET", `/my/readiness?child_id=${encodeURIComponent(child_id)}`),

  // ---- Missions-lite (spec 17.5) ----
  missionUpload: async (file: File, child_id: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("child_id", child_id);
    const res = await fetch("/api/learn/missions/upload", { method: "POST", body: form, credentials: "include", headers: { "X-BM-Client": "pwa" } });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? "error", data?.error?.message ?? "Erro no envio.");
    return data as { id: string; name: string; mime: string };
  },
  submitMission: (itemId: string, child_id: string, file_id: string, transcript?: string | null) =>
    req<{ ok: true; retention_until: string }>("POST", `/learn/items/${encodeURIComponent(itemId)}/mission`, { child_id, file_id, transcript: transcript ?? null }),
  myMission: (itemId: string, child_id: string) =>
    req<{ submission: MissionSubmission | null }>("GET", `/learn/items/${encodeURIComponent(itemId)}/mission?child_id=${encodeURIComponent(child_id)}`),
  missionSubmissionsForItem: (itemId: string) =>
    req<{ submissions: AdminMissionSubmission[] }>("GET", `/admin/items/${encodeURIComponent(itemId)}/mission-submissions`),
  missionAiPreanalysis: (id: string) => req<{ ai_preanalysis: MissionAiPreanalysis }>("POST", `/admin/mission-submissions/${encodeURIComponent(id)}/ai-preanalysis`),
  reviewMission: (id: string, input: { feedback: string; rubric_id?: string | null; selections?: number[][] | null; points?: number | null }) =>
    req<{ ok: true; points: number | null }>("POST", `/admin/mission-submissions/${encodeURIComponent(id)}/review`, input),

  // ---- Founding-member paywall (P5-r) ----
  paywall: () => req<{ link: string | null; price_label: string | null; is_founding_member: boolean }>("GET", "/paywall"),
  paywallAdmin: () => req<{ link: string | null; price_label: string | null; founding_members_count: number }>("GET", "/admin/paywall"),
  paywallSet: (link: string, price_label: string) => req<{ ok: true }>("POST", "/admin/paywall", { link, price_label }),
  paywallMarkByEmail: (email: string, granted: boolean) => req<{ ok: true; id: string }>("POST", "/admin/paywall/mark-by-email", { email, granted }),
  paywallMembers: () => req<{ members: { id: string; email: string; founding_member_at: string }[] }>("GET", "/admin/paywall/members"),

  // ---- Correlação pós-prova (P5-r) ----
  predictionCorrelation: (courseId: string) =>
    req<{ points: { predicted: number; actual: number; child_id: string; exam_id: string }[]; correlation: number | null; n: number; note: string }>(
      "GET", `/admin/courses/${encodeURIComponent(courseId)}/prediction-correlation`),

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

  // ---- Modelo de IA (platform_admin) ----
  aiModelGet: () => req<{ current: string; default: string; options: AiModelOption[] }>("GET", "/admin/ai-model"),
  aiModelSet: (model: string) => req<{ ok: true; current: string }>("POST", "/admin/ai-model", { model }),

  // ---- Moderation ----
  moderation: () => req<{ items: ModItem[]; count: number }>("GET", "/admin/moderation"),
  moderationHide: (kind: string, id: string) => req<{ ok: true }>("POST", "/admin/moderation/hide", { kind, id }),
  moderationRestore: (kind: string, id: string) => req<{ ok: true }>("POST", "/admin/moderation/restore", { kind, id }),

  // ---- Banco de questões (spec 15.2) ----
  bankList: (courseId: string, q: { status?: string; bncc?: string; difficulty?: number } = {}) => {
    const p = new URLSearchParams(); if (q.status) p.set("status", q.status); if (q.bncc) p.set("bncc", q.bncc); if (q.difficulty) p.set("difficulty", String(q.difficulty));
    return req<{ questions: BankQuestion[]; counts: Record<string, number> }>("GET", `/admin/courses/${encodeURIComponent(courseId)}/bank?${p.toString()}`);
  },
  bankCreate: (courseId: string, input: BankQuestionInput) => req<{ id: string }>("POST", `/admin/courses/${encodeURIComponent(courseId)}/bank`, input),
  bankUpdate: (id: string, input: BankQuestionInput) => req<{ id: string; versioned: boolean }>("PATCH", `/admin/bank/${encodeURIComponent(id)}`, input),
  bankApprove: (id: string) => req<{ ok: true }>("POST", `/admin/bank/${encodeURIComponent(id)}/approve`),
  bankDelete: (id: string) => req<{ ok: true }>("DELETE", `/admin/bank/${encodeURIComponent(id)}`),

  // ---- Provas (spec 15.3) ----
  examList: (courseId: string) => req<{ exams: AdminExam[] }>("GET", `/admin/courses/${encodeURIComponent(courseId)}/exams`),
  examCreate: (courseId: string, input: ExamInput) => req<{ id: string }>("POST", `/admin/courses/${encodeURIComponent(courseId)}/exams`, input),
  examSetStatus: (id: string, status: "draft" | "published" | "closed") => req<{ ok: true }>("PATCH", `/admin/exams/${encodeURIComponent(id)}`, { status }),
  examResults: (id: string) => req<{ title: string; attempts: { display_name: string; score: number; submitted_at: string }[]; per_question: { qid: string; prompt: string; pct: number; total: number }[] }>("GET", `/admin/exams/${encodeURIComponent(id)}/results`),
  examStudentList: (courseId: string, child_id: string) => req<{ exams: StudentExam[] }>("GET", `/exams?course_id=${encodeURIComponent(courseId)}&child_id=${encodeURIComponent(child_id)}`),
  examStart: (id: string, child_id: string) => req<{ attempt_id: string; duration_min: number | null; questions: ExamQuestion[] }>("POST", `/exams/${encodeURIComponent(id)}/start`, { child_id }),
  examSubmit: (id: string, attemptId: string, child_id: string, answers: { qid: string; response: unknown }[]) =>
    req<{ score: number; graded_count: number; needs_manual: number }>("POST", `/exams/${encodeURIComponent(id)}/attempts/${encodeURIComponent(attemptId)}/submit`, { child_id, answers }),

  // ---- Rubricas + Tarefas (spec 15.4) ----
  rubricList: (courseId: string) => req<{ rubrics: Rubric[] }>("GET", `/admin/courses/${encodeURIComponent(courseId)}/rubrics`),
  rubricCreate: (courseId: string, input: { title: string; sections: RubricSection[] }) => req<{ id: string }>("POST", `/admin/courses/${encodeURIComponent(courseId)}/rubrics`, input),
  submit: (itemId: string, child_id: string, body_text: string | null, file_id: string | null) =>
    req<{ ok: true }>("POST", `/learn/items/${encodeURIComponent(itemId)}/submit`, { child_id, body_text, file_id }),
  mySubmission: (itemId: string, child_id: string) => req<{ submission: StudentSubmission | null }>("GET", `/learn/items/${encodeURIComponent(itemId)}/submission?child_id=${encodeURIComponent(child_id)}`),
  submissionsForItem: (itemId: string) => req<{ submissions: AdminSubmission[] }>("GET", `/admin/items/${encodeURIComponent(itemId)}/submissions`),
  reviewSubmission: (id: string, input: { feedback: string; rubric_id?: string | null; selections?: number[][] | null; points?: number | null }) => req<{ ok: true; points: number | null }>("POST", `/admin/submissions/${encodeURIComponent(id)}/review`, input),
  aiReviewSubmission: (id: string) => req<{ ai_assist: AiAssist }>("POST", `/admin/submissions/${encodeURIComponent(id)}/ai-review`),

  // ---- Desbloqueio (spec 15.5) ----
  setModuleAvailability: (id: string, availability_json: string | null) => req<{ ok: true }>("PATCH", `/admin/modules/${encodeURIComponent(id)}`, { availability_json }),
  setItemAvailability: (id: string, availability_json: string | null) => req<{ ok: true }>("PATCH", `/admin/items/${encodeURIComponent(id)}`, { availability_json }),
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
export interface AiModelOption { id: string; label: string; provider: "local" | "gemini" | "claude"; note?: string; default: boolean }

// ---- Tipos LMS (client-side) ----
export interface AdminCourse {
  id: string; title: string; description: string | null; cover_emoji: string; subject_id: string;
  class_id: string; term: string | null; year: number | null; status: string; institution_id: string;
  modules: number; enrolled: number;
}
export interface AdminItem {
  id: string; kind: string; title: string; payload_json: string | null; source_file_id: string | null;
  display_order: number; duration_min: number | null; status: string; availability_json: string | null;
  enrich: { status: string; detail: string | null } | null;
}
export interface AdminCourseDetail {
  course: AdminCourse;
  modules: { id: string; title: string; objectives: string | null; display_order: number; availability_json: string | null; items: AdminItem[] }[];
}
export interface CatalogCourse {
  id: string; title: string; description: string | null; cover_emoji: string; subject_id: string;
  class_id: string; term: string | null; year: number | null; modules: number; enrolled_count: number;
  enrolled: boolean; completed_at: string | null;
}
export interface LearnItem {
  id: string; kind: string; title: string; duration_min: number | null;
  payload: Record<string, unknown> | null;
  locked: boolean; lock_reason: string | null;
  progress: { status: "todo" | "doing" | "done"; score: number | null };
}
export interface LearnCourse {
  course: { id: string; title: string; description: string | null; cover_emoji: string };
  enrolled: boolean;
  completed_at: string | null;
  modules: {
    id: string; title: string; objectives: string | null; complete: boolean;
    locked: boolean; lock_reason: string | null;
    backlog: { id: string; text: string; state: "new" | "reviewing" | "mastered" }[];
    items: LearnItem[];
  }[];
}

// ---- P5b: Gestão & automação (spec 16) ----
export interface GradebookActivity { id: string; title: string; kind: "assignment" | "exam"; max_points: number }
export interface GradebookStudent {
  id: string; display_name: string; grade: string; class_id: string | null;
  grades: Record<string, number | null>; // activity_id -> normalized score 0..1
  average: number | null;
}
export interface Gradebook { activities: GradebookActivity[]; students: GradebookStudent[] }

export interface CourseReports {
  active_students_7d: number; total_students: number; participation_rate: number;
  average_completion: number; average_exam_score: number; average_assignment_score: number;
}

export interface EnrollmentRule { id: string; grade: string | null; class_id: string | null; created_at: string }

export interface GradeCourse {
  id: string; title: string; cover_emoji: string;
  grades: Record<string, { title: string; score: number | null }>;
  average: number | null;
}

export interface TimelineItem {
  id: string; title: string; kind: "assignment" | "exam"; due_at: string;
  course_id: string; course_title: string; available: boolean; lock_reason: string | null;
}

// ---- Grupos dentro do curso (spec 16.6) ----
export interface CourseGroup { id: string; title: string; created_at: string; members: number }

// ---- Quick Updates + Checklists (spec 17.1) ----
export interface ChecklistStep { index: number; label: string; done: boolean }

// ---- Exemplares de pares (spec 17.2) ----
export interface AdminExemplar { id: string; note: string | null; consent_state: "pending" | "granted" | "denied"; created_at: string; student: string; body_text: string | null }
export interface PendingExemplar { id: string; note: string | null; created_at: string; student: string; course_title: string }
export interface Exemplar { id: string; note: string | null; created_at: string; student: string; body_text: string | null }

// ---- Auto-avaliação vs professor (spec 17.3) ----
export interface SelfAssessGapRow { submission_id: string; student: string; item_title: string; self_fraction: number; teacher_fraction: number; gap: number }

// ---- Readiness 2.0 (spec 17.4) ----
export interface ReadinessDims { knowledge: number | null; skill: number | null; execution: number | null; overall: number | null }
export interface StudentReadiness extends ReadinessDims { id: string; display_name: string }
export interface CourseReadiness extends ReadinessDims { id: string; title: string; cover_emoji: string }

// ---- Missions-lite (spec 17.5) ----
export interface MissionSubmission {
  id: string; file_id: string; transcript: string | null; status: "submitted" | "reviewed";
  retention_until: string; submitted_at: string; review: { points: number | null; feedback: string; created_at: string } | null;
}
export interface AdminMissionSubmission {
  id: string; child_id: string; student: string; file_id: string; transcript: string | null;
  status: string; submitted_at: string; retention_until: string; points: number | null;
}
export interface MissionAiPreanalysis { summary: string; coverage: string[]; gaps: string[]; keywords_found: string[] }

export const EXPORT_URL = "/api/me/export";

// ---- P5a: Assessment core (spec 15) ----
export type BankKind = "mcq" | "tf" | "short" | "numeric";
export interface BankQuestionInput {
  kind: BankKind; prompt: string; options?: string[] | null; answer: unknown;
  explanation?: string | null; bncc_code?: string | null; tags?: string[] | null; difficulty?: number;
}
export interface BankQuestion extends BankQuestionInput {
  id: string; status: "draft" | "approved" | "retired"; origin: "ai" | "staff"; approved: boolean; version: number;
}
export interface ExamPool { bncc_codes?: string[] | null; tags?: string[] | null; difficulty?: number[] | null; n: number }
export interface ExamInput { title: string; description?: string | null; pool: ExamPool; duration_min?: number | null; opens_at?: string | null; due_at?: string | null; attempts_allowed?: number }
export interface AdminExam { id: string; title: string; pool: ExamPool; duration_min: number | null; opens_at: string | null; due_at: string | null; attempts_allowed: number; status: string; pool_available: number; students_attempted: number }
export interface StudentExam { id: string; title: string; description: string | null; duration_min: number | null; opens_at: string | null; due_at: string | null; attempts_used: number; attempts_allowed: number; best_score: number | null; open_now: boolean; can_start: boolean }
export interface ExamQuestion { id: string; kind: BankKind; prompt: string; options: string[] | null }
export interface RubricLevel { label: string; points: number }
export interface RubricCriterion { label: string; levels: RubricLevel[] }
export interface RubricSection { title: string; weight: number; criteria: RubricCriterion[] }
export interface Rubric { id: string; title: string; sections: RubricSection[] }
export interface StudentSubmission { id: string; body_text: string | null; file_id: string | null; status: string; submitted_at: string; review: { points: number | null; feedback: string; created_at: string } | null }
export interface AdminSubmission { id: string; child_id: string; student: string; body_text: string | null; file_id: string | null; status: string; submitted_at: string; points: number | null }
export interface AiAssist { summary: string; coverage: string[]; gaps: string[]; ai_suspicion: "baixa" | "média" | "alta" }
