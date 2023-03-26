// Utilities
import { SolverD3 } from '@/solverD3';
import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    drawer: null,
    solver_tab: null,
    solvers_tab: null,
    solvers: new Map()
  }),
  actions: {
    tick() {
      console.log('tick');
    },
    add_solver(solver_id) {
      this.solvers.set(solver_id, new SolverD3());
    },
    remove_solver(solver_id) {
      this.solvers.delete(solver_id);
    }
  }
});