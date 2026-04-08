import React, { useState } from "react";
import type { Task } from "../types";

interface Props {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskDateChange: (taskId: number, newDate: string) => void;
}

type ViewMode = "month" | "week";

const STATUS_COLORS: Record<string, string> = {
  todo:        "#e2e8f0",
  inprogress:  "#fef3c7",
  completed:   "#d1fae5",
};
const STATUS_TEXT: Record<string, string> = {
  todo:        "#475569",
  inprogress:  "#92400e",
  completed:   "#065f46",
};

export default function CalendarView({ tasks, onTaskClick, onTaskDateChange }: Props) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  function isOverdue(task: Task) {
    if (!task.due_date || task.status === "completed") return false;
    return new Date(task.due_date) < todayDate;
  }

  const activeTasks = tasks.filter(t => !t.archived && (t.due_date || t.completed_at));

  function getTaskDisplayDate(task: Task): string | null {
    // Show completed tasks by completion date, others by due date
    if (task.status === "completed" && task.completed_at) {
      return task.completed_at.split('T')[0];
    }
    return task.due_date;
  }

  function prevPeriod() {
    if (viewMode === "month") {
      if (month === 0) { setMonth(11); setYear(y => y - 1); }
      else setMonth(m => m - 1);
    } else {
      const newStart = new Date(weekStart);
      newStart.setDate(newStart.getDate() - 7);
      setWeekStart(newStart);
    }
  }

  function nextPeriod() {
    if (viewMode === "month") {
      if (month === 11) { setMonth(0); setYear(y => y + 1); }
      else setMonth(m => m + 1);
    } else {
      const newStart = new Date(weekStart);
      newStart.setDate(newStart.getDate() + 7);
      setWeekStart(newStart);
    }
  }

  function handleDragStart(e: React.DragEvent, task: Task) {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, targetDate: Date) {
    e.preventDefault();
    if (!draggedTask) return;
    
    // Format date correctly to avoid timezone issues
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const newDueDate = `${year}-${month}-${day}`;
    
    onTaskDateChange(draggedTask.id, newDueDate);
    setDraggedTask(null);
  }

  if (viewMode === "month") {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthLabel = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });

    const byDay: Record<number, Task[]> = {};
    for (const task of activeTasks) {
      const displayDate = getTaskDisplayDate(task);
      if (!displayDate) continue;
      const d = new Date(displayDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(task);
      }
    }

    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    // Pad to complete the last row (ensure multiple of 7 for grid)
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      cells.push(...Array(7 - remainder).fill(null));
    }

    const isToday = (day: number) =>
      day === todayDate.getDate() && month === todayDate.getMonth() && year === todayDate.getFullYear();

    return (
      <div className="calendar-wrap">
        <div className="calendar-header">
          <button className="cal-nav-btn" onClick={prevPeriod}>‹</button>
          <span className="cal-month-label">{monthLabel}</span>
          <button className="cal-nav-btn" onClick={nextPeriod}>›</button>
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
            <button 
              className={`btn btn-sm ${viewMode === "month" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setViewMode("month")}>
              Month
            </button>
            <button 
              className={`btn btn-sm ${viewMode === "week" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setViewMode("week")}>
              Week
            </button>
          </div>
        </div>
        <div className="calendar-grid">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} className="cal-day-name">{d}</div>
          ))}
          {cells.map((day, i) => {
            const cellDate = day ? new Date(year, month, day) : null;
            return (
              <div 
                key={i} 
                className={`cal-cell${day && isToday(day) ? " cal-today" : ""}${!day ? " cal-empty" : ""}`}
                onDragOver={cellDate ? handleDragOver : undefined}
                onDrop={cellDate ? (e) => handleDrop(e, cellDate) : undefined}>
                {day && <span className="cal-day-num">{day}</span>}
                {day && byDay[day]?.map(task => (
                  <div 
                    key={task.id} 
                    className="cal-task-chip"
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDoubleClick={() => onTaskClick(task)}
                    style={{
                      background: STATUS_COLORS[task.status],
                      color: isOverdue(task) ? "#dc2626" : STATUS_TEXT[task.status],
                      fontWeight: isOverdue(task) ? 700 : 500,
                      cursor: "pointer",
                    }}
                    title={task.title}>
                    {task.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="cal-legend">
          <span className="cal-legend-item" style={{ background: STATUS_COLORS.todo, color: STATUS_TEXT.todo }}>To Do</span>
          <span className="cal-legend-item" style={{ background: STATUS_COLORS.inprogress, color: STATUS_TEXT.inprogress }}>In Progress</span>
          <span className="cal-legend-item" style={{ background: STATUS_COLORS.completed, color: STATUS_TEXT.completed }}>Completed</span>
        </div>
      </div>
    );
  }

  // Week view
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  const weekLabel = `${weekDays[0].toLocaleDateString("default", { month: "short", day: "numeric" })} - ${weekDays[6].toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" })}`;

  const byWeekDay: Record<string, Task[]> = {};
  for (const task of activeTasks) {
    const displayDate = getTaskDisplayDate(task);
    if (!displayDate) continue;
    const taskDate = new Date(displayDate);
    taskDate.setHours(0, 0, 0, 0);
    const dateKey = displayDate;
    if (!byWeekDay[dateKey]) byWeekDay[dateKey] = [];
    byWeekDay[dateKey].push(task);
  }

  return (
    <div className="calendar-wrap">
      <div className="calendar-header">
        <button className="cal-nav-btn" onClick={prevPeriod}>‹</button>
        <span className="cal-month-label">{weekLabel}</span>
        <button className="cal-nav-btn" onClick={nextPeriod}>›</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          <button 
            className={`btn btn-sm ${viewMode === "month" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setViewMode("month")}>
            Month
          </button>
          <button 
            className={`btn btn-sm ${viewMode === "week" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setViewMode("week")}>
            Week
          </button>
        </div>
      </div>
      <div className="week-grid">
        {weekDays.map((date, idx) => {
          const dateKey = date.toISOString().split('T')[0];
          const dayTasks = byWeekDay[dateKey] || [];
          const isToday = date.toDateString() === todayDate.toDateString();
          
          return (
            <div 
              key={idx} 
              className={`week-day${isToday ? " week-today" : ""}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, date)}>
              <div className="week-day-header">
                <div className="week-day-name">{date.toLocaleDateString("default", { weekday: "short" })}</div>
                <div className={`week-day-num${isToday ? " today" : ""}`}>{date.getDate()}</div>
              </div>
              <div className="week-day-tasks">
                {dayTasks.map(task => (
                  <div 
                    key={task.id}
                    className="week-task-card"
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDoubleClick={() => onTaskClick(task)}
                    style={{
                      borderLeft: `3px solid ${isOverdue(task) ? "#dc2626" : STATUS_COLORS[task.status]}`,
                      cursor: "pointer",
                    }}>
                    <div className="week-task-title">{task.title}</div>
                    {task.category && (
                      <div className="week-task-meta">
                        {task.category.emoji} {task.category.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="cal-legend">
        <span className="cal-legend-item" style={{ background: STATUS_COLORS.todo, color: STATUS_TEXT.todo }}>To Do</span>
        <span className="cal-legend-item" style={{ background: STATUS_COLORS.inprogress, color: STATUS_TEXT.inprogress }}>In Progress</span>
        <span className="cal-legend-item" style={{ background: STATUS_COLORS.completed, color: STATUS_TEXT.completed }}>Completed</span>
      </div>
    </div>
  );
}
