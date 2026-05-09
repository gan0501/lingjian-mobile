import { create } from 'zustand';

interface MapCenter {
  latitude: number;
  longitude: number;
}

interface MapState {
  center: MapCenter;
  zoom: number;
  selectedMarkerId: string | null;
  userLocation: MapCenter | null;
  userCity: string | null;
  projectFilters: number[];

  setCenter: (center: MapCenter) => void;
  setZoom: (zoom: number) => void;
  setSelectedMarker: (id: string | null) => void;
  setUserLocation: (location: MapCenter | null) => void;
  setUserCity: (city: string | null) => void;
  setProjectFilters: (filters: number[]) => void;
}

const DEFAULT_CENTER = {
  latitude: 30.5702,
  longitude: 114.2734,
};

export const useMapStore = create<MapState>((set) => ({
  center: DEFAULT_CENTER,
  zoom: 12,
  selectedMarkerId: null,
  userLocation: null,
  userCity: null,
  projectFilters: [1, 2, 3, 4, 5],

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setSelectedMarker: (selectedMarkerId) => set({ selectedMarkerId }),
  setUserLocation: (userLocation) => set({ userLocation }),
  setUserCity: (userCity) => set({ userCity }),
  setProjectFilters: (projectFilters) => set({ projectFilters }),
}));

