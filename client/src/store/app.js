// Utilities
import { SolverD3 } from '@/solverD3';
import { defineStore } from 'pinia';
import { nextTick } from 'vue';

export const useAppStore = defineStore('app', {
  state: () => ({
    connected: false,
    solvers: new Map()
  }),
  actions: {
    connect(url = 'ws://' + location.hostname + ':' + location.port + '/solver', timeout = 1000) {
      this.socket = new WebSocket(url);
      this.socket.onopen = () => {
        this.connected = true;
      };
      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'solvers':
            data.solvers.forEach((solver) => this.add_solver(solver.id, solver.name, solver.state));
            break;
          case 'solver_created':
            this.add_solver(data.solver_id, data.name);
            break;
          case 'solver_destroyed':
            this.remove_solver(data.solver_id);
            break;
          case 'state_changed':
            this.solvers.get(data.solver_id).state_changed(data);
            break;
          case 'started_solving':
            this.reasoning.add(data.solver_id);
            break;
          case 'solution_found':
            this.solvers.get(data.solver_id).solution_found(data);
            break;
          case 'inconsistent_problem':
            this.solvers.get(data.solver_id).inconsistent_problem(data);
            break;
          case 'graph':
            this.solvers.get(data.solver_id).graph(data);
            break;
          case 'flaw_created':
            this.solvers.get(data.solver_id).flaw_created(data);
            break;
          case 'flaw_state_changed':
            this.solvers.get(data.solver_id).flaw_state_changed(data);
            break;
          case 'flaw_cost_changed':
            this.solvers.get(data.solver_id).flaw_cost_changed(data);
            break;
          case 'flaw_position_changed':
            this.solvers.get(data.solver_id).flaw_position_changed(data);
            break;
          case 'current_flaw':
            this.solvers.get(data.solver_id).current_flaw_changed(data);
            break;
          case 'resolver_created':
            this.solvers.get(data.solver_id).resolver_created(data);
            break;
          case 'resolver_state_changed':
            this.solvers.get(data.solver_id).resolver_state_changed(data);
            break;
          case 'current_resolver':
            this.solvers.get(data.solver_id).current_resolver_changed(data);
            break;
          case 'causal_link_added':
            this.solvers.get(data.solver_id).causal_link_added(data);
            break;
          case 'executor_state_changed':
            this.solvers.get(data.solver_id).executor_state_changed(data);
            break;
          case 'tick':
            this.solvers.get(data.solver_id).tick(data);
            break;
          case 'starting':
            this.solvers.get(data.solver_id).starting(data);
            break;
          case 'ending':
            this.solvers.get(data.solver_id).ending(data);
            break;
          case 'start':
            this.solvers.get(data.solver_id).start(data);
            break;
          case 'end':
            this.solvers.get(data.solver_id).end(data);
            break;
        }
      };
      this.socket.onclose = () => {
        this.connected = false;
        setTimeout(() => { this.connect(url); }, timeout);
      };
    },
    tick() {
      this.socket.send('tick');
    },
    add_solver(id, name, state) {
      this.solvers.set(id, new SolverD3(id, name, state));
      nextTick(() => {
        this.solvers.get(id).init(this.getTimelinesId(id), this.getGraphId(id));
      });
    },
    remove_solver(solver_id) {
      this.solvers.delete(solver_id);
    }
  },
  getters: {
    getTimelinesId: (state) => {
      return (solverId) => 'tls-' + solverId;
    },
    getGraphId: (state) => {
      return (solverId) => 'gr-' + solverId;
    }
  }
});