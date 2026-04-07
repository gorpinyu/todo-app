import React, { useEffect, useState } from "react";
import type { Project } from "../types";
import { api } from "../api";

export default function ProjectArchiveView() {
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    loadArchived();
  }, []);

  async function loadArchived() {
    setLoading(true);
    try {
      const projects = await api.getProjects(true);
      setArchivedProjects(projects);
    } finally {
      setLoading(false);
    }
  }

  async function handlePermanentDelete(id: number) {
    await api.permanentDeleteProject(id);
    setArchivedProjects(prev => prev.filter(p => p.id !== id));
    setConfirmDelete(null);
  }

  async function handleRestore(id: number) {
    await api.restoreProject(id);
    setArchivedProjects(prev => prev.filter(p => p.id !== id));
  }

  if (loading) {
    return <div style={{ padding: "2rem", color: "var(--text-muted)" }}>Loading archived projects...</div>;
  }

  if (archivedProjects.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
        <p>No archived projects</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h2 style={{ marginBottom: "1.5rem", fontSize: "1.25rem" }}>Archived Projects</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {archivedProjects.map(project => (
          <div key={project.id} style={{
            padding: "1rem",
            background: "var(--bg-elevated)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>{project.emoji ?? "📁"}</span>
              <div>
                <div style={{ fontWeight: 500 }}>{project.name}</div>
                {project.description && (
                  <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    {project.description}
                  </div>
                )}
              </div>
            </div>
            <div>
              {confirmDelete === project.id ? (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.875rem", color: "var(--danger)" }}>
                    Permanently delete? All tasks will be lost.
                  </span>
                  <button className="btn btn-danger btn-sm" onClick={() => handlePermanentDelete(project.id)}>
                    Yes, Delete
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleRestore(project.id)}>
                    Restore
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(project.id)}>
                    Permanently Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
