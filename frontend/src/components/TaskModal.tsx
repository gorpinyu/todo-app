import React, { useEffect, useState } from "react";
import type { Task, Category, Priority, TaskFormData } from "../types";

interface Props {
  task?: Task | null;
  categories: Category[];
  priorities: Priority[];
  onSave: (data: TaskFormData) => void;
  onClose: () => void;
}

const empty: TaskFormData = {
  title: "", description: "", status: "todo",
  priority_id: "", category_id: "", due_date: "",
};

export default function TaskModal({ task, categories, priorities, onSave, onClose }: Props) {
  const [form, setForm] = useState<TaskFormData>(empty);

  useEffect(() => {
    setForm(task ? {
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority_id: task.priority?.id ?? "",
      category_id: task.category?.id ?? "",
      due_date: task.due_date ?? "",
    } : empty);
  }, [task]);

  function set(field: keyof TaskFormData, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task ? "Edit Task" : "New Task"}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input
              className="form-control"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-control"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Add more context..."
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Priority</label>
              <select
                className="form-control"
                value={form.priority_id}
                onChange={(e) => set("priority_id", e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— None —</option>
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                className="form-control"
                value={form.category_id}
                onChange={(e) => set("category_id", e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select
                className="form-control"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="todo">○ To Do</option>
                <option value="inprogress">◑ In Progress</option>
                <option value="completed">● Completed</option>
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input
                type="date"
                className="form-control"
                value={form.due_date}
                onChange={(e) => set("due_date", e.target.value)}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {task ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
