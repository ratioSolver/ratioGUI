import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import cytoscapePopper, { RefElement } from 'cytoscape-popper';
import tippy from 'tippy.js';

export * from './app';
export { solver } from './solver';
export { SolverGraph } from './solver_graph';
export { TimelinesChart } from './solver_timelines';
export * from './solver_components';

function tippyFactory(ref: RefElement, content: HTMLElement) {
  // Since tippy constructor requires DOM element/elements, create a placeholder
  var dummyDomEle = document.createElement('div');

  var tip = tippy(dummyDomEle, {
    getReferenceClientRect: ref.getBoundingClientRect,
    trigger: 'manual', // mandatory
    // dom element inside the tippy:
    content: content,
    // your own preferences:
    arrow: true,
    placement: 'bottom',
    hideOnClick: false,
    sticky: "reference",

    // if interactive:
    interactive: true,
    appendTo: document.body // or append dummyDomEle to document.body
  });

  return tip;
}

cytoscape.use(dagre);
cytoscape.use(cytoscapePopper(tippyFactory));