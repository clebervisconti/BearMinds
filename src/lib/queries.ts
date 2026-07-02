// Hooks de dados (TanStack Query) sobre o cliente tipado.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Child } from "../../shared/contracts";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
}

export function useInstitutions() {
  return useQuery({ queryKey: ["institutions"], queryFn: api.institutions, staleTime: 5 * 60_000 });
}

export function useTree(q: { institution: string; class: string; subject: string; term?: string } | null) {
  return useQuery({
    queryKey: ["tree", q],
    queryFn: () => api.tree(q!),
    enabled: !!q && !!q.class && !!q.subject,
  });
}

export function useToday(childId: string | null) {
  return useQuery({
    queryKey: ["today", childId],
    queryFn: () => api.today(childId!),
    enabled: !!childId,
  });
}

export function useParentSummary(childId: string | null) {
  return useQuery({
    queryKey: ["parent-summary", childId],
    queryFn: () => api.parentSummary(childId!),
    enabled: !!childId,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => qc.clear(),
  });
}

export function useSetActiveChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (childId: string) => api.setActiveChild(childId),
    onSuccess: (me) => qc.setQueryData(["me"], me),
  });
}

export function activeChild(children: Child[], activeId: string | null): Child | null {
  return children.find((c) => c.id === activeId) ?? children[0] ?? null;
}
