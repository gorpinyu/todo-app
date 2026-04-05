import React, { useState } from "react";
import type { Task } from "../types";

interface Props { tasks: Task[]; }

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

export default function CalendarView({ tasks }: Props) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());

  function isOverdue(task: Task) {
    if (!task.due_date || task.status === "completed") return false;
    return new Date(task.due_date) < todayDate;
  }

  const activeTasks = tasks.filter(t => !t.archived && t.due_date);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });

  const byDay: Record<number, Task[]> = {};
  for (const task of activeTasks) {
    const d = new Date(task.due_date!);
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
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (day: number) =>
    day === todayDate.getDate() && month === todayDate.getMonth() && year === todayDate.getFullYear();

  return (
    <div className="calendar-wrap">
      <div className="calendar-header">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <span className="cal-month-label">{monthLabel}</span>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>
      <div className="calendar-grid">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} className="cal-day-name">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className={`cal-cell${day && isToday(day) ? " cal-today" : ""}${!day ? " cal-empty" : ""}`}>
            {day && <span className="cal-day-num">{day}</span>}
            {day && byDay[day]?.map(task => (
              <div key={task.id} className="cal-task-chip"
                style={{
                  background: STATUS_COLORS[task.status],
                  color: isOverdue(task) ? "#dc2626" : STATUS_TEXT[task.status],
                  fontWeight: isOverdue(task) ? 700 : 500,
                }}
                title={task.title}>
                {task.title}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="cal-legend">
        <span className="cal-legend-item" style={{ background: STATUS_COLORS.todo, color: STATUS_TEXT.todo }}>To Do</span>
        <span className="cal-legend-item" style={{ background: STATUS_COLORS.inprogress, color: STATUS_TEXT.inprogress }}>In Progress</span>
        <span className="cal-legend-item" style={{ background: STATUS_COLORS.completed, color: STATUS_TEXT.completed }}>Completed</span>
      </div>
    </div>
  );
}
