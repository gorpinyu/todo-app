import * as SecureStore from "expo-secure-store";

const BASE_URL = "https://2v4kx3ter9.execute-api.us-east-1.amazonaws.com";

export interface Priority { id: number; name: string; emoji: string; }
export interface Category { id: number; name: string; emoji: string; }
export interface Project { id: number; name: string; emoji: string | null; description: string | null; is_default: boolean; }
export interface Task {
  id: number; title: string; description: string | null;
  status: "todo" | "inprogress" | "completed";
  priority: Priority | null; category: Category | null;
  due_date: string | null; created_at: string; completed_at: string | null; archived: boolean;
  project_id: number | null;
}
export interface Comment { id: number; task_id: number; content: string; created_at: string; }

async function getToken() { return SecureStore.getItemAsync("auth_token"); }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: number; email: string } }>("/api/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    request<{ token: string; user: { id: number; email: string } }>("/api/auth/register", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  forgotPassword: (email: string) =>
    request<{ message: string }>("/api/auth/forgot-password", {
      method: "POST", body: JSON.stringify({ email }),
    }),
  getTasks: (projectId?: number) => request<Task[]>(`/api/tasks${projectId ? `?project_id=${projectId}` : ""}`),
  createTask: (data: object) => request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: number, data: object) => request<Task>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTask: (id: number) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  getCategories: () => request<Category[]>("/api/categories"),
  getPriorities: () => request<Priority[]>("/api/priorities"),
  getProjects: (archived = false) => request<Project[]>(`/api/projects${archived ? "?archived=true" : ""}`),
  createProject: (data: { name: string; emoji?: string; description?: string }) => 
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
  archiveProject: (id: number) => request<{ success: boolean; has_tasks: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
  restoreProject: (id: number) => request<void>(`/api/projects/${id}/restore`, { method: "PUT" }),
  permanentDeleteProject: (id: number) => request<void>(`/api/projects/${id}/permanent`, { method: "DELETE" }),
  getComments: (taskId: number) => request<Comment[]>(`/api/tasks/${taskId}/comments`),
  addComment: (taskId: number, content: string) =>
    request<Comment>(`/api/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  deleteComment: (id: number) => request<void>(`/api/comments/${id}`, { method: "DELETE" }),
};
