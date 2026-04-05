import React, { useEffect, useState, useCallback } from "react";
import type { Task, Category, Priority, TaskFormData } from "./types";
import { api } from "./api";
import Board from "./components/Board";
import TaskModal from "./components/TaskModal";
import TaskDetailModal from "./components/TaskDetailModal";
import ConfirmDialog from "./components/ConfirmDialog";
import ArchiveView from "./components/ArchiveView";
import CalendarView from "./components/CalendarView";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

type View = "all" | "todo" | "inprogress" | "completed" | "overdue" | "archive" | "calendar";
type AuthView = "login" | "register" | "forgot";

function AppShell() {
  const { user, token, logout } = useAuth();
  const [authView, setAuthView] = useState<AuthView>("login");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<View>("all");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null); setLoading(true);
      const [t, c, p] = await Promise.all([api.getTasks(), api.getCategories(), api.getPriorities()]);
      setTasks(t); setCategories(c); setPriorities(p);
    } catch (err: any) {
      setError(err.message ?? "Failed to load tasks.");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (token) load(); else setLoading(false); }, [token, load]);

  if (!user || !token) {
    const resetToken = new URLSearchParams(window.location.search).get("reset_token");
    if (resetToken) return <ResetPasswordPage token={resetToken} onDone={() => setAuthView("login")} />;
    if (authView === "forgot") return <ForgotPasswordPage onBack={() => setAuthView("login")} />;
    return authView === "login"
      ? <LoginPage onSwitch={() => setAuthView("register")} onForgotPassword={() => setAuthView("forgot")} />
      : <RegisterPage onSwitch={() => setAuthView("login")} />;
  }

  if (loading) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"var(--bg-base)", color:"var(--text-muted)", fontSize:15 }}>Loading…</div>;
  if (error) return <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:"var(--bg-base)", color:"var(--danger)", gap:12 }}><span>{error}</span><button onClick={load} className="btn btn-secondary btn-sm">Retry</button></div>;

  async function handleSave(data: TaskFormData) {
    if (editingTask) {
      const updated = await api.updateTask(editingTask.id, data);
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      if (detailTask?.id === updated.id) setDetailTask(updated);
    } else {
      const created = await api.createTask(data);
      setTasks(prev => [created, ...prev]);
    }
    setShowTaskModal(false); setEditingTask(null);
  }

  async function handleDelete(id: number) {
    await api.deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setConfirmDeleteId(null); setDetailTask(null);
  }

  function buildFormData(task: Task): TaskFormData {
    return { title: task.title, description: task.description ?? "", status: task.status, priority_id: task.priority?.id ?? "", category_id: task.category?.id ?? "", due_date: task.due_date ?? "" };
  }

  async function handleStatusChange(id: number, status: string) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const prev = task.status;
    setTasks(p => p.map(t => t.id === id ? { ...t, status: status as Task["status"] } : t));
    try {
      const updated = await api.updateTask(id, { ...buildFormData(task), status });
      setTasks(p => p.map(t => t.id === updated.id ? updated : t));
      if (detailTask?.id === id) setDetailTask(updated);
    } catch { setTasks(p => p.map(t => t.id === id ? { ...t, status: prev } : t)); }
  }

  const todo = tasks.filter(t => t.status === "todo").length;
  const inprog = tasks.filter(t => t.status === "inprogress").length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed").length;
  const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const boardNavItems = [
    { key: "all" as View,        icon: "◈", label: "All Tasks",  count: tasks.length },
    { key: "todo" as View,       icon: "○", label: "To Do",       count: todo },
    { key: "inprogress" as View, icon: "◑", label: "In Progress", count: inprog },
    { key: "completed" as View,  icon: "●", label: "Completed",   count: completed },
    { key: "overdue" as View,    icon: "⚠", label: "Overdue",     count: overdue },
  ];

  const filteredTasks = activeView === "all" ? tasks
    : activeView === "overdue" ? tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed")
    : tasks.filter(t => t.status === activeView);

  const viewTitle: Record<View, string> = {
    all: "All Tasks", todo: "To Do", inprogress: "In Progress",
    completed: "Completed", overdue: "Overdue", archive: "Archive", calendar: "Calendar",
  };

  const isBoardView = !["archive", "calendar"].includes(activeView);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <div className="sidebar-logo-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" opacity="0.9"/>
                <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
                <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
                <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.9"/>
              </svg>
            </div>
            <span className="sidebar-logo-text">Task<span>Board</span></span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <span className="sidebar-label">Views</span>
          {boardNavItems.map(item => (
            <button key={item.key} className={`sidebar-item${activeView === item.key ? " active" : ""}`} onClick={() => setActiveView(item.key)}>
              <span className="sidebar-item-icon">{item.icon}</span>
              {item.label}
              {item.count > 0 && <span className="sidebar-item-count">{item.count}</span>}
            </button>
          ))}
          <span className="sidebar-label" style={{ marginTop: "0.75rem" }}>Tools</span>
          <button className={`sidebar-item${activeView === "calendar" ? " active" : ""}`} onClick={() => setActiveView("calendar")}>
            <span className="sidebar-item-icon">📅</span>Calendar
          </button>
          <button className={`sidebar-item${activeView === "archive" ? " active" : ""}`} onClick={() => setActiveView("archive")}>
            <span className="sidebar-item-icon">🗄</span>Archive
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-avatar">{user.email[0].toUpperCase()}</span>
            <span className="sidebar-user-email">{user.email}</span>
          </div>
          {isBoardView && (
            <button className="sidebar-new-btn" onClick={() => { setEditingTask(null); setShowTaskModal(true); }}>+ New Task</button>
          )}
          <button className="sidebar-logout-btn" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="topbar-title">{viewTitle[activeView]}</h1>
          {isBoardView && (
            <div className="topbar-right">
              <span className="stat-chip">Total <strong>{tasks.length}</strong></span>
              <span className="stat-chip progress-chip">
                <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                <strong>{pct}%</strong>
              </span>
            </div>
          )}
        </header>
        {activeView === "archive" && <ArchiveView />}
        {activeView === "calendar" && <CalendarView tasks={tasks} />}
        {isBoardView && (
          <Board tasks={filteredTasks} onCardClick={setDetailTask}
            onEdit={t => { setEditingTask(t); setShowTaskModal(true); }}
            onDelete={id => setConfirmDeleteId(id)}
            onStatusChange={handleStatusChange} />
        )}
      </div>

      {showTaskModal && <TaskModal task={editingTask} categories={categories} priorities={priorities} onSave={handleSave} onClose={() => { setShowTaskModal(false); setEditingTask(null); }} />}
      {detailTask && <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} onDelete={id => { setDetailTask(null); setConfirmDeleteId(id); }} onMarkComplete={id => handleStatusChange(id, "completed")} onEdit={task => { setDetailTask(null); setEditingTask(task); setShowTaskModal(true); }} />}
      {confirmDeleteId !== null && <ConfirmDialog message="Move this task to archive?" onConfirm={() => handleDelete(confirmDeleteId)} onCancel={() => setConfirmDeleteId(null)} />}
    </div>
  );
}

export default function App() {
  return <AuthProvider><AppShell /></AuthProvider>;
}
