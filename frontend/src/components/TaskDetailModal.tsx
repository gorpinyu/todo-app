import React, { useEffect, useState } from "react";
import type { Task, Comment } from "../types";
import { api } from "../api";

interface Props {
  task: Task;
  onClose: () => void;
  onDelete: (id: number) => void;
  onMarkComplete: (id: number) => void;
  onEdit: (task: Task) => void;
}

const statusLabel: Record<string, string> = {
  todo:       "○ To Do",
  inprogress: "◑ In Progress",
  completed:  "● Completed",
};

export default function TaskDetailModal({ task, onClose, onDelete, onMarkComplete, onEdit }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    api.getComments(task.id).then(setComments);
  }, [task.id]);

  async function addComment() {
    if (!newComment.trim()) return;
    const c = await api.addComment(task.id, newComment.trim());
    setComments((prev) => [...prev, c]);
    setNewComment("");
  }

  async function removeComment(id: number) {
    await api.deleteComment(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  const isOverdue =
    task.due_date &&
    new Date(task.due_date) < new Date() &&
    task.status !== "completed";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task.title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="detail-section">
          <h3>Details</h3>
          <div className="detail-badges">
            <span className="detail-badge">{statusLabel[task.status]}</span>
            {task.priority && (
              <span className="detail-badge">{task.priority.emoji} {task.priority.name}</span>
            )}
            {task.category && (
              <span className="detail-badge">{task.category.emoji} {task.category.name}</span>
            )}
            <span className="detail-badge" style={{ color: isOverdue ? "var(--danger)" : undefined }}>
              📅 {task.due_date ?? "No due date"}{isOverdue ? " · overdue" : ""}
            </span>
          </div>
        </div>

        {task.description && (
          <div className="detail-section">
            <h3>Description</h3>
            <p className="description-text">{task.description}</p>
          </div>
        )}

        <div className="detail-section">
          <h3>Comments ({comments.length})</h3>
          {comments.length > 0 && (
            <div className="comment-list">
              {comments.map((c) => (
                <div key={c.id} className="comment-item">
                  <div>
                    <div>{c.content}</div>
                    <div className="comment-meta">{new Date(c.created_at).toLocaleString()}</div>
                  </div>
                  <button className="btn-icon danger" onClick={() => removeComment(c.id)} title="Delete comment">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="comment-input-row">
            <input
              className="form-control"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
            />
            <button className="btn btn-secondary btn-sm" onClick={addComment}>Add</button>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => { onClose(); onEdit(task); }}>
            ✎ Edit
          </button>
          {task.status !== "completed" && (
            <button className="btn btn-success btn-sm" onClick={() => onMarkComplete(task.id)}>
              ✓ Mark Complete
            </button>
          )}
          {!confirmDelete ? (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          ) : (
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--danger)" }}>Sure?</span>
              <button className="btn btn-danger btn-sm" onClick={() => onDelete(task.id)}>Yes</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
