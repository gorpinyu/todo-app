import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, Project } from "./api";

interface ProjectContextValue {
  projects: Project[];
  activeProject: Project | null;
  setActiveProject: (p: Project) => void;
  reload: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);
const STORAGE_KEY = "@taskboard_active_project_id";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await api.getProjects();
      setProjects(list);
      const savedId = await AsyncStorage.getItem(STORAGE_KEY);
      const saved = savedId ? list.find(p => p.id === parseInt(savedId)) : null;
      setActiveProjectState(saved ?? list.find(p => p.is_default) ?? list[0] ?? null);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  }, []);

  useEffect(() => { reload(); }, []);

  async function setActiveProject(p: Project) {
    await AsyncStorage.setItem(STORAGE_KEY, String(p.id));
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
