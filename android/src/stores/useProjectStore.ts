import { create } from 'zustand';

interface Project {
  id: string;
  name: string;
  type: number;
  latitude: number;
  longitude: number;
}

interface ProjectState {
  currentProject: Project | null;
  followedProjects: Project[];

  setCurrentProject: (project: Project | null) => void;
  addFollowedProject: (project: Project) => void;
  removeFollowedProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  followedProjects: [],

  setCurrentProject: (currentProject) => set({ currentProject }),

  addFollowedProject: (project) =>
    set((state) => ({
      followedProjects: [...state.followedProjects, project],
    })),

  removeFollowedProject: (id) =>
    set((state) => ({
      followedProjects: state.followedProjects.filter((p) => p.id !== id),
    })),
}));
