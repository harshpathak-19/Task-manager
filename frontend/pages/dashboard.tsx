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

  // Keep `session` in sync with Supabase — this also picks up the
  // fresh access_token whenever Supabase auto-refreshes it in the
  // background, so we stop hitting 401s after ~1 hour.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
      } else {
        setSession(data.session);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!newSession) {
          router.replace("/");
        } else {
          setSession(newSession);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!session) return;

    authedFetch("/api/tasks").then(async (r) => {
      if (!r.ok) {
        setTasks([]);
        return;
      }
      setTasks(await r.json());
    });

    authedFetch("/api/users").then(async (r) => {
      if (!r.ok) {
        setUsers([]);
        return;
      }
      setUsers(await r.json());
    });
  }, [session, authedFetch]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await authedFetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title, description, assigned_to: assignTo || null }),
    });
    if (!res.ok) return;
    const newTask = await res.json();
    setTasks([newTask, ...tasks]);
    setTitle("");
    setDescription("");
    setAssignTo("");
  };

  const completeTask = async (id: string) => {
    const res = await authedFetch(`/api/tasks/${id}/complete`, { method: "POST" });
    if (!res.ok) return;
    const updated = await res.json();
    setTasks(tasks.map((t) => (t.id === id ? updated : t)));
  };

  const deleteTask = async (id: string) => {
    const res = await authedFetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (!session) return null;

  return (
    <main className="max-w-2xl mx-auto mt-10 px-4 font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <button
          onClick={logout}
          className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50"
        >
          Log out
        </button>
      </div>

      <form onSubmit={createTask} className="mb-8 space-y-3">
        <input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
        <select
          value={assignTo}
          onChange={(e) => setAssignTo(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="">Assign to... (optional)</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg"
        >
          Create task
        </button>
      </form>

      <ul className="list-none p-0 space-y-3">
        {Array.isArray(tasks) &&
          tasks.map((t) => (
            <li
              key={t.id}
              className={`border border-gray-200 rounded-lg p-3 ${
                t.status === "completed" ? "opacity-60" : ""
              }`}
            >
              <strong>{t.title}</strong> — {t.status}
              <p className="my-1 text-gray-700">{t.description}</p>
              <small className="text-gray-500">
                Assigned to: {t.assignee?.email || "unassigned"} · Created by:{" "}
                {t.creator?.email}
              </small>
              <div className="mt-2 space-x-2">
                {t.status === "pending" && (
                  <button
                    onClick={() => completeTask(t.id)}
                    className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg"
                  >
                    Mark complete
                  </button>
                )}
                <button
                  onClick={() => deleteTask(t.id)}
                  className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
      </ul>
    </main>
  );
}