import { solver } from "./solver";
import { Core, CoreListener } from "./core";
import { library, icon } from '@fortawesome/fontawesome-svg-core'
import { faBrain } from '@fortawesome/free-solid-svg-icons'

library.add(faBrain);

export class SolverElement implements solver.SolverListener {

  private a = document.createElement('a');
  private solver: solver.Solver;

  constructor(solver: solver.Solver) {
    this.solver = solver;
    this.a.href = '#';
    this.a.innerHTML = icon(faBrain).html + ' ' + solver.get_name();
    this.a.onclick = (event) => { event.preventDefault(); Core.get_instance().selected_solver(solver); };
    solver.add_solver_listener(this);
  }
  destroy(): void { this.solver.remove_solver_listener(this); }

  get_element(): HTMLAnchorElement { return this.a; }
  get_solver(): solver.Solver { return this.solver; }

  init(items: Map<string, solver.values.Value>, atoms: Map<number, solver.values.Atom>, flaws: Map<number, solver.graph.Flaw>, resolvers: Map<number, solver.graph.Resolver>, c_flaw: solver.graph.Flaw | null, c_resolver: solver.graph.Resolver | null): void { }
  flaw_created(flaw: solver.graph.Flaw): void { }
  flaw_cost_changed(flaw: solver.graph.Flaw): void { }
  current_flaw(flaw: solver.graph.Flaw): void { }
  resolver_created(resolver: solver.graph.Resolver): void { }
  current_resolver(resolver: solver.graph.Resolver): void { }
}

export class SolverList implements CoreListener {

  private solvers: Map<number, SolverElement> = new Map();
  private sorted_solvers: SolverElement[] = [];
  private ul: HTMLUListElement = document.createElement('ul');

  constructor() { Core.get_instance().add_core_listener(this); }
  destroy(): void { Core.get_instance().remove_core_listener(this); }

  get_element(): HTMLUListElement { return this.ul; }

  init(solvers: Map<number, solver.Solver>): void {
    const sorted_solvers = Array.from(solvers.values()).sort((a, b) => a.get_name().localeCompare(b.get_name()));
    const fragment = document.createDocumentFragment();
    for (const solver of sorted_solvers) {
      const se = new SolverElement(solver);
      this.solvers.set(solver.get_id(), se);
      this.sorted_solvers.push(se);
      const li = document.createElement('li');
      li.appendChild(se.get_element());
      fragment.appendChild(li);
    }
    this.ul.appendChild(fragment);
  }
  solver_created(solver: solver.Solver): void {
    const se = new SolverElement(solver);
    this.solvers.set(solver.get_id(), se);
    const li = document.createElement('li');
    li.appendChild(se.get_element());
    let inserted = false;
    for (let i = 0; i < this.sorted_solvers.length; i++) {
      if (se.get_solver().get_name() < this.sorted_solvers[i].get_solver().get_name()) {
        this.sorted_solvers.splice(i, 0, se);
        this.ul.insertBefore(li, this.ul.children[i]);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.sorted_solvers.push(se);
      this.ul.appendChild(li);
    }
  }
  solver_deleted(id: number): void {
    const li = this.solvers.get(id).get_element().parentElement;
    this.solvers.delete(id);
    this.sorted_solvers = this.sorted_solvers.filter((se) => se.get_solver().get_id() !== id);
    this.ul.removeChild(li);
  }
  selected_solver(solver: solver.Solver): void { }
}