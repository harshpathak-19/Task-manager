import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type User = { id: string; email: string; full_name: string | null };
type Task = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "completed";
  assigned_to: string | null;
  assignee?: { email: string } | null;
  creator?: { email: string } | null;
};

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignTo, setAssignTo] = useState("");

  // Every backend call needs the Supabase access token so Flask can
  // verify who's calling (see backend/auth.py).
  const authedFetch = useCallback(
    (path: string, options: RequestInit = {}) =>
      fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          ...(options.headers || {}),
        },
      }),
    [session]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
      } else {
        setSession(data.session);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!session) return;
    authedFetch("/api/tasks").then((r) => r.json()).then(setTasks);
    authedFetch("/api/users").then((r) => r.json()).then(setUsers);
  }, [session, authedFetch]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await authedFetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title, description, assigned_to: assignTo || null }),
    });
    const newTask = await res.json();
    setTasks([newTask, ...tasks]);
    setTitle("");
    setDescription("");
    setAssignTo("");
  };

  const completeTask = async (id: string) => {
    const res = await authedFetch(`/api/tasks/${id}/complete`, { method: "POST" });
    const updated = await res.json();
    setTasks(tasks.map((t) => (t.id === id ? updated : t)));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (!session) return null;

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>My Tasks</h1>
        <button onClick={logout}>Log out</button>
      </div>

      <form onSubmit={createTask} style={{ marginBottom: 32 }}>
        <input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <select
          value={assignTo}
          onChange={(e) => setAssignTo(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        >
          <option value="">Assign to... (optional)</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>
        <button type="submit">Create task</button>
      </form>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {tasks.map((t) => (
          <li
            key={t.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
              marginBottom: 10,
              opacity: t.status === "completed" ? 0.6 : 1,
            }}
          >
            <strong>{t.title}</strong> — {t.status}
            <p style={{ margin: "4px 0" }}>{t.description}</p>
            <small>
              Assigned to: {t.assignee?.email || "unassigned"} · Created by:{" "}
              {t.creator?.email}
            </small>
            {t.status === "pending" && (
              <div>
                <button onClick={() => completeTask(t.id)}>Mark complete</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
