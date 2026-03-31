import type { Task, Comment, TaskFormData, Category, Priority } from "./types";

const BASE = "/api";

export const api = {
  getTasks: (): Promise<Task[]> => fetch(`${BASE}/tasks`).then((r) => r.json()),
  getTask: (id: number): Promise<Task> =>
    fetch(`${BASE}/tasks/${id}`).then((r) => r.json()),
  createTask: (data: TaskFormData): Promise<Task> =>
    fetch(`${BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  updateTask: (id: number, data: Partial<TaskFormData>): Promise<Task> =>
    fetch(`${BASE}/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  deleteTask: (id: number): Promise<void> =>
    fetch(`${BASE}/tasks/${id}`, { method: "DELETE" }).then((r) => r.json()),
  getComments: (taskId: number): Promise<Comment[]> =>
    fetch(`${BASE}/tasks/${taskId}/comments`).then((r) => r.json()),
  addComment: (taskId: number, content: string): Promise<Comment> =>
    fetch(`${BASE}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).then((r) => r.json()),
  deleteComment: (id: number): Promise<void> =>
    fetch(`${BASE}/comments/${id}`, { method: "DELETE" }).then((r) => r.json()),
  getCategories: (): Promise<Category[]> =>
    fetch(`${BASE}/categories`).then((r) => r.json()),
  getPriorities: (): Promise<Priority[]> =>
    fetch(`${BASE}/priorities`).then((r) => r.json()),
};
