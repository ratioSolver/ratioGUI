import { Solver } from "./solver.js";

import { bisector, max, range } from 'd3-array';
import { axisBottom } from 'd3-axis';
import { drag } from 'd3-drag';
import { forceCenter, forceLink, forceManyBody, forceSimulation, forceX } from 'd3-force';
import { scaleBand, scaleLinear, scaleOrdinal, scaleSequential } from 'd3-scale';
import { interpolateRdYlGn } from 'd3-scale-chromatic';
import { select, selectAll } from 'd3-selection';
import { area } from 'd3-shape';
import { zoom } from 'd3-zoom';

const d3 = {
    bisector, max, range,
    axisBottom,
    drag,
    forceCenter, forceLink, forceManyBody, forceSimulation, forceX,
    interpolateRdYlGn,
    scaleBand, scaleLinear, scaleOrdinal, scaleSequential,
    select, selectAll,
    area,
    zoom
}

export class SolverD3 extends Solver {

    constructor() {
        super();
    }
}