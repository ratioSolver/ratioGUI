// Utilities
import { SolverD3 } from '@/solverD3';
import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    connected: false,
    solvers: new Map()
  }),
  actions: {
    connect(url) {
      this.socket = new WebSocket(url);
      this.socket.onopen = () => {
        console.log('Connected to server');
        this.connected = true;
      };
      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(data);
        if (data.type === 'solver') {
          this.add_solver(data.id);
        } else if (data.type === 'solver_removed') {
          this.remove_solver(data.id);
        }
      };
      this.socket.onclose = () => {
        console.log('Disconnected from server');
        this.connected = false;
        setTimeout(() => { this.connect(url); }, 1000);
      };
    },
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