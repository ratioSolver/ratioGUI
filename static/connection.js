import { SolverD3 } from "./solverD3";

export class Connection {

    constructor() {
        this.solvers = new Map();
    }

    add_solver(solver_id = 'default', timelines_id = 'timelines', graph_id = 'graph', width = window.innerWidth, height = window.innerHeight) {
        this.solvers.set(solver_id, new SolverD3(solver_id, timelines_id, graph_id, width, height));
    }

    remove_solver(solver_id = 'default') {
        this.solvers.delete(solver_id);
    }

    connect(url = 'ws://' + location.hostname + ':' + location.port + '/solver', timeout = 1000) {
        this.url = url;
        this.timeout = timeout;
        this.#setup_ws();
    }

    disconnect() {
        this.ws.close();
    }

    #setup_ws() {
        this.ws = new WebSocket(this.url);
        this.ws.onmessage = msg => {
            const c_msg = JSON.parse(msg.data);
            switch (c_msg.type) {
                case 'state_changed':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').state_changed(c_msg);
                    break;
                case 'started_solving':
                    console.log('solving the problem..');
                    break;
                case 'solution_found':
                    console.log('hurray!! we have found a solution..');
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').solution_found(c_msg);
                    break;
                case 'inconsistent_problem':
                    console.log('the problem has no solution..');
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').inconsistent_problem(c_msg);
                    break;
                case 'graph':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').graph(c_msg);
                    break;
                case 'flaw_created':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').flaw_created(c_msg);
                    break;
                case 'flaw_state_changed':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').flaw_state_changed(c_msg);
                    break;
                case 'flaw_cost_changed':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').flaw_cost_changed(c_msg);
                    break;
                case 'flaw_position_changed':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').flaw_position_changed(c_msg);
                    break;
                case 'current_flaw':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').current_flaw_changed(c_msg);
                    break;
                case 'resolver_created':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').resolver_created(c_msg);
                    break;
                case 'resolver_state_changed':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').resolver_state_changed(c_msg);
                    break;
                case 'current_resolver':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').current_resolver_changed(c_msg);
                    break;
                case 'causal_link_added':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').causal_link_added(c_msg);
                    break;
                case 'tick':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').tick(c_msg);
                    break;
                case 'starting':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').starting(c_msg);
                    break;
                case 'ending':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').ending(c_msg);
                    break;
                case 'start':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').start(c_msg);
                    break;
                case 'end':
                    this.solvers.get(c_msg.solver_id ? c_msg.solver_id : 'default').end(c_msg);
                    break;
            }
        };
        this.ws.onclose = () => setTimeout(this.#setup_ws, this.timeout);
    }

    resize(width, height) {
        this.solvers.forEach(solver => solver.resize(width, height));
    }
}