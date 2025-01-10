import { solver } from "./solver";
import cytoscape from 'cytoscape';
import { interpolateRgb } from 'd3-interpolate';

const costColorScale = interpolateRgb("green", "red");
const infiniteColor = "black";

export class SolverGraph implements solver.SolverListener {

  cy: cytoscape.Core;
  layout = {
    name: 'dagre',
    rankDir: 'LR',
    fit: false,
    nodeDimensionsIncludeLabels: true,
    animate: true,
    animationDuration: 100
  };

  constructor(solver: solver.Solver) {
    this.cy = cytoscape({
      container: document.getElementById('slv-' + solver.get_id() + '-graph'),
      style: [
        {
          selector: 'node[type="flaw"]',
          style: {
            'shape': 'round-rectangle',
            'background-color': 'data(color)',
            'label': 'data(label)',
            'border-width': '1px',
            'border-style': 'data(stroke)' as any,
            'border-color': '#666'
          }
        },
        {
          selector: 'node[type="resolver"]',
          style: {
            'shape': 'ellipse',
            'background-color': 'data(color)',
            'label': 'data(label)',
            'border-width': '1px',
            'border-style': 'data(stroke)' as any,
            'border-color': '#666'
          }
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'line-color': '#666',
            'target-arrow-color': '#666',
            'target-arrow-shape': 'triangle',
            'width': '1px',
            'line-style': 'data(stroke)' as any
          }
        },
        {
          selector: 'node.current',
          style: {
            'border-width': '3px',
            'border-color': '#919'
          }
        }
      ]
    });

    solver.add_solver_listener(this);
  }

  init(items: Map<string, solver.values.Value>, atoms: Map<number, solver.values.Atom>, state: solver.SolverState, flaws: Map<number, solver.graph.Flaw>, resolvers: Map<number, solver.graph.Resolver>, c_flaw: solver.graph.Flaw | null, c_resolver: solver.graph.Resolver | null): void {
    this.cy.elements().remove(); // We clear the graph
    for (const [_, flaw] of flaws) {
      const fn = this.cy.add({ group: 'nodes', data: { id: flaw.get_id().toString(), type: 'flaw', label: '****', color: color(flaw), stroke: stroke_style(flaw) } });
    }
    this.cy.layout(this.layout).run();
  }

  state_changed(state: solver.SolverState): void { }

  flaw_created(flaw: solver.graph.Flaw): void {
    const fn = this.cy.add({ group: 'nodes', data: { id: flaw.get_id().toString(), type: 'flaw', label: '****', color: color(flaw), stroke: stroke_style(flaw) } });
    this.cy.layout(this.layout).run();
  }

  flaw_cost_changed(flaw: solver.graph.Flaw): void {
    this.cy.$id(flaw.get_id().toString()).data('color', color(flaw));
    this.cy.layout(this.layout).run();
  }

  current_flaw(flaw: solver.graph.Flaw): void {
    this.cy.layout(this.layout).run();
  }

  resolver_created(resolver: solver.graph.Resolver): void {
    const rn = this.cy.add({ group: 'nodes', data: { id: resolver.get_id().toString(), type: 'resolver', label: '****', color: color(resolver), stroke: stroke_style(resolver) } });
    this.cy.layout(this.layout).run();
  }

  current_resolver(resolver: solver.graph.Resolver): void {
    this.cy.layout(this.layout).run();
  }
}

function color(flaw: solver.graph.Flaw | solver.graph.Resolver): string {
  const cost = flaw.get_cost();
  if (cost === Infinity)
    return infiniteColor; // We use black for infinite cost
  else if (cost > 100)
    return costColorScale(1); // We use red for high costs
  else
    return costColorScale(cost / 100); // We use a gradient from green to red for costs between 0 and 100
}

function stroke_style(node: solver.graph.Flaw | solver.graph.Resolver): string {
  switch (node.get_state()) {
    case solver.graph.State.active:
      return 'solid';
    case solver.graph.State.forbidden:
      return 'dotted';
    case solver.graph.State.inactive:
      return 'dashed';
  }
}