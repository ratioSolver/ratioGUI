import { AppComponent, Component, AnchorComponent, UListComponent } from './app';
import { solver } from "./solver";
import { library, icon } from '@fortawesome/fontawesome-svg-core'
import { faBrain, faPauseCircle, faPlayCircle, faCheckCircle, faXmarkCircle } from '@fortawesome/free-solid-svg-icons'

library.add(faBrain, faPauseCircle, faPlayCircle, faCheckCircle, faXmarkCircle);

export class SolverAnchor extends AnchorComponent<solver.Solver> implements solver.SolverListener {

  constructor(solver: solver.Solver) {
    super(solver);
    solver.add_solver_listener(this);
    this.element.addEventListener('click', () => { AppComponent.get_instance().selected_component(this); });
  }

  init(items: Map<string, solver.values.Value>, atoms: Map<number, solver.values.Atom>, state: solver.SolverState, flaws: Map<number, solver.graph.Flaw>, resolvers: Map<number, solver.graph.Resolver>, c_flaw: solver.graph.Flaw | null, c_resolver: solver.graph.Resolver | null): void { this.render(); }
  state_changed(state: solver.SolverState): void { this.render(); }
  flaw_created(flaw: solver.graph.Flaw): void { }
  flaw_cost_changed(flaw: solver.graph.Flaw): void { }
  current_flaw(flaw: solver.graph.Flaw): void { }
  resolver_created(resolver: solver.graph.Resolver): void { }
  current_resolver(resolver: solver.graph.Resolver): void { }

  private render(): void {
    this.element.innerHTML = to_icon(this.payload.get_state()) + ' ' + this.payload.get_name();
  }

  unmounted(): void {
    this.payload.remove_solver_listener(this);
    if (AppComponent.get_instance().get_selected_component() === this)
      AppComponent.get_instance().selected_component(null);
  }
}

class SolverListItem extends Component<solver.Solver, HTMLLIElement> {

  private solver_anchor: SolverAnchor;

  constructor(solver: solver.Solver) {
    super(solver, document.createElement('li'));
    this.solver_anchor = new SolverAnchor(solver);
    this.element.appendChild(this.solver_anchor.element);
  }
}

export class SolverListComponent extends UListComponent<solver.Solver> {

  constructor(payload: SolverListItem[]) {
    super(payload, (s0: solver.Solver, s1: solver.Solver) => s0.get_name().localeCompare(s1.get_name()));
  }
}

export class SolverComponent extends Component<solver.Solver, HTMLDivElement> {

  constructor(solver: solver.Solver) {
    super(solver, document.createElement('div'));
    this.element.classList.add('flex-grow-1', 'd-flex', 'flex-column');
  }
}

function to_icon(state: solver.SolverState): string[] {
  switch (state) {
    case solver.SolverState.reasoning:
    case solver.SolverState.adapting: return icon(faBrain).html;
    case solver.SolverState.idle: return icon(faPauseCircle).html;
    case solver.SolverState.executing: return icon(faPlayCircle).html;
    case solver.SolverState.finished: return icon(faCheckCircle).html;
    case solver.SolverState.failed: return icon(faXmarkCircle).html;
  }
}