import React from "react";
import type { Task } from "../types";

interface Props {
  task: Task;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onStatusChange: (e: React.MouseEvent, status: string) => void;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

const nextStatus: Record<string, { label: string; value: string }> = {
  todo:       { label: "▶ Start",   value: "inprogress" },
  inprogress: { label: "✓ Done",    value: "completed" },
  completed:  { label: "↩ Reopen", value: "todo" },
};

function getPriorityClass(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("critical") || n.includes("urgent")) return "critical";
  if (n.includes("high"))   return "high";
  if (n.includes("medium") || n.includes("normal")) return "medium";
  return "low";
}

export default function TaskCard({
  task, onClick, onEdit, onDelete, onStatusChange, isDragging, onDragStart, onDragEnd,
}: Props) {
  const isOverdue =
    task.due_date &&
    new Date(task.due_date) < new Date() &&
    task.status !== "completed";

  const next = nextStatus[task.status];
  const priorityClass = task.priority ? getPriorityClass(task.priority.name) : "";

  function handleDragStart(e: React.DragEvent) {
    e.stopPropagation();
    onDragStart(e);
  }

  return (
    <div
      className={`task-card${priorityClass ? ` priority-${priorityClass}` : ""}${isDragging ? " dragging" : ""}`}
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="task-card-top">
        <span className="task-title">{task.title}</span>
        {task.priority && (
          <span className={`priority-badge ${priorityClass}`}>
            {task.priority.emoji} {task.priority.name}
          </span>
        )}
      </div>

      {task.description && (
        <p className="task-desc">{task.description}</p>
      )}

      {(task.category || task.due_date) && (
        <div className="task-meta">
          {task.category && (
            <span className="tag">{task.category.emoji} {task.category.name}</span>
          )}
          {task.due_date && (
            <span className={`due-date${isOverdue ? " overdue" : ""}`}>
              📅 {task.due_date}{isOverdue ? " · overdue" : ""}
            </span>
          )}
        </div>
      )}

      <div className="task-footer" onClick={(e) => e.stopPropagation()}>
        <div className="task-actions">
          <button className="btn-icon" onClick={onEdit} title="Edit">
            ✎ Edit
          </button>
          <button className="btn-icon danger" onClick={onDelete} title="Delete">
            ✕
          </button>
        </div>
        <button
          className="btn-status"
          onClick={(e) => onStatusChange(e, next.value)}
          title={next.label}
        >
          {next.label}
        </button>
      </div>
    </div>
  );
}
