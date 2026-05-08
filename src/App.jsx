import { useEffect, useMemo, useState, useCallback } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ✅ ИСПРАВЛЕНО: email совпадают с seed_demo_data в бэкенде
const accounts = {
  student: { email: "student@edusync.edu", password: "password123", roleLabel: "Uczeń",         avatar: "JK" },
  teacher: { email: "teacher@edusync.edu", password: "password123", roleLabel: "Wykładowca",    avatar: "AN" },
  admin:   { email: "admin@edusync.edu",   password: "password123", roleLabel: "Administrator", avatar: "AD" },
};

const studentTabs = [
  ["start",    "🏠", "Start"],
  ["courses",  "📚", "Kursy"],
  ["grades",   "⭐", "Oceny"],
  ["messages", "✉️", "Wiadom."],
  ["more",     "···", "Więcej"],
];
const teacherTabs = [
  ["teacher",  "🏠", "Panel"],
  ["courses",  "📚", "Kursy"],
  ["tasks",    "📝", "Zadania"],
  ["messages", "✉️", "Wiadom."],
  ["more",     "···", "Więcej"],
];

function apiFetch(path, token, options = {}) {
  const isFormData = options.body instanceof FormData;

  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || "Błąd API");
    return data;
  });
}

function Notice({ msg, type }) {
  if (!msg) return null;
  const isErr = type === "err" || (msg && msg.toLowerCase().includes("błąd"));
  return (
    <div style={{
      background: isErr ? "#fef2f2" : "#ecfdf5",
      color: isErr ? "#dc2626" : "#047857",
      padding: "10px 12px", borderRadius: 12, marginBottom: 10, fontSize: 13
    }}>{msg}</div>
  );
}

// ─── LoginScreen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, apiStatus }) {
  const [role, setRole]         = useState("student");
  const [email, setEmail]       = useState(accounts.student.email);
  const [password, setPassword] = useState("password123");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const selectRole = (r) => { setRole(r); setEmail(accounts[r].email); setPassword(accounts[r].password); setError(""); };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const auth = await apiFetch("/api/auth/login", null, { method: "POST", body: JSON.stringify({ email, password }) });
      const me   = await apiFetch("/api/auth/me", auth.access_token);
      onLogin({ token: auth.access_token, user: me });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={S.screen}>
      <div style={{ textAlign: "center", marginTop: 34, marginBottom: 22 }}>
        <div style={{ fontSize: 34, fontWeight: 900 }}><span style={{ color: "#6366f1" }}>Edu</span>Sync</div>
        <div style={S.muted}>Logowanie do platformy LMS</div>
        <div style={{ ...S.status, color: apiStatus === "online" ? "#10b981" : "#ef4444", marginTop: 6 }}>API: {apiStatus}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {Object.entries(accounts).map(([key, a]) => (
          <button key={key} onClick={() => selectRole(key)}
            style={{ ...S.roleBtn, background: role === key ? "#6366f1" : "#f8fafc", color: role === key ? "#fff" : "#334155" }}>
            {a.roleLabel}
          </button>
        ))}
      </div>
      <form onSubmit={submit} style={S.card}>
        <label style={S.label}>Email</label>
        <input style={S.input} value={email} onChange={e => setEmail(e.target.value)} />
        <label style={S.label}>Hasło</label>
        <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <div style={{ background: "#fef2f2", color: "#dc2626", padding: 10, borderRadius: 12, marginBottom: 10, fontSize: 13 }}>{error}</div>}
        <button style={S.primaryBtn} disabled={loading}>{loading ? "Logowanie..." : "Zaloguj się"}</button>
      </form>
      <div style={{ ...S.card, fontSize: 12, lineHeight: 1.8 }}>
        <b>Konta demo:</b><br />
        student@edusync.edu / password123<br />
        teacher@edusync.edu / password123<br />
        admin@edusync.edu   / password123
      </div>
    </div>
  );
}

function Header({ user, subtitle }) {
  const name = user.full_name || user.name || user.email || "User";
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
      <div style={S.avatar}>{initials}</div>
      <div>
        <div style={S.muted}>{subtitle}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{name}</div>
        <div style={S.muted}>{user.role}</div>
      </div>
    </div>
  );
}

function Metric({ n, label }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 26, fontWeight: 900 }}>{n}</div>
      <div style={S.muted}>{label}</div>
    </div>
  );
}

// ─── StartScreen ──────────────────────────────────────────────────────────────
function StartScreen({ user, courses, notifications, onNav, token }) {
  const [nextAssignment, setNextAssignment] = useState(null);

  useEffect(() => {
    apiFetch("/api/assignments/me", token)
      .then(items => {
        const notSubmitted = items.filter(a => !a.submission_id);
        setNextAssignment(notSubmitted[0] || null);
      })
      .catch(() => setNextAssignment(null));
  }, [token]);

  return (
    <div style={S.screen}>
      <Header user={user} subtitle="Dzień dobry 👋" />

      <div style={S.card}>
        <div style={S.kicker}>Najbliższe zadanie</div>

        {nextAssignment ? (
          <>
            <h3 style={{ margin: "6px 0 4px" }}>{nextAssignment.title}</h3>
            <p style={S.muted}>{nextAssignment.course_title}</p>
            <p style={S.muted}>Termin: {nextAssignment.deadline?.slice(0, 10)}</p>
            <button style={S.outlineBtn} onClick={() => onNav("courses")}>
              Przejdź do zadania
            </button>
          </>
        ) : (
          <>
            <h3 style={{ margin: "6px 0 4px" }}>Brak aktywnych zadań</h3>
            <p style={S.muted}>Nie masz teraz żadnego zadania do wykonania.</p>
          </>
        )}
      </div>

      <div style={S.card}>
        <div style={S.row}>
          <b>Aktywne kursy ({courses.length})</b>
          <button style={S.linkBtn} onClick={() => onNav("courses")}>Zobacz</button>
        </div>
        {courses.length === 0 && <div style={S.muted}>Brak zapisanych kursów</div>}
        {courses.map(c => <div key={c.id} style={S.listItem}>📚 {c.title}</div>)}
      </div>

      <div style={S.card}>
        <b>Powiadomienia</b>
        {notifications.length === 0 && <div style={{ ...S.muted, marginTop: 6 }}>Brak nowych powiadomień</div>}
        {notifications.map(n => (
          <div key={n.id} style={{ ...S.listItem, display: "flex", gap: 8 }}>
            <span>🔔</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
              <div style={S.muted}>{n.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TeacherScreen ────────────────────────────────────────────────────────────
function TeacherScreen({ user, courses, onCreateCourse, onNav }) {
  const [title, setTitle] = useState("Nowy kurs");
  const [msg, setMsg]     = useState("");

  const create = async () => {
    try { await onCreateCourse(title); setMsg("Kurs utworzony ✓"); }
    catch (e) { setMsg("Błąd: " + e.message); }
  };

  return (
    <div style={S.screen}>
      <Header user={user} subtitle="Panel wykładowcy" />
      <div style={{ ...S.notice, background: "#ecfdf5", color: "#047857", border: "1px solid #bbf7d0" }}>WERSJA V5 — usuwanie rozwiązań aktywne. Wejdź: Kursy → otwórz kurs, tam są pola upload.</div>
      <Notice msg={msg} />
      <div style={S.card}>
        <div style={S.grid2}>
          <Metric n={courses.length} label="Moje kursy" />
          <Metric n="–" label="Do oceny" />
        </div>
      </div>
      <div style={S.card}>
        <b>Dodaj kurs</b>
        <input style={S.input} value={title} onChange={e => setTitle(e.target.value)} />
        <button style={S.primaryBtn} onClick={create}>Utwórz kurs</button>
      </div>
      <div style={S.card}>
        <b>Szybkie akcje</b>
        <button style={S.outlineBtn} onClick={() => onNav("courses")}>Kursy: materiały / pliki / zadania</button>
        <button style={{ ...S.outlineBtn, marginTop: 8 }} onClick={() => onNav("tasks")}>Sprawdź zadania studentów</button>
      </div>
    </div>
  );
}

// ─── CoursesScreen ────────────────────────────────────────────────────────────
function CoursesScreen({ token, role }) {
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(null);

  const [matTitle, setMatTitle] = useState("Nowy materiał");
  const [matUrl, setMatUrl] = useState("");
  const [matFile, setMatFile] = useState(null);

  const [asgTitle, setAsgTitle] = useState("Nowe zadanie");
  const [asgDesc, setAsgDesc] = useState("Opis zadania");
  const [asgDl, setAsgDl] = useState("2026-06-01T23:59:00");
  const [asgFile, setAsgFile] = useState(null);

  const [msg, setMsg] = useState("");
  const [subContent, setSubContent] = useState({});
  const [submitMsgs, setSubmitMsgs] = useState({});
  const [subFiles, setSubFiles] = useState({});

  const loadCourses = useCallback(() => {
    apiFetch("/api/courses", token).then(setCourses).catch(e => setMsg(e.message));
  }, [token]);

  useEffect(loadCourses, [loadCourses]);

  const open = useCallback((id) => {
    apiFetch(`/api/courses/${id}`, token).then(setSelected).catch(e => setMsg(e.message));
  }, [token]);

  const addMaterial = async () => {
    const moduleId = selected?.modules?.[0]?.id;
    if (!moduleId) return setMsg("Najpierw potrzebny jest moduł kursu");
    if (!matTitle.trim()) return setMsg("Wpisz tytuł materiału");
    if (!matFile && !matUrl.trim()) return setMsg("Dodaj plik albo link do materiału");

    const fd = new FormData();
    fd.append("title", matTitle.trim());
    fd.append("material_type", matFile ? "file" : "link");
    fd.append("url", matUrl.trim());
    if (matFile) fd.append("file", matFile);

    try {
      await apiFetch(`/api/modules/${moduleId}/materials`, token, { method: "POST", body: fd });
      setMsg("Materiał dodany ✓");
      setMatTitle("Nowy materiał");
      setMatUrl("");
      setMatFile(null);
      open(selected.id);
    } catch (e) {
      setMsg("Błąd: " + e.message);
    }
  };

  const addAssignment = async () => {
    const moduleId = selected?.modules?.[0]?.id;
    if (!moduleId) return setMsg("Najpierw potrzebny jest moduł kursu");
    if (!asgTitle.trim()) return setMsg("Wpisz tytuł zadania");

    const fd = new FormData();
    fd.append("title", asgTitle.trim());
    fd.append("description", asgDesc.trim());
    fd.append("deadline", asgDl);
    if (asgFile) fd.append("file", asgFile);

    try {
      await apiFetch(`/api/modules/${moduleId}/assignments`, token, { method: "POST", body: fd });
      setMsg("Zadanie dodane ✓");
      setAsgFile(null);
      open(selected.id);
    } catch (e) {
      setMsg("Błąd: " + e.message);
    }
  };

  const submitAssignment = async (assignmentId) => {
    const text = subContent[assignmentId] || "";
    const file = subFiles[assignmentId] || null;
    if (!text.trim() && !file) {
      return setSubmitMsgs(p => ({ ...p, [assignmentId]: "Wpisz odpowiedź albo wybierz plik" }));
    }

    const fd = new FormData();
    fd.append("content", text);
    if (file) fd.append("file", file);

    try {
      await apiFetch(`/api/assignments/${assignmentId}/submit`, token, { method: "POST", body: fd });
      setSubmitMsgs(p => ({ ...p, [assignmentId]: "Zadanie przesłane ✓" }));
      setSubContent(p => ({ ...p, [assignmentId]: "" }));
      setSubFiles(p => ({ ...p, [assignmentId]: null }));
      if (selected?.id) open(selected.id);
    } catch (e) {
      setSubmitMsgs(p => ({ ...p, [assignmentId]: "Błąd: " + e.message }));
    }
  };

  const deleteAssignment = async (assignmentId) => {
    if (!confirm("Usunąć zadanie?")) return;
    try {
      await apiFetch(`/api/assignments/${assignmentId}`, token, { method: "DELETE" });
      setMsg("Zadanie usunięte ✓");
      open(selected.id);
    } catch (e) {
      setMsg("Błąd: " + e.message);
    }
  };

  const deleteMySubmission = async (assignmentId) => {
    if (!confirm("Usunąć wysłane rozwiązanie?")) return;
    try {
      await apiFetch(`/api/assignments/${assignmentId}/submission/me`, token, { method: "DELETE" });
      setSubmitMsgs(p => ({ ...p, [assignmentId]: "Rozwiązanie usunięte ✓" }));
      setSubContent(p => ({ ...p, [assignmentId]: "" }));
      setSubFiles(p => ({ ...p, [assignmentId]: null }));
      if (selected?.id) open(selected.id);
    } catch (e) {
      setSubmitMsgs(p => ({ ...p, [assignmentId]: "Błąd: " + e.message }));
    }
  };

  return (
    <div style={S.screen}>
      <h2>Kursy</h2>
      <Notice msg={msg} />

      {!selected ? (
        <div style={S.card}>
          {courses.length === 0 && <div style={S.muted}>Brak kursów. Kurs pojawi się tutaj dopiero po utworzeniu przez wykładowcę.</div>}
          {courses.map(c => (
            <button key={c.id} style={S.courseBtn} onClick={() => open(c.id)}>📚 {c.title}<span>›</span></button>
          ))}
        </div>
      ) : (
        <div>
          <button style={{ ...S.linkBtn, marginBottom: 10 }} onClick={() => { setSelected(null); setMsg(""); loadCourses(); }}>← Wróć</button>

          <div style={S.card}>
            <h3 style={{ margin: "0 0 4px" }}>{selected.title}</h3>
            <p style={S.muted}>{selected.description}</p>

            {selected.modules?.map(m => (
              <div key={m.id} style={{ marginTop: 14 }}>
                <b>📂 Moduł: {m.title}</b>

                <div style={{ marginTop: 8 }}>
                  <b style={{ fontSize: 13 }}>Materiały</b>
                  {m.materials?.length === 0 && <div style={S.muted}>Brak materiałów</div>}
                  {m.materials?.map(x => (
                    <div key={x.id} style={S.listItem}>
                      📄 <a href={x.url?.startsWith("/uploads") ? `${API}${x.url}` : x.url} target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>
                        {x.title || x.file_name || "Materiał"}
                      </a>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <b style={{ fontSize: 13 }}>Zadania</b>
                  {m.assignments?.length === 0 && <div style={S.muted}>Brak zadań</div>}
                  {m.assignments?.map(a => (
                    <div key={a.id} style={{ background: "#f8fafc", borderRadius: 12, padding: 12, marginTop: 8 }}>
                      <div style={{ fontWeight: 700 }}>📝 {a.title}</div>
                      <div style={{ ...S.muted, marginTop: 4, whiteSpace: "pre-wrap" }}>{a.description}</div>
                      <div style={{ ...S.muted, fontSize: 11, marginTop: 4 }}>Termin: {a.deadline?.slice(0, 10)}</div>

                      {a.file_url && (
                        <div style={{ marginTop: 8 }}>
                          📎 Plik do zadania: <a href={`${API}${a.file_url}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>
                            {a.file_name || "Otwórz plik"}
                          </a>
                        </div>
                      )}

                      {role !== "student" && (
                        <button
                          style={{ ...S.outlineBtn, marginTop: 8, color: "#ef4444", borderColor: "#fecaca" }}
                          onClick={() => deleteAssignment(a.id)}
                        >
                          Usuń zadanie
                        </button>
                      )}

                      {role === "student" && (
                        <div style={{ marginTop: 10 }}>
                          {a.submission_id && (
                            <div style={{ background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 10, padding: 10, marginBottom: 8, color: "#047857", fontSize: 13 }}>
                              <div style={{ fontWeight: 700 }}>Już wysłano odpowiedź: {a.submitted_at?.slice(0, 16)}</div>
                              <div style={{ marginTop: 8, color: "#0f172a" }}>
                                <b>Moja odpowiedź:</b>
                                <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                                  {a.submission_content?.trim() || "Brak odpowiedzi tekstowej."}
                                </div>
                                {a.submission_file_url && (
                                  <div style={{ marginTop: 6 }}>
                                    📎 Mój plik: <a href={`${API}${a.submission_file_url}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>
                                      {a.submission_file_name || "Otwórz plik"}
                                    </a>
                                  </div>
                                )}
                              </div>
                              {a.submission_grade_id ? (
                                <div style={{ marginTop: 8 }}>Praca jest już oceniona — nie można jej usunąć ani zmienić.</div>
                              ) : (
                                <button
                                  style={{ ...S.outlineBtn, marginTop: 8, color: "#ef4444", borderColor: "#fecaca" }}
                                  onClick={() => deleteMySubmission(a.id)}
                                >
                                  Usuń moje rozwiązanie
                                </button>
                              )}
                            </div>
                          )}

                          <label style={S.label}>{a.submission_id ? "Popraw / wyślij ponownie odpowiedź tekstową" : "Odpowiedź tekstowa"}</label>
                          <textarea
                            style={{ ...S.input, height: 90, resize: "vertical" }}
                            placeholder="Twoja odpowiedź..."
                            value={subContent[a.id] || ""}
                            onChange={e => setSubContent(p => ({ ...p, [a.id]: e.target.value }))}
                          />

                          <label style={S.label}>Załącz plik odpowiedzi</label>
                          <input
                            style={S.input}
                            type="file"
                            onChange={e => setSubFiles(p => ({ ...p, [a.id]: e.target.files?.[0] || null }))}
                          />

                          <button
                            style={S.primaryBtn}
                            disabled={!!a.submission_grade_id}
                            onClick={() => submitAssignment(a.id)}
                          >
                            {a.submission_id ? "Wyślij poprawione rozwiązanie" : "Prześlij rozwiązanie"}
                          </button>

                          {submitMsgs[a.id] && <Notice msg={submitMsgs[a.id]} />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {role !== "student" && (
              <>
                <hr style={S.hr} />
                <b>Dodaj materiał</b>
                <div style={{ ...S.muted, marginTop: 4 }}>Wersja v5: można dodać link albo plik.</div>
                <label style={S.label}>Tytuł materiału</label>
                <input style={S.input} value={matTitle} onChange={e => setMatTitle(e.target.value)} />
                <label style={S.label}>Link do materiału — opcjonalnie</label>
                <input style={S.input} placeholder="https://..." value={matUrl} onChange={e => setMatUrl(e.target.value)} />
                <label style={S.label}>Albo załącz plik materiału</label>
                <input style={S.input} type="file" onChange={e => setMatFile(e.target.files?.[0] || null)} />
                <button style={S.primaryBtn} onClick={addMaterial}>Dodaj materiał</button>

                <hr style={S.hr} />
                <b>Dodaj zadanie</b>
                <div style={{ ...S.muted, marginTop: 4 }}>Wersja v5: można dodać plik do zadania.</div>
                <label style={S.label}>Tytuł</label>
                <input style={S.input} placeholder="Tytuł" value={asgTitle} onChange={e => setAsgTitle(e.target.value)} />
                <label style={S.label}>Opis zadania</label>
                <textarea style={{ ...S.input, height: 80, resize: "vertical" }} placeholder="Opis" value={asgDesc} onChange={e => setAsgDesc(e.target.value)} />
                <label style={S.label}>Termin</label>
                <input style={S.input} placeholder="Deadline ISO" value={asgDl} onChange={e => setAsgDl(e.target.value)} />
                <label style={S.label}>Plik do zadania — opcjonalnie</label>
                <input style={S.input} type="file" onChange={e => setAsgFile(e.target.files?.[0] || null)} />
                <button style={S.primaryBtn} onClick={addAssignment}>Dodaj zadanie</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GradesScreen (real API) ──────────────────────────────────────────────────
function GradesScreen({ token }) {
  const [grades, setGrades]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/grades/me", token).then(setGrades).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={S.screen}>
      <h2>Moje oceny</h2>
      {loading && <div style={S.muted}>Ładowanie…</div>}
      {!loading && grades.length === 0 && <div style={S.card}><div style={S.muted}>Brak ocen</div></div>}
      {grades.map(g => (
        <div key={g.id} style={S.card}>
          <div style={S.row}>
            <div>
              <div style={{ fontWeight: 700 }}>{g.course_title}</div>
              <div style={S.muted}>{g.comment || "Brak komentarza"}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#6366f1" }}>{g.value}</div>
          </div>
          <div style={{ ...S.muted, fontSize: 11, marginTop: 4 }}>{g.created_at?.slice(0, 10)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── TasksScreen (teacher, real API) ─────────────────────────────────────────
function TasksScreen({ token }) {
  const [assignments, setAssignments] = useState([]);
  const [subs, setSubs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [gradeVal, setGradeVal] = useState({});
  const [gradeComment, setGradeComment] = useState({});
  const [msg, setMsg] = useState("");

  const loadAssignments = useCallback(() => {
    apiFetch("/api/courses", token).then(async (courses) => {
      const details = await Promise.all(courses.map(c => apiFetch(`/api/courses/${c.id}`, token)));
      setAssignments(details.flatMap(c =>
        (c.modules || []).flatMap(m =>
          (m.assignments || []).map(a => ({ ...a, courseTitle: c.title, moduleTitle: m.title }))
        )
      ));
    }).catch(e => setMsg(e.message));
  }, [token]);

  useEffect(loadAssignments, [loadAssignments]);

  const loadSubs = (assignment) => {
    setSelected(assignment.id);
    setSelectedAssignment(assignment);
    apiFetch(`/api/assignments/${assignment.id}/submissions`, token).then(setSubs).catch(e => setMsg(e.message));
  };

  const grade = async (submissionId) => {
    const v = parseFloat(gradeVal[submissionId]);
    if (!v) return setMsg("Wpisz ocenę (np. 4.5)");
    try {
      await apiFetch(`/api/submissions/${submissionId}/grade`, token, {
        method: "POST",
        body: JSON.stringify({ value: v, comment: gradeComment[submissionId] || "" }),
      });
      setMsg("Ocena wystawiona ✓");
      if (selectedAssignment) loadSubs(selectedAssignment);
    } catch (e) {
      setMsg("Błąd: " + e.message);
    }
  };

  const deleteSubmission = async (submissionId) => {
    if (!confirm("Usunąć rozwiązanie studenta?")) return;
    try {
      await apiFetch(`/api/submissions/${submissionId}`, token, { method: "DELETE" });
      setMsg("Rozwiązanie usunięte ✓");
      if (selectedAssignment) loadSubs(selectedAssignment);
    } catch (e) {
      setMsg("Błąd: " + e.message);
    }
  };

  const ungradedCount = assignments.reduce((sum, a) => sum + (a.ungraded_count || 0), 0);

  return (
    <div style={S.screen}>
      <h2>Zadania studentów</h2>
      <Notice msg={msg} />

      {!selected ? (
        <div style={S.card}>
          <b>Wybierz zadanie do sprawdzenia</b>
          {assignments.length === 0 && <div style={S.muted}>Brak zadań</div>}
          {assignments.map(a => (
            <button key={a.id} style={S.courseBtn} onClick={() => loadSubs(a)}>
              📝 {a.title}
              <span style={S.muted}>({a.courseTitle})</span>
              <span>›</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button
            style={{ ...S.linkBtn, marginBottom: 10 }}
            onClick={() => { setSelected(null); setSelectedAssignment(null); setSubs([]); loadAssignments(); }}
          >
            ← Wróć
          </button>

          <div style={S.card}>
            <b>Przesłane prace</b>
            {selectedAssignment && (
              <div style={{ ...S.muted, marginTop: 4 }}>
                Zadanie: {selectedAssignment.title} · {selectedAssignment.courseTitle}
              </div>
            )}

            {subs.length === 0 && <div style={S.muted}>Brak przesłanych prac</div>}

            {subs.map(sub => (
              <div key={sub.id} style={{ background: "#f8fafc", borderRadius: 12, padding: 12, marginTop: 10 }}>
                <div style={{ fontWeight: 700 }}>
                  {sub.full_name} <span style={S.muted}>({sub.email})</span>
                </div>

                <div style={{ ...S.muted, fontSize: 11, marginTop: 4 }}>
                  Przesłano: {sub.submitted_at?.slice(0, 16)}
                </div>

                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, marginTop: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Odpowiedź studenta:</div>
                  <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: sub.content?.trim() ? "#0f172a" : "#94a3b8" }}>
                    {sub.content?.trim() || "Student nie wpisał odpowiedzi tekstowej."}
                  </div>

                  {sub.file_url ? (
                    <div style={{ marginTop: 10 }}>
                      📎 Plik studenta: <a href={`${API}${sub.file_url}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>
                        {sub.file_name || "Otwórz plik"}
                      </a>
                    </div>
                  ) : (
                    <div style={{ ...S.muted, marginTop: 8 }}>Brak załączonego pliku.</div>
                  )}
                </div>

                {sub.grade_id ? (
                  <div style={{ background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 10, padding: 10, marginTop: 10 }}>
                    <div style={{ fontWeight: 700, color: "#047857" }}>Oceniono: {sub.grade_value}</div>
                    <div style={{ ...S.muted, marginTop: 4 }}>Komentarz: {sub.grade_comment || "Brak komentarza"}</div>
                    <div style={{ ...S.muted, fontSize: 11, marginTop: 4 }}>Data oceny: {sub.graded_at?.slice(0, 16)}</div>
                  </div>
                ) : (
                  <>
                    <button
                      style={{ ...S.outlineBtn, marginTop: 8, color: "#ef4444", borderColor: "#fecaca" }}
                      onClick={() => deleteSubmission(sub.id)}
                    >
                      Usuń rozwiązanie studenta
                    </button>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <input
                        style={{ ...S.input, width: 80, margin: 0 }}
                        placeholder="Ocena"
                        value={gradeVal[sub.id] || ""}
                        onChange={e => setGradeVal(p => ({ ...p, [sub.id]: e.target.value }))}
                      />
                      <input
                        style={{ ...S.input, flex: 1, margin: 0 }}
                        placeholder="Komentarz"
                        value={gradeComment[sub.id] || ""}
                        onChange={e => setGradeComment(p => ({ ...p, [sub.id]: e.target.value }))}
                      />
                    </div>
                    <button style={{ ...S.primaryBtn, marginTop: 6 }} onClick={() => grade(sub.id)}>
                      Wystaw ocenę
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MessagesScreen (real API + reply) ───────────────────────────────────────
function MessagesScreen({ token, user }) {
  const [messages, setMessages] = useState([]);
  const [users, setUsers]       = useState([]);
  const [replyTo, setReplyTo]   = useState(null);
  const [compose, setCompose]   = useState(false);
  const [toId, setToId]         = useState("");
  const [subject, setSubject]   = useState("");
  const [body, setBody]         = useState("");
  const [msg, setMsg]           = useState("");
  const [loading, setLoading]   = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/messages", token),
      apiFetch("/api/users", token).catch(() => []),
    ]).then(([msgs, usrs]) => {
      setMessages(msgs);
      setUsers(usrs.filter(u => u.id !== user.id));
    }).catch(e => setMsg(e.message))
      .finally(() => setLoading(false));
  }, [token, user.id]);

  useEffect(load, [load]);

  const send = async () => {
    const rid = replyTo ? replyTo.sender_id : parseInt(toId);
    const sub = replyTo ? `Re: ${replyTo.subject}` : subject;
    if (!rid || !body.trim()) return setMsg("Wypełnij wymagane pola");
    try {
      await apiFetch("/api/messages", token, {
        method: "POST",
        body: JSON.stringify({
          receiver_id: rid,
          subject: sub,
          body,
          reply_to_id: replyTo ? replyTo.id : null,
        }),
      });
      setMsg("Wiadomość wysłana ✓");
      setBody(""); setSubject(""); setToId(""); setReplyTo(null); setCompose(false);
      load();
    } catch (e) { setMsg("Błąd: " + e.message); }
  };

  if (compose || replyTo) {
    return (
      <div style={S.screen}>
        <button style={{ ...S.linkBtn, marginBottom: 10 }} onClick={() => { setCompose(false); setReplyTo(null); }}>← Wróć</button>
        <h2>{replyTo ? `Odpowiedź → ${replyTo.name}` : "Nowa wiadomość"}</h2>
        <Notice msg={msg} />
        <div style={S.card}>
          {!replyTo && (
            <>
              <label style={S.label}>Do:</label>
              <select style={S.input} value={toId} onChange={e => setToId(e.target.value)}>
                <option value="">– wybierz odbiorcę –</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
              </select>
              <label style={S.label}>Temat:</label>
              <input style={S.input} value={subject} onChange={e => setSubject(e.target.value)} />
            </>
          )}
          {replyTo && (
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 10, marginBottom: 10 }}>
              <div style={S.muted}>Temat: {replyTo.subject}</div>
            </div>
          )}
          <label style={S.label}>Treść:</label>
          <textarea style={{ ...S.input, height: 100, resize: "vertical" }} value={body} onChange={e => setBody(e.target.value)} placeholder="Treść wiadomości..." />
          <button style={S.primaryBtn} onClick={send}>Wyślij ✉️</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.screen}>
      <div style={{ ...S.row, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Wiadomości</h2>
        <button style={{ ...S.primaryBtn, width: "auto", marginTop: 0, padding: "8px 14px" }}
          onClick={() => { setCompose(true); setReplyTo(null); }}>+ Nowa</button>
      </div>
      <Notice msg={msg} />
      {loading && <div style={S.muted}>Ładowanie…</div>}
      {!loading && messages.length === 0 && <div style={S.card}><div style={S.muted}>Brak wiadomości</div></div>}
      {messages.map(m => (
        <div key={m.id} style={{ ...S.card, borderLeft: m.is_read ? "3px solid #e2e8f0" : "3px solid #6366f1" }}>
          <div style={S.row}>
            <div>
              <div style={{ fontWeight: 700 }}>{m.sender_name}</div>
              <div style={{ fontSize: 13, color: "#334155" }}>{m.subject}</div>
            </div>
            <div style={{ ...S.muted, fontSize: 11 }}>{m.created_at?.slice(0, 10)}</div>
          </div>
          <p style={{ ...S.muted, marginTop: 6, marginBottom: 8 }}>{m.body}</p>
          <button
            style={{ ...S.outlineBtn, marginTop: 0, padding: "6px 12px", fontSize: 12 }}
            onClick={() => {
              setReplyTo({
                id: m.id,
                sender_id: m.sender_id,
                name: m.sender_name,
                subject: m.subject,
              });
              setCompose(true);
            }}
          >
            ↩ Odpowiedz
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── MoreScreen ───────────────────────────────────────────────────────────────
function MoreScreen({ user, onLogout }) {
  return (
    <div style={S.screen}>
      <Header user={user} subtitle="Profil" />
      <div style={S.card}>
        <div style={S.listItem}>📧 {user.email}</div>
        <div style={S.listItem}>🎭 Rola: {user.role}</div>
        <div style={S.listItem}>🆔 ID: #{user.id}</div>
      </div>
      {["Ustawienia", "Pomoc", "O aplikacji EduSync"].map(i => (
        <button key={i} style={S.courseBtn} onClick={() => alert(i)}>⚙️ {i}<span>›</span></button>
      ))}
      <button style={{ ...S.outlineBtn, color: "#ef4444", borderColor: "#fecaca", width: "100%", marginTop: 14 }} onClick={onLogout}>
        ↪ Wyloguj się
      </button>
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <nav style={S.tabBar}>
      {tabs.map(([id, icon, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            ...S.tabBtn,
            ...(active === id ? S.tabBtnActive : {}),
          }}
        >
          <span style={S.tabIcon}>{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [time, setTime]         = useState(new Date());
  const [apiStatus, setApiStatus] = useState("sprawdzanie...");
  // ✅ ИСПРАВЛЕНО: используем отдельный ключ edusync_auth
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem("edusync_auth") || "null"); }
    catch { return null; }
  });
  const [screen, setScreen]     = useState(() => {
    try {
      const a = JSON.parse(localStorage.getItem("edusync_auth") || "null");
      return (a?.user?.role === "teacher" || a?.user?.role === "admin") ? "teacher" : "start";
    } catch { return "start"; }
  });
  const [courses, setCourses]           = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch(`${API}/health`).then(r => setApiStatus(r.ok ? "online" : "offline")).catch(() => setApiStatus("offline"));
  }, []);

  useEffect(() => {
    if (!auth) return;
    localStorage.setItem("edusync_auth", JSON.stringify(auth));
    apiFetch("/api/courses", auth.token).then(setCourses).catch(() => setCourses([]));
    apiFetch("/api/notifications", auth.token).then(setNotifications).catch(() => setNotifications([]));
  }, [auth]);

  // ✅ ИСПРАВЛЕНО: logout полностью сбрасывает state
  const logout = useCallback(() => {
    localStorage.removeItem("edusync_auth");
    setAuth(null);
    setCourses([]);
    setNotifications([]);
    setScreen("start");
  }, []);

  // ✅ ИСПРАВЛЕНО: при логине правильно определяем начальный экран
  const handleLogin = useCallback((newAuth) => {
    const role = newAuth.user.role;
    setAuth(newAuth);
    setScreen((role === "teacher" || role === "admin") ? "teacher" : "start");
  }, []);

  const createCourse = async (title) => {
    await apiFetch("/api/courses", auth.token, { method: "POST", body: JSON.stringify({ title, description: "Kurs utworzony z UI" }) });
    const updated = await apiFetch("/api/courses", auth.token);
    setCourses(updated);
  };

  const role = auth?.user?.role;
  const tabs = (role === "teacher" || role === "admin") ? teacherTabs : studentTabs;

  const content = useMemo(() => {
    if (!auth) return <LoginScreen apiStatus={apiStatus} onLogin={handleLogin} />;
    const s = screen;
    if (s === "teacher" || (s === "start" && (role === "teacher" || role === "admin")))
      return <TeacherScreen user={auth.user} courses={courses} onCreateCourse={createCourse} onNav={setScreen} />;
    if (s === "start")
      return <StartScreen user={auth.user} courses={courses} notifications={notifications} onNav={setScreen} token={auth.token} />;
    if (s === "courses")  return <CoursesScreen token={auth.token} role={role} />;
    if (s === "grades")   return <GradesScreen token={auth.token} />;
    if (s === "tasks")    return <TasksScreen token={auth.token} />;
    if (s === "messages") return <MessagesScreen token={auth.token} user={auth.user} />;
    return <MoreScreen user={auth.user} onLogout={logout} />;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, apiStatus, screen, courses, notifications]);

  if (!auth) {
    return (
      <div style={S.wrapper}>
        <section style={S.loginLayout}>
          <div style={S.loginIntro}>
            <div style={S.logoBig}><span style={{ color: "#6366f1" }}>Edu</span>Sync</div>
            <h1 style={S.heroTitle}>Desktop LMS для курсов, заданий и сообщений</h1>
            <p style={S.heroText}>
              Компьютерная версия интерфейса: широкая рабочая область, боковое меню, карточки курсов, загрузка файлов и проверка работ.
            </p>
            <div style={S.badgeRow}>
              {["Upload plików", "Zadania", "Oceny", "Wiadomości", "Docker"].map(t => <span key={t} style={S.techTag}>{t}</span>)}
            </div>
            <div style={{ ...S.status, color: apiStatus === "online" ? "#10b981" : "#ef4444", marginTop: 18 }}>
              API: {apiStatus}
            </div>
          </div>
          <div style={S.loginPanel}>{content}</div>
        </section>
      </div>
    );
  }

  return (
    <div style={S.wrapper}>
      <div style={S.desktopShell}>
        <aside style={S.sidebar}>
          <div style={S.sidebarLogo}><span style={{ color: "#6366f1" }}>Edu</span>Sync</div>
          <div style={S.versionBadge}>Microservices V1 — API Gateway + 4 usługi</div>
          <TabBar tabs={tabs} active={screen} onChange={setScreen} />

          <div style={S.sidebarUser}>
            <div style={{ fontWeight: 900 }}>{auth.user.full_name || auth.user.email}</div>
            <div style={S.muted}>{auth.user.email}</div>
            <div style={{ ...S.status, color: apiStatus === "online" ? "#10b981" : "#ef4444", marginTop: 8 }}>
              API: {apiStatus}
            </div>
            <button style={{ ...S.outlineBtn, color: "#ef4444", borderColor: "#fecaca", marginTop: 12 }} onClick={logout}>
              Wyloguj
            </button>
          </div>
        </aside>

        <main style={S.mainArea}>
          <header style={S.topbar}>
            <div>
              <div style={S.muted}>EduSync Desktop</div>
              <h1 style={{ margin: 0, fontSize: 26 }}>Panel roboczy</h1>
            </div>
            <div style={S.topbarRight}>
              <span>{time.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</span>
              <span style={S.rolePill}>{auth.user.role}</span>
            </div>
          </header>
          <div style={S.content}>{content}</div>
        </main>
      </div>
    </div>
  );
}

const S = {
  wrapper:    { minHeight: "100vh", background: "linear-gradient(135deg,#eef2ff 0%,#f8fafc 42%,#eff6ff 100%)", padding: 28, fontFamily: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#0f172a" },
  desktopShell: { maxWidth: 1440, minHeight: "calc(100vh - 56px)", margin: "0 auto", display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", background: "rgba(255,255,255,.72)", border: "1px solid rgba(226,232,240,.95)", borderRadius: 28, boxShadow: "0 24px 70px rgba(15,23,42,.12)", overflow: "hidden", backdropFilter: "blur(14px)" },
  sidebar:    { background: "#ffffff", borderRight: "1px solid #e2e8f0", padding: 24, display: "flex", flexDirection: "column", gap: 18 },
  sidebarLogo:{ fontSize: 30, fontWeight: 950, letterSpacing: "-.04em" },
  versionBadge:{ padding: "9px 10px", borderRadius: 12, background: "#ecfdf5", color: "#047857", fontWeight: 900, fontSize: 12, border: "1px solid #bbf7d0" },
  sidebarUser:{ marginTop: "auto", padding: 14, borderRadius: 18, background: "#f8fafc", border: "1px solid #e2e8f0" },
  mainArea:   { minWidth: 0, display: "flex", flexDirection: "column", background: "rgba(248,250,252,.66)" },
  topbar:     { height: 82, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 34px", background: "rgba(255,255,255,.86)", borderBottom: "1px solid #e2e8f0" },
  topbarRight:{ display: "flex", alignItems: "center", gap: 12, fontWeight: 800, color: "#334155" },
  rolePill:   { padding: "8px 12px", borderRadius: 999, background: "#eef2ff", color: "#4f46e5", fontWeight: 900, textTransform: "capitalize" },
  content:    { flex: 1, overflowY: "auto", padding: "0 0 34px" },
  screen:     { padding: "30px 34px", maxWidth: 1180, margin: "0 auto" },

  loginLayout:{ maxWidth: 1180, minHeight: "calc(100vh - 56px)", margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 460px", gap: 28, alignItems: "center" },
  loginIntro: { background: "linear-gradient(135deg,#ffffff,#eef2ff)", border: "1px solid #e2e8f0", borderRadius: 30, padding: 44, boxShadow: "0 24px 70px rgba(15,23,42,.10)" },
  loginPanel: { background: "rgba(255,255,255,.88)", border: "1px solid #e2e8f0", borderRadius: 30, padding: 20, boxShadow: "0 24px 70px rgba(15,23,42,.10)" },
  logoBig:    { fontSize: 46, fontWeight: 950, letterSpacing: "-.05em", marginBottom: 24 },
  heroTitle:  { fontSize: 44, lineHeight: 1.05, margin: "0 0 18px", letterSpacing: "-.05em" },
  heroText:   { color: "#475569", fontSize: 17, lineHeight: 1.75, maxWidth: 680 },
  badgeRow:   { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 },

  avatar:     { width: 58, height: 58, borderRadius: 20, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, flexShrink: 0 },
  card:       { background: "white", border: "1px solid #e2e8f0", borderRadius: 22, padding: 22, marginBottom: 18, boxShadow: "0 10px 30px rgba(15,23,42,.055)" },
  row:        { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 },
  grid2:      { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16 },
  muted:      { color: "#64748b", fontSize: 14, lineHeight: 1.55 },
  kicker:     { color: "#6366f1", fontWeight: 900, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em" },
  input:      { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 14, border: "1px solid #cbd5e1", margin: "8px 0 14px", fontSize: 15, outline: "none", fontFamily: "inherit", background: "#fff" },
  label:      { fontSize: 12, color: "#475569", fontWeight: 900, textTransform: "uppercase", letterSpacing: ".04em" },
  primaryBtn: { width: "100%", marginTop: 8, padding: "12px 16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "white", fontWeight: 900, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 10px 20px rgba(99,102,241,.22)" },
  outlineBtn: { marginTop: 10, padding: "10px 14px", borderRadius: 14, border: "1px solid #c7d2fe", background: "#fff", color: "#4f46e5", fontWeight: 900, cursor: "pointer", fontFamily: "inherit" },
  linkBtn:    { border: "none", background: "transparent", color: "#4f46e5", fontWeight: 900, cursor: "pointer", fontFamily: "inherit", fontSize: 14 },
  roleBtn:    { border: "none", borderRadius: 14, padding: "11px 8px", fontWeight: 900, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  courseBtn:  { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 12px", border: "1px solid #e2e8f0", borderRadius: 16, background: "#fff", textAlign: "left", fontSize: 15, cursor: "pointer", color: "#0f172a", fontFamily: "inherit", marginTop: 10 },
  listItem:   { padding: "12px 0", borderBottom: "1px solid #f1f5f9", color: "#334155", fontSize: 14 },

  tabBar:     { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 },
  tabBtn:     { display: "flex", alignItems: "center", gap: 12, width: "100%", border: "1px solid transparent", background: "transparent", color: "#64748b", cursor: "pointer", padding: "12px 14px", borderRadius: 16, fontFamily: "inherit", fontWeight: 850, textAlign: "left", fontSize: 15 },
  tabBtnActive:{ background: "#eef2ff", color: "#4f46e5", borderColor: "#c7d2fe", boxShadow: "inset 0 0 0 1px rgba(99,102,241,.08)" },
  tabIcon:    { fontSize: 19, width: 24, textAlign: "center" },

  techTag:    { display: "inline-block", padding: "7px 11px", borderRadius: 999, background: "#ede9fe", color: "#4f46e5", fontSize: 12, fontWeight: 900, margin: "0 6px 6px 0" },
  status:     { fontSize: 12, fontWeight: 950 },
  hr:         { border: 0, borderTop: "1px solid #e2e8f0", margin: "18px 0" },
  notice:     { padding: "10px 12px", borderRadius: 12, marginBottom: 10, fontSize: 13 },
};
