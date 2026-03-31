import React, { useState } from "react";
import type { Task } from "../types";
import TaskCard from "./TaskCard";

interface DragState {
  draggedTaskId: number | null;
  draggedFromStatus: string | null;
  overColumnKey: string | null;
}

interface Props {
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
}

const columns = [
  { key: "todo",       label: "To Do",      cls: "col-todo" },
  { key: "inprogress", label: "In Progress", cls: "col-inprogress" },
  { key: "completed",  label: "Completed",   cls: "col-completed" },
];

const emptyMessages: Record<string, { icon: string; text: string }> = {
  todo:       { icon: "○", text: "No tasks yet" },
  inprogress: { icon: "◑", text: "Nothing in progress" },
  completed:  { icon: "●", text: "Nothing done yet" },
};

export default function Board({ tasks, onCardClick, onEdit, onDelete, onStatusChange }: Props) {
  const [dragState, setDragState] = useState<DragState>({
    draggedTaskId: null,
    draggedFromStatus: null,
    overColumnKey: null,
  });
  const [announcement, setAnnouncement] = useState("");

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
      >
        {announcement}
      </div>
      <div className="board-wrap">
        <div className="board">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            return (
              <div
                key={col.key}
                className={`column ${col.cls}${dragState.overColumnKey === col.key ? " drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragState((s) => ({ ...s, overColumnKey: col.key })); }}
                onDragLeave={() => setDragState((s) => ({ ...s, overColumnKey: null }))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragState.draggedTaskId !== null && col.key !== dragState.draggedFromStatus) {
                    onStatusChange(dragState.draggedTaskId, col.key);
                    setAnnouncement(`Task moved to ${col.label}`);
                  }
                  setDragState({ draggedTaskId: null, draggedFromStatus: null, overColumnKey: null });
                }}
              >
                <div className="column-header">
                  <span className="column-title">
                    <span className="col-dot" />
                    {col.label}
                  </span>
                  <span className="column-count">{colTasks.length}</span>
                </div>
                <div className="column-body">
                  {colTasks.length === 0 && (
                    <div className="empty-col">
                      <span className="empty-col-icon">{emptyMessages[col.key].icon}</span>
                      {emptyMessages[col.key].text}
                    </div>
                  )}
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onCardClick(task)}
                      onEdit={(e) => { e.stopPropagation(); onEdit(task); }}
                      onDelete={(e) => { e.stopPropagation(); onDelete(task.id); }}
                      onStatusChange={(e, status) => { e.stopPropagation(); onStatusChange(task.id, status); }}
                      isDragging={dragState.draggedTaskId === task.id}
                      onDragStart={() => setDragState((s) => ({ ...s, draggedTaskId: task.id, draggedFromStatus: task.status }))}
                      onDragEnd={() => setDragState({ draggedTaskId: null, draggedFromStatus: null, overColumnKey: null })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
