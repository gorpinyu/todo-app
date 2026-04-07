import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Project } from "../types";
import { api } from "../api";

interface ProjectContextValue {
  projects: Project[];
  activeProject: Project | null;
  setActiveProject: (p: Project) => void;
  reload: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);
const STORAGE_KEY = "active_project_id";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);

  const reload = useCallback(async () => {
    console.log('[ProjectContext] Reloading projects...');
    const list = await api.getProjects();
    console.log('[ProjectContext] Received projects:', list.length, 'projects:', list.map(p => ({ id: p.id, name: p.name, user_id: p.user_id })));
    setProjects(list);
    const savedId = localStorage.getItem(STORAGE_KEY);
    const saved = savedId ? list.find(p => p.id === parseInt(savedId)) : null;
    setActiveProjectState(saved ?? list.find(p => p.is_default) ?? list[0] ?? null);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function setActiveProject(p: Project) {
    localStorage.setItem(STORAGE_KEY, String(p.id));
    setActiveProjectState(p);
  }

  return (
    <ProjectContext.Provider value={{ projects, activeProject, setActiveProject, reload }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
