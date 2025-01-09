import { solver } from "./solver";

export class Core implements CoreListener {

  private static instance: Core;
  private solvers: Map<number, solver.Solver> = new Map();
  private listeners: Set<CoreListener> = new Set();

  private constructor() { }

  init(solvers: Map<number, solver.Solver>): void {
    this.solvers = solvers;
  }
  solver_created(solver: solver.Solver): void {
    this.solvers.set(solver.get_id(), solver);
    for (const listener of this.listeners) { listener.solver_created(solver); }
  }
  solver_deleted(id: number): void {
    this.solvers.delete(id);
    for (const listener of this.listeners) { listener.solver_deleted(id); }
  }
  selected_solver(solver: solver.Solver): void {
    for (const listener of this.listeners) { listener.selected_solver(solver); }
  }

  add_core_listener(listener: CoreListener): void {
    this.listeners.add(listener);
    listener.init(this.solvers);
  }
  remove_core_listener(listener: CoreListener): void { this.listeners.delete(listener); }

  static get_instance() {
    if (!Core.instance) {
      Core.instance = new Core();
    }
    return Core.instance;
  }
}

export interface CoreListener {

  init(solvers: Map<number, solver.Solver>): void;

  solver_created(solver: solver.Solver): void;

  solver_deleted(id: number): void;

  selected_solver(solver: solver.Solver): void;
}