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
            this.solvers.clear();
            for (let solver of data.solvers)
              this.solvers.set(solver.id, new SolverD3(solver.id, solver.name, solver.state));
            nextTick(() => {
              for (let [id, slv] of this.solvers)
                slv.init(this.get_timelines_id(id), this.get_graph_id(id), 1000, 400);
            });
            break;
          case 'solver_created':
            const slv = new SolverD3(data.solver, data.name, data.state);
            this.solvers.set(data.solver, slv);
            nextTick(() => { slv.init(this.get_timelines_id(slv.id), this.get_graph_id(slv.id), 1000, 400); });
            break;
          case 'solver_destroyed':
            this.solvers.delete(data.solver);
            break;
          case 'state_changed':
            this.solvers.get(data.solver_id).state_changed(data);
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
    }
  },
  getters: {
    get_timelines_id: (state) => {
      return (solverId) => 'tls-' + solverId;
    },
    get_graph_id: (state) => {
      return (solverId) => 'gr-' + solverId;
    }
  }
});