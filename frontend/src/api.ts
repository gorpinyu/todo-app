import type { Task, Comment, TaskFormData, Category, Priority } from "./types";

const BASE = "/api";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers as any) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export const api = {
  getTasks: () => request<Task[]>(`${BASE}/tasks`),
  getTask: (id: number) => request<Task>(`${BASE}/tasks/${id}`),
  createTask: (data: TaskFormData) => request<Task>(`${BASE}/tasks`, { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: number, data: Partial<TaskFormData>) => request<Task>(`${BASE}/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTask: (id: number) => request<void>(`${BASE}/tasks/${id}`, { method: "DELETE" }),
  getComments: (taskId: number) => request<Comment[]>(`${BASE}/tasks/${taskId}/comments`),
  addComment: (taskId: number, content: string) => request<Comment>(`${BASE}/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  deleteComment: (id: number) => request<void>(`${BASE}/comments/${id}`, { method: "DELETE" }),
  getCategories: () => request<Category[]>(`${BASE}/categories`),
  getPriorities: () => request<Priority[]>(`${BASE}/priorities`),
};
