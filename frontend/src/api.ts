import type { Task, Comment, TaskFormData, Category, Priority, Project } from "./types";

const BASE = "/api";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  
  // Debug: decode and log token payload
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('[API] Using token for user_id:', payload.user_id, 'email:', payload.email);
    } catch (e) {
      console.error('[API] Failed to decode token:', e);
    }
  }
  
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
  getTasks: (projectId?: number) => request<Task[]>(projectId ? `${BASE}/tasks?project_id=${projectId}` : `${BASE}/tasks`),
  getTask: (id: number) => request<Task>(`${BASE}/tasks/${id}`),
  createTask: (data: TaskFormData) => request<Task>(`${BASE}/tasks`, { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: number, data: Partial<TaskFormData>) => request<Task>(`${BASE}/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTask: (id: number) => request<void>(`${BASE}/tasks/${id}`, { method: "DELETE" }),
  getArchive: () => request<Task[]>(`${BASE}/archive`),
  restoreFromArchive: (id: number) => request<void>(`${BASE}/archive/${id}`, { method: "PUT" }),
  hardDeleteFromArchive: (id: number) => request<void>(`${BASE}/archive/${id}`, { method: "DELETE" }),
  getComments: (taskId: number) => request<Comment[]>(`${BASE}/tasks/${taskId}/comments`),
  addComment: (taskId: number, content: string) => request<Comment>(`${BASE}/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  deleteComment: (id: number) => request<void>(`${BASE}/comments/${id}`, { method: "DELETE" }),
  getCategories: () => request<Category[]>(`${BASE}/categories`),
  getPriorities: () => request<Priority[]>(`${BASE}/priorities`),
  getProjects: (archived = false) => request<Project[]>(`${BASE}/projects?archived=${archived}`),
  createProject: (data: object) => request<Project>(`${BASE}/projects`, { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: number, data: object) => request<Project>(`${BASE}/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  archiveProject: (id: number) => request<{ success: boolean; has_tasks: boolean }>(`${BASE}/projects/${id}`, { method: "DELETE" }),
  restoreProject: (id: number) => request<void>(`${BASE}/projects/${id}/restore`, { method: "PUT" }),
  permanentDeleteProject: (id: number) => request<void>(`${BASE}/projects/${id}/permanent`, { method: "DELETE" }),
};
