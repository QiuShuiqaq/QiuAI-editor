import { create } from 'zustand';
import type { FrameworkNode } from '@qiuai/shared';
import { generateId } from '@qiuai/shared';

function reorder(nodes: FrameworkNode[]): FrameworkNode[] {
  return nodes.map((node, index) => ({
    ...node,
    order: index + 1,
    children: reorder(node.children),
  }));
}

export function normalizeFrameworkTree(nodes: FrameworkNode[]): FrameworkNode[] {
  return reorder(nodes);
}

interface FrameworkState {
  nodes: FrameworkNode[];
  addNode: (parentId: string | null, title: string) => void;
  removeNode: (id: string) => void;
  updateNode: (id: string, updates: Partial<FrameworkNode>) => void;
  setNodes: (nodes: FrameworkNode[]) => void;
  moveNode: (id: string, direction: 'up' | 'down') => void;
  changeLevel: (id: string, delta: 1 | -1) => void;
  reset: () => void;
}

export const useFrameworkStore = create<FrameworkState>((set) => ({
  nodes: [],

  addNode: (parentId, title) => {
    set((state) => {
      const newNode: FrameworkNode = {
        id: generateId(),
        title,
        level: 1,
        order: 0,
        children: [],
        needsImage: false,
        needsTable: false,
        dataKeywords: [],
      };

      if (parentId === null) {
        newNode.level = 1;
        const updated = normalizeFrameworkTree([...state.nodes, newNode]);
        return { nodes: updated };
      }

      let found = false;
      const addToParent = (nodes: FrameworkNode[]): FrameworkNode[] => {
        return nodes.map((node) => {
          if (node.id === parentId) {
            found = true;
            const childLevel = Math.min(node.level + 1, 3) as 1 | 2 | 3;
            newNode.level = childLevel;
            return { ...node, children: normalizeFrameworkTree([...node.children, newNode]) };
          }
          return { ...node, children: addToParent(node.children) };
        });
      };

      if (!found) {
        // Parent not found, add at root
        newNode.level = 1;
        return { nodes: normalizeFrameworkTree([...state.nodes, newNode]) };
      }

      return { nodes: addToParent(state.nodes) };
    });
  },

  removeNode: (id) => {
    set((state) => {
      const filter = (nodes: FrameworkNode[]): FrameworkNode[] => {
        return normalizeFrameworkTree(
          nodes.filter((n) => n.id !== id).map((n) => ({
            ...n,
            children: filter(n.children),
          }))
        );
      };
      return { nodes: filter(state.nodes) };
    });
  },

  updateNode: (id, updates) => {
    set((state) => {
      const update = (nodes: FrameworkNode[]): FrameworkNode[] => {
        return nodes.map((node) => {
          if (node.id === id) return { ...node, ...updates };
          return { ...node, children: update(node.children) };
        });
      };
      return { nodes: update(state.nodes) };
    });
  },

  setNodes: (nodes) => set({ nodes: normalizeFrameworkTree(nodes) }),

  moveNode: (id, direction) => {
    set((state) => {
      const moveInArray = (nodes: FrameworkNode[]): FrameworkNode[] => {
        const idx = nodes.findIndex((n) => n.id === id);
        if (idx === -1) {
          // Search in children
          return nodes.map((n) => ({ ...n, children: moveInArray(n.children) }));
        }
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= nodes.length) return nodes;
        const arr = [...nodes];
        [arr[idx], arr[targetIdx]] = [arr[targetIdx], arr[idx]];
        return normalizeFrameworkTree(arr);
      };
      return { nodes: moveInArray(state.nodes) };
    });
  },

  changeLevel: (id, delta) => {
    set((state) => {
      const change = (nodes: FrameworkNode[], parentLevel?: number): FrameworkNode[] => {
        const idx = nodes.findIndex((n) => n.id === id);
        if (idx !== -1) {
          const node = nodes[idx];
          const newLevel = Math.max(1, Math.min(3, node.level + delta)) as 1 | 2 | 3;
          return nodes.map((n) => (n.id === id ? { ...n, level: newLevel } : n));
        }
        return nodes.map((n) => ({
          ...n,
          children: change(n.children, n.level),
        }));
      };
      return { nodes: change(state.nodes) };
    });
  },

  reset: () => set({ nodes: [] }),
}));
