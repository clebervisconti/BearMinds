// Cliente HTTP tipado (contratos em shared/contracts). Envia cookie + header CSRF.
import type {
  MeResponse, Institution, TopicNode, TopicCandidate, GenerateBundle, TodayResponse,
  ParentSummary, ConsentScope, ConsentState,
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
    req<{ due: string; state: string; retrievability: number; streak: number; counted_as_learning_event: boolean }>(
      "POST",
      "/mastery/review",
      { child_id, atom_id, rating, duration_sec },
    ),
  today: (child_id: string) => req<TodayResponse>("GET", `/mastery/today?child_id=${encodeURIComponent(child_id)}`),
  createProva: (input: { child_id: string; title: string; subject_id?: string; exam_date: string; bncc_codes: string[] }) =>
    req<{ id: string }>("POST", "/provas", input),
  parentSummary: (child_id: string) =>
    req<ParentSummary>("GET", `/parent/summary?child_id=${encodeURIComponent(child_id)}`),
};

export const EXPORT_URL = "/api/me/export";
