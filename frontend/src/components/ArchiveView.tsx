import React, { useEffect, useState } from "react";
import type { Task } from "../types";
import { api } from "../api";
import ConfirmDialog from "./ConfirmDialog";

export default function ArchiveView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  useEffect(() => {
    api.getArchive().then(t => { setTasks(t); setLoading(false); });
  }, []);

  async function handleRestore(id: number) {
    await api.restoreFromArchive(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function handleHardDelete(id: number) {
    await api.hardDeleteFromArchive(id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title: "[Deleted]", description: null } : t));
    setConfirmId(null);
  }

  if (loading) return <div className="archive-empty">Loading…</div>;

  return (
    <div className="archive-wrap">
      <div className="archive-list">
        {tasks.length === 0 && (
          <div className="archive-empty">
            <span style={{ fontSize: "2rem", opacity: 0.2 }}>🗄</span>
            <span>Archive is empty</span>
          </div>
        )}
        {tasks.map(task => (
          <div key={task.id} className={`archive-item${task.title === "[Deleted]" ? " archive-item--deleted" : ""}`}>
            <div className="archive-item-body">
              <span className="archive-item-title">{task.title}</span>
              {task.title !== "[Deleted]" && (
                <div className="archive-item-meta">
                  <span className={`archive-status archive-status--${task.status}`}>{task.status}</span>
                  {task.due_date && <span className="archive-due">Due {task.due_date}</span>}
                  {task.category && <span className="archive-tag">{task.category.emoji} {task.category.name}</span>}
                </div>
              )}
            </div>
            {task.title !== "[Deleted]" && (
              <div className="archive-item-actions">
                <button className="btn-icon" onClick={() => handleRestore(task.id)} title="Restore to board">↩ Restore</button>
                <button className="btn-icon danger" onClick={() => setConfirmId(task.id)} title="Permanently remove details">🗑</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {confirmId !== null && (
        <div className="modal-overlay">
          <ConfirmDialog
            message="This will permanently erase all task details. The entry will remain as [Deleted] with no way to recover it."
            onConfirm={() => handleHardDelete(confirmId)}
            onCancel={() => setConfirmId(null)}
          />
        </div>
      )}
    </div>
  );
}
