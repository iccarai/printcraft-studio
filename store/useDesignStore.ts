import { create } from 'zustand';
import type { Canvas as FabricCanvas } from 'fabric';

export interface PrintArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Blueprint {
  id: number;
  title: string;
  description: string;
  brand: string;
  model: string;
  images: string[];
  print_areas: PrintArea[];
}

export interface Variant {
  id: string;
  title: string;
  options: Record<string, string>;
  cost: number;
  enabled: boolean;
}

interface DesignState {
  canvas: FabricCanvas | null;
  history: string[];
  historyIndex: number;
  selectedBlueprint: Blueprint | null;
  selectedVariants: string[];

  setCanvas: (canvas: FabricCanvas) => void;
  saveHistory: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  setBlueprint: (blueprint: Blueprint) => void;
  toggleVariant: (id: string) => void;
  clearCanvas: () => void;
}

const MAX_HISTORY = 50;

export const useDesignStore = create<DesignState>((set, get) => ({
  canvas: null,
  history: [],
  historyIndex: -1,
  selectedBlueprint: null,
  selectedVariants: [],

  setCanvas: (canvas) => set({ canvas }),

  saveHistory: () => {
    const { canvas, history, historyIndex } = get();
    if (!canvas) return;

    const snapshot = JSON.stringify(canvas.toJSON());
    let newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);

    let newIndex = newHistory.length - 1;
    if (newHistory.length > MAX_HISTORY) {
      newHistory = newHistory.slice(1);
      newIndex = newHistory.length - 1;
    }

    set({ history: newHistory, historyIndex: newIndex });
  },

  undo: async () => {
    const { canvas, history, historyIndex } = get();
    if (!canvas || historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    await canvas.loadFromJSON(JSON.parse(history[newIndex]));
    canvas.renderAll();
    set({ historyIndex: newIndex });
  },

  redo: async () => {
    const { canvas, history, historyIndex } = get();
    if (!canvas || historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    await canvas.loadFromJSON(JSON.parse(history[newIndex]));
    canvas.renderAll();
    set({ historyIndex: newIndex });
  },

  setBlueprint: (blueprint) =>
    set({ selectedBlueprint: blueprint, selectedVariants: [] }),

  toggleVariant: (id) =>
    set((state) => ({
      selectedVariants: state.selectedVariants.includes(id)
        ? state.selectedVariants.filter((v) => v !== id)
        : [...state.selectedVariants, id],
    })),

  clearCanvas: () => {
    const { canvas } = get();
    if (!canvas) return;
    canvas.clear();
    canvas.renderAll();
    get().saveHistory();
  },
}));

export const selectCanUndo = (s: DesignState) => s.historyIndex > 0;
export const selectCanRedo = (s: DesignState) =>
  s.historyIndex < s.history.length - 1;
export const selectVariantCount = (s: DesignState) =>
  s.selectedVariants.length;