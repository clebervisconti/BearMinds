// Editor de curso (spec 13): módulos → itens, upload, "Enriquecer com IA" (polling),
// revisão/aprovação (sign-off humano), publicação e matrícula de alunos.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { BearLoader, ErrorNote, Mascot } from "../../components/common";
import { api, ApiError, type AdminCourseDetail, type AdminItem } from "../../lib/api";

const KIND_META: Record<string, { icon: string; label: string }> = {
  video: { icon: "🎬", label: "Vídeo" },
  document: { icon: "📄", label: "Documento" },
  lesson: { icon: "📖", label: "Lição (IA)" },
  quiz: { icon: "✍️", label: "Quiz (IA)" },
  game: { icon: "🎮", label: "Jogo" },
  live: { icon: "📡", label: "Ao vivo" },
  assignment: { icon: "📝", label: "Tarefa" },
  quick_update: { icon: "⚡", label: "Quick Update" },
  mission: { icon: "🎙️", label: "Mission" },
};

export function AdminCurso() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<AdminCourseDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newModule, setNewModule] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setData(await api.adminCourse(id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao carregar curso.");
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Polling leve enquanto houver job de enriquecimento rodando.
  useEffect(() => {
    const busy = data?.modules.some((m) => m.items.some((i) => i.enrich && ["queued", "running"].includes(i.enrich.status)));
    if (busy && !pollRef.current) {
      pollRef.current = setInterval(() => void load(), 2500);
    }
    if (!busy && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [data, load]);

  if (!data && !err) return <AppShell><BearLoader label="Carregando curso…" /></AppShell>;

  const course = data?.course;
  const published = course?.status === "published";

  async function togglePublish() {
    if (!course) return;
    await api.adminPatchCourse(course.id, { status: published ? "draft" : "published" });
    void load();
  }

  async function addModule() {
    if (!id || newModule.trim().length < 2) return;
    await api.adminCreateModule(id, { title: newModule.trim() });
    setNewModule("");
    void load();
  }

  return (
    <AppShell>
      <button className="bm-btn-quiet bm-btn-sm" onClick={() => nav("/admin")} style={{ marginBottom: ".6rem" }}>← Administração</button>
      {err && <ErrorNote>{err}</ErrorNote>}
      {course && (
        <>
          <div className="bm-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: ".8rem" }}>
            <div style={{ display: "flex", gap: ".8rem", alignItems: "center" }}>
              <span style={{ fontSize: "2rem" }}>{course.cover_emoji}</span>
              <div>
                <h1 style={{ fontSize: "1.3rem" }}>{course.title}</h1>
                <div className="sub">{course.subject_id} · {course.class_id}{course.term ? ` · ${course.term}` : ""}{course.year ? ` · ${course.year}` : ""}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
              <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => nav(`/admin/curso/${course.id}/avaliacao`)}>🗃 Avaliação</button>
              <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => nav(`/admin/curso/${course.id}/gestao`)}>📊 Gestão</button>
              <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => nav(`/admin/curso/${course.id}/interagir`, { state: { title: course.title } })}>💬 Interação</button>
              <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setAssigning((v) => !v)}>🎓 Matricular alunos</button>
              <button className="bm-btn bm-btn-sm" onClick={togglePublish} style={published ? { background: "var(--bm-warn)" } : {}}>
                {published ? "Despublicar" : "Publicar curso"}
              </button>
            </div>
          </div>

          {published && (
            <div className="bm-card-flat" style={{ padding: ".6rem 1rem", marginBottom: "1rem", fontSize: ".85rem", color: "var(--bm-success)" }}>
              ✓ Publicado — visível no catálogo dos estudantes da instituição. Itens individuais ainda exigem aprovação.
            </div>
          )}

          {assigning && <AssignStudents courseId={course.id} onDone={() => { setAssigning(false); void load(); }} />}

          {/* módulos */}
          <div style={{ display: "grid", gap: "1rem" }}>
            {data!.modules.map((m, mi) => (
              <section key={m.id} className="bm-card" style={{ display: "grid", gap: ".6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 650 }}>Módulo {mi + 1} · {m.title}</div>
                  <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setAddingTo(addingTo === m.id ? null : m.id)}>
                    {addingTo === m.id ? "Fechar" : "+ Item"}
                  </button>
                </div>

                {addingTo === m.id && <AddItem moduleId={m.id} onDone={() => { setAddingTo(null); void load(); }} />}

                {m.items.length === 0 && <div className="bm-meta">Sem itens ainda — adicione vídeo, documento ou uma lição com IA.</div>}
                {m.items.map((i, ii) => (
                  <ItemRow
                    key={i.id}
                    item={i}
                    courseId={course.id}
                    prevItemId={ii > 0 ? m.items[ii - 1].id : null}
                    onChanged={() => void load()}
                    onPreview={() => setPreviewItem(previewItem === i.id ? null : i.id)}
                    previewOpen={previewItem === i.id}
                  />
                ))}
              </section>
            ))}

            <div className="bm-card-flat" style={{ padding: "1rem", display: "flex", gap: ".6rem" }}>
              <input className="bm-input" placeholder="Título do novo módulo (ex.: Missão 1 — Frações)" value={newModule} maxLength={120} onChange={(e) => setNewModule(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addModule()} />
              <button className="bm-btn" onClick={addModule} disabled={newModule.trim().length < 2}>Adicionar módulo</button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

// ---------- linha de item ----------
function ItemRow({ item, courseId, prevItemId, onChanged, onPreview, previewOpen }: {
  item: AdminItem; courseId: string; prevItemId: string | null; onChanged: () => void; onPreview: () => void; previewOpen: boolean;
}) {
  const nav = useNavigate();
  const meta = KIND_META[item.kind] ?? { icon: "▫", label: item.kind };
  const [err, setErr] = useState<string | null>(null);
  const enrichBusy = item.enrich && ["queued", "running"].includes(item.enrich.status);
  const canEnrich = (item.kind === "lesson" || item.kind === "quiz") && !enrichBusy;
  const canApprove = item.status === "pending_review";
  const canLive = item.kind === "quiz" && item.status === "published";
  const locked = !!item.availability_json;
  async function toggleLock() {
    if (!prevItemId) return;
    setErr(null);
    try {
      await api.setItemAvailability(item.id, locked ? null : JSON.stringify({ type: "completed", item_id: prevItemId, label: "Conclua o item anterior" }));
      onChanged();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Erro."); }
  }

  async function run(fn: () => Promise<unknown>) {
    setErr(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro.");
    }
  }

  return (
    <div className="bm-card-flat" style={{ padding: ".7rem .9rem", display: "grid", gap: ".45rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: ".6rem", flexWrap: "wrap" }}>
        <span aria-hidden>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 160 }}>
          <span style={{ fontWeight: 600, fontSize: ".92rem" }}>{item.title}</span>
          <span className="bm-meta"> · {meta.label}</span>
        </div>
        <StatusChip status={item.status} />
        {canEnrich && (
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => run(() => api.adminEnrich(item.id))}>✨ Enriquecer com IA</button>
        )}
        {canApprove && (
          <>
            <button className="bm-btn-quiet bm-btn-sm" onClick={onPreview}>{previewOpen ? "Fechar prévia" : "👁 Revisar"}</button>
            <button className="bm-btn bm-btn-sm" onClick={() => run(() => api.adminApproveItem(item.id))}>✓ Aprovar e publicar</button>
          </>
        )}
        {item.status === "draft" && (item.kind === "video" || item.kind === "document" || item.kind === "assignment" || item.kind === "quick_update" || item.kind === "mission") && (
          <button className="bm-btn bm-btn-sm" onClick={() => run(() => api.adminApproveItem(item.id))}>Publicar</button>
        )}
        {canLive && (
          <button className="bm-btn bm-btn-sm" style={{ background: "var(--bm-accent)" }} onClick={() => nav(`/admin/live/${item.id}`)}>📡 Ao vivo</button>
        )}
        {item.kind === "assignment" && (
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => nav(`/admin/curso/${courseId}/item/${item.id}/entregas`)}>📥 Entregas</button>
        )}
        {item.kind === "mission" && (
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => nav(`/admin/curso/${courseId}/item/${item.id}/missoes`)}>🎙️ Missões</button>
        )}
        {prevItemId && (
          <button className="bm-btn-quiet bm-btn-sm" title="Desbloquear só após concluir o item anterior" onClick={toggleLock}>{locked ? "🔒 bloqueado" : "🔓 livre"}</button>
        )}
        <button className="bm-btn-quiet bm-btn-sm" onClick={() => { if (confirm("Excluir este item?")) void run(() => api.adminDeleteItem(item.id)); }} aria-label="Excluir">🗑</button>
      </div>
      {enrichBusy && (
        <div className="bm-meta" style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <span className="bm-spin" aria-hidden>🐻</span> IA trabalhando: {item.enrich?.detail ?? "processando…"}
          <style>{`@keyframes bmspin{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}.bm-spin{animation:bmspin 1s infinite}`}</style>
        </div>
      )}
      {item.enrich?.status === "error" && <ErrorNote>Enriquecimento falhou: {item.enrich.detail}</ErrorNote>}
      {err && <ErrorNote>{err}</ErrorNote>}
      {previewOpen && <ItemPreview itemId={item.id} />}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { l: string; c: string }> = {
    draft: { l: "rascunho", c: "var(--bm-muted)" },
    pending_review: { l: "aguardando revisão", c: "var(--bm-warn)" },
    published: { l: "publicado", c: "var(--bm-success)" },
  };
  const m = map[status] ?? map.draft;
  return <span className="bm-chip bm-chip-outline" style={{ color: m.c, fontSize: ".74rem" }}>{m.l}</span>;
}

// ---------- prévia (fila de revisão) ----------
function ItemPreview({ itemId }: { itemId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.adminPreview>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.adminPreview(itemId).then(setData).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro na prévia."));
  }, [itemId]);
  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!data) return <BearLoader label="Carregando prévia…" />;
  const lesson = data.lesson as { warmup_question?: string; sections?: { claim: string; explanation: string }[] };
  return (
    <div style={{ borderTop: "1px solid var(--bm-border)", paddingTop: ".7rem", display: "grid", gap: ".55rem" }}>
      <div className="bm-eyebrow">Como o aluno verá</div>
      {lesson.warmup_question && <Mascot mood="think" message={lesson.warmup_question} />}
      {(lesson.sections ?? []).map((s, i) => (
        <div key={i} className="bm-card-flat" style={{ padding: ".6rem .8rem" }}>
          <div style={{ fontWeight: 600, fontSize: ".9rem" }}>{s.claim}</div>
          <div className="bm-meta">{s.explanation}</div>
        </div>
      ))}
      <div className="bm-meta">Quiz: {data.quiz.questions.length} questões socráticas · Conceitos (backlog): {data.atoms.length}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
        {data.atoms.map((a) => <span key={a.id} className="bm-chip" style={{ fontSize: ".74rem" }}>{a.text.slice(0, 60)}</span>)}
      </div>
    </div>
  );
}

// ---------- adicionar item ----------
function AddItem({ moduleId, onDone }: { moduleId: string; onDone: () => void }) {
  const [kind, setKind] = useState<"video" | "document" | "lesson" | "assignment" | "quick_update" | "mission">("lesson");
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [text, setText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxPoints, setMaxPoints] = useState(100);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Quick Update (spec 17.1)
  const [quBody, setQuBody] = useState("");
  const [quQuestion, setQuQuestion] = useState("");
  const [quOptions, setQuOptions] = useState(["", ""]);
  const [quCorrect, setQuCorrect] = useState(0);
  const [quChecklist, setQuChecklist] = useState("");
  // Mission (spec 17.5)
  const [missionPrompt, setMissionPrompt] = useState("");
  const [missionMedia, setMissionMedia] = useState<"audio" | "video">("audio");

  async function save() {
    setErr(null);
    try {
      let sourceFileId: string | null = null;
      let payload: Record<string, unknown> | null = null;

      if (file) {
        setBusy("Enviando arquivo…");
        const up = await api.adminUpload(file);
        sourceFileId = up.id;
        if (kind === "video") payload = { file_id: up.id };
        if (kind === "document") payload = { file_id: up.id, name: up.name };
      }
      if (kind === "video" && videoUrl.trim()) payload = { url: videoUrl.trim() };
      if (kind === "assignment") payload = { instructions: instructions.trim(), accept: ["text", "file"], max_points: maxPoints };
      if (kind === "quick_update") {
        const questions = quQuestion.trim() && quOptions.filter((o) => o.trim()).length >= 2
          ? [{ prompt: quQuestion.trim(), options: quOptions.filter((o) => o.trim()), correct: quCorrect }]
          : [];
        const checklist = quChecklist.split("\n").map((l) => l.trim()).filter(Boolean).map((label) => ({ label }));
        payload = { body: quBody.trim(), questions, checklist };
      }
      if (kind === "mission") payload = { prompt: missionPrompt.trim(), media_type: missionMedia, max_points: maxPoints };

      setBusy("Criando item…");
      const item = await api.adminCreateItem(moduleId, { kind, title: title.trim(), payload, source_file_id: sourceFileId });

      // Lição (IA): dispara o enriquecimento já na criação (texto colado ou arquivo-fonte)
      if (kind === "lesson") {
        setBusy("Enviando para a IA…");
        await api.adminEnrich(item.id, text.trim() || undefined);
      }
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao criar item.");
    } finally {
      setBusy(null);
    }
  }

  const needsSource = kind === "lesson" && !file && text.trim().length < 200;
  const disabled =
    !!busy || title.trim().length < 2 ||
    (kind === "video" && !videoUrl.trim() && !file) ||
    (kind === "document" && !file) ||
    (kind === "assignment" && instructions.trim().length < 5) ||
    (kind === "quick_update" && quBody.trim().length < 5) ||
    (kind === "mission" && missionPrompt.trim().length < 5) ||
    needsSource;

  return (
    <div className="bm-card-flat" style={{ padding: ".9rem", display: "grid", gap: ".6rem", background: "var(--bm-surface-2)" }}>
      <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
        {(["lesson", "video", "document", "assignment", "quick_update", "mission"] as const).map((k) => (
          <button key={k} className={`bm-btn-sm ${kind === k ? "bm-btn" : "bm-btn bm-btn-ghost"}`} onClick={() => setKind(k)}>
            {KIND_META[k].icon} {k === "lesson" ? "Lição + Quiz (IA)" : KIND_META[k].label}
          </button>
        ))}
      </div>
      <input className="bm-input" placeholder="Título do item" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} />

      {kind === "video" && (
        <>
          <input className="bm-input" placeholder="URL do YouTube ou Vimeo (https://…)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
          <label className="bm-meta">ou envie um MP4 (≤200MB):{" "}
            <input type="file" accept="video/mp4" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </>
      )}
      {kind === "document" && (
        <label className="bm-meta">Arquivo (PDF/DOCX/TXT/MD, ≤20MB):{" "}
          <input type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
      {kind === "lesson" && (
        <>
          <div className="bm-meta">
            A IA vai <b>pesquisar, explorar e enriquecer</b> seu material: extrai o texto, quebra em conceitos
            (Learning Backlog), e gera lição think-first + quiz socrático <b>ancorados no seu material</b>. Você revisa e aprova antes de publicar.
          </div>
          <textarea className="bm-input" rows={5} placeholder="Cole aqui o conteúdo da aula (mín. 200 caracteres)…" value={text} onChange={(e) => setText(e.target.value)} style={{ resize: "vertical" }} />
          <label className="bm-meta">ou envie o material (PDF/DOCX/TXT/MD):{" "}
            <input type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </>
      )}

      {kind === "assignment" && (
        <>
          <textarea className="bm-input" rows={4} placeholder="Instruções da tarefa para o aluno…" value={instructions} onChange={(e) => setInstructions(e.target.value)} style={{ resize: "vertical" }} />
          <label className="bm-meta">Pontuação máxima: <input className="bm-input" type="number" min={1} max={1000} value={maxPoints} onChange={(e) => setMaxPoints(Number(e.target.value))} style={{ width: 100, display: "inline-block" }} /></label>
          <div className="bm-meta">O aluno entrega texto e/ou arquivo. Você corrige em <b>Entregas</b> (com rubrica e pré-análise de IA).</div>
        </>
      )}

      {kind === "quick_update" && (
        <>
          <div className="bm-meta">Micro-lição de ~3 min: um texto curto, 1 pergunta opcional e uma checklist de passos rastreáveis.</div>
          <textarea className="bm-input" rows={3} placeholder="Texto curto do Quick Update…" value={quBody} onChange={(e) => setQuBody(e.target.value)} style={{ resize: "vertical" }} />
          <input className="bm-input" placeholder="Pergunta (opcional)" value={quQuestion} onChange={(e) => setQuQuestion(e.target.value)} />
          {quQuestion.trim() && (
            <div style={{ display: "grid", gap: ".3rem" }}>
              {quOptions.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                  <input type="radio" checked={quCorrect === i} onChange={() => setQuCorrect(i)} />
                  <input className="bm-input" placeholder={`Opção ${i + 1}`} value={o} onChange={(e) => setQuOptions((opts) => opts.map((x, xi) => xi === i ? e.target.value : x))} />
                </div>
              ))}
              <button className="bm-btn-quiet bm-btn-sm" onClick={() => setQuOptions((o) => [...o, ""])} style={{ justifySelf: "start" }}>+ opção</button>
            </div>
          )}
          <textarea className="bm-input" rows={3} placeholder={"Checklist — um passo por linha (opcional)"} value={quChecklist} onChange={(e) => setQuChecklist(e.target.value)} style={{ resize: "vertical" }} />
        </>
      )}

      {kind === "mission" && (
        <>
          <div className="bm-meta">
            O aluno grava áudio ou vídeo e digita uma transcrição/resumo (este produto não faz transcrição automática).
            A IA pré-analisa o texto digitado; você avalia por rubrica ouvindo/assistindo o arquivo.
          </div>
          <textarea className="bm-input" rows={3} placeholder="Pedido da missão (ex.: 'Explique com suas palavras o que é uma fração equivalente')…" value={missionPrompt} onChange={(e) => setMissionPrompt(e.target.value)} style={{ resize: "vertical" }} />
          <div style={{ display: "flex", gap: ".4rem" }}>
            {(["audio", "video"] as const).map((m) => (
              <button key={m} className={`bm-btn-sm ${missionMedia === m ? "bm-btn" : "bm-btn bm-btn-ghost"}`} onClick={() => setMissionMedia(m)}>{m === "audio" ? "🎙️ Áudio" : "🎬 Vídeo"}</button>
            ))}
          </div>
          <label className="bm-meta">Pontuação máxima: <input className="bm-input" type="number" min={1} max={1000} value={maxPoints} onChange={(e) => setMaxPoints(Number(e.target.value))} style={{ width: 100, display: "inline-block" }} /></label>
        </>
      )}

      {err && <ErrorNote>{err}</ErrorNote>}
      <button className="bm-btn" disabled={disabled} onClick={save} style={{ justifySelf: "start" }}>
        {busy ?? (kind === "lesson" ? "Criar e enriquecer com IA ✨" : "Adicionar item")}
      </button>
    </div>
  );
}

// ---------- matrícula ----------
function AssignStudents({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [students, setStudents] = useState<{ id: string; display_name: string; grade: string }[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.adminStudents().then((r) => setStudents(r.students)).catch((e) => setErr(e instanceof ApiError ? e.message : "Erro."));
  }, []);

  async function assign() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.adminAssign(courseId, [...sel]);
      alert(`${r.assigned} aluno(s) matriculado(s).`);
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Erro ao matricular.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bm-card" style={{ marginBottom: "1rem", display: "grid", gap: ".6rem" }}>
      <div className="bm-eyebrow">Matricular alunos da instituição</div>
      {err && <ErrorNote>{err}</ErrorNote>}
      {!students ? <BearLoader label="Carregando alunos…" /> : students.length === 0 ? (
        <div className="bm-meta">Nenhum estudante da instituição ainda.</div>
      ) : (
        <div style={{ display: "grid", gap: ".3rem", maxHeight: 260, overflow: "auto" }}>
          {students.map((s) => (
            <label key={s.id} style={{ display: "flex", gap: ".6rem", alignItems: "center", padding: ".3rem .2rem" }}>
              <input type="checkbox" checked={sel.has(s.id)} onChange={(e) => {
                const next = new Set(sel);
                if (e.target.checked) next.add(s.id); else next.delete(s.id);
                setSel(next);
              }} />
              <span style={{ fontSize: ".9rem" }}>{s.display_name} <em className="bm-meta" style={{ fontStyle: "normal" }}>· {s.grade}</em></span>
            </label>
          ))}
        </div>
      )}
      <button className="bm-btn bm-btn-sm" disabled={busy || sel.size === 0} onClick={assign} style={{ justifySelf: "start" }}>
        {busy ? "Matriculando…" : `Matricular ${sel.size} aluno(s)`}
      </button>
    </div>
  );
}
