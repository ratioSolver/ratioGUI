const color_interpolator = d3.scaleSequential(d3.interpolateRdYlGn).domain([15, 0]);

class ReasonerD3 extends Reasoner {

    constructor(timelines_id = 'timelines', graph_id = 'graph', width = window.innerWidth, height = window.innerHeight - 56) {
        super();
        const timelines_svg = d3.select('#' + timelines_id).append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', '0 0 ' + width + ' ' + height);

        this.timelines_g = timelines_svg.append('g');

        this.timelines_height = height;

        this.timelines_x_scale = d3.scaleLinear().range([0, width]);
        this.timelines_y_scale = d3.scaleBand().rangeRound([0, this.timelines_height]).padding(0.1);

        this.timelines_axis_g = timelines_svg.append('g');
        this.timelines_x_axis = d3.axisBottom(this.timelines_x_scale);
        this.timelines_axis_g.call(this.timelines_x_axis);

        this.timelines_zoom = d3.zoom().on('zoom', event => {
            this.timelines_axis_g.call(this.timelines_x_axis.scale(event.transform.rescaleX(this.timelines_x_scale)));
            this.timelines_g.attr('transform', event.transform);
        });

        timelines_svg.call(this.timelines_zoom);

        const graph_svg = d3.select('#' + graph_id).append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', '0 0 ' + width + ' ' + height);

        this.graph_g = graph_svg.append('g');

        this.graph_zoom = d3.zoom().on('zoom', event => this.graph_g.attr('transform', event.transform));
        graph_svg.call(this.graph_zoom);

        graph_svg.append('svg:defs').append('svg:marker')
            .attr('id', 'triangle')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 7)
            .attr('markerHeight', 7)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('stroke', 'dimgray')
            .attr('fill', 'dimgray');

        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(70))
            .force('charge', d3.forceManyBody().strength(-70))
            .force('center', d3.forceCenter(width / 2, height / 2));

        this.tooltip = d3.select('body').append('div') // the tooltip always 'exists' as its own html div, even when not visible
            .style('position', 'absolute') // the absolute position is necessary so that we can manually define its position later
            .style('opacity', 0) // hide it from default at the start so it only appears on hover
            .attr('class', 'tooltip')
    }

    state_changed(message) {
        super.state_changed(message);
        this.update_timelines();
    }

    solution_found() {
        if (this.current_flaw) this.current_flaw.current = false;
        if (this.current_resolver) this.current_resolver.current = false;
        super.solution_found();
        this.update_graph();
    }

    inconsistent_problem() {
        super.inconsistent_problem();
    }

    tick(message) {
        super.tick(message);
    }

    graph(message) {
        super.graph(message);
        this.update_graph();
    }

    flaw_created(message) {
        super.flaw_created(message);
        this.update_graph();
    }

    flaw_state_changed(message) {
        super.flaw_state_changed(message);
        this.update_graph();
    }

    flaw_cost_changed(message) {
        super.flaw_cost_changed(message);
        this.update_graph();
    }

    flaw_position_changed(message) {
        super.flaw_position_changed(message);
        this.update_graph();
    }

    current_flaw_changed(message) {
        if (this.current_flaw) {
            this.current_flaw.current = false;
            if (this.current_resolver)
                this.current_resolver.current = false;
        }
        super.current_flaw_changed(message);
        this.current_flaw.current = true;
        this.update_graph();
        this.graph_g.transition().call(this.graph_zoom.translateTo, this.current_flaw.x, this.current_flaw.y);
    }

    resolver_created(message) {
        super.resolver_created(message);
        this.update_graph();
    }

    resolver_state_changed(message) {
        super.resolver_state_changed(message);
        this.update_graph();
    }

    current_resolver_changed(message) {
        super.current_resolver_changed(message);
        this.current_resolver.current = true;
        this.update_graph();
        this.graph_g.transition().call(this.graph_zoom.translateTo, this.current_resolver.x, this.current_resolver.y);
    }

    causal_link_added(message) {
        super.causal_link_added(message);
        this.update_graph();
    }

    update_timelines() {
        this.timelines_x_scale.domain([0, this.horizon]);
        this.timelines_axis_g.call(this.timelines_x_axis);
        this.timelines_y_scale.domain(d3.range(this.timelines.size));

        const timelines = Array.from(this.timelines.values());
        this.timelines_g.selectAll('g.timeline').data(timelines, d => d.id).join(
            enter => {
                const tl_g = enter.append('g')
                    .attr('class', 'timeline')
                    .attr('id', d => 'tl-' + d.id);
                tl_g.append('rect')
                    .attr('x', -10)
                    .attr('y', d => this.timelines_y_scale(timelines.indexOf(d)))
                    .attr('width', this.timelines_x_scale(this.horizon) + 20)
                    .attr('height', this.timelines_y_scale.bandwidth())
                    .style('fill', 'floralwhite');
                tl_g.append('text')
                    .attr('x', 0)
                    .attr('y', d => this.timelines_y_scale(timelines.indexOf(d)) + this.timelines_y_scale.bandwidth() * 0.08)
                    .text(d => this.tl_name(d))
                    .style('text-anchor', 'start');
                return tl_g;
            },
            update => {
                update.select('rect').transition()
                    .attr('width', this.timelines_x_scale(this.horizon) + 20);
                update.select('text')
                    .text(d => this.tl_name(d));
                return update;
            });

        for (const tl of timelines) {
        }
    }

    update_graph() {
        const nodes = Array.from(this.nodes.values());
        const links = Array.from(this.edges);
        for (const link of links) {
            link.source = this.nodes.get(link.from);
            link.target = this.nodes.get(link.to);
        }

        const n_group = this.graph_g.selectAll('g').data(nodes).join(
            enter => {
                const g = enter.append('g').attr('cursor', 'grab');
                g.append('rect')
                    .attr('width', 30)
                    .attr('x', -15)
                    .attr('height', 10)
                    .attr('y', -5)
                    .attr('rx', d => radius(d))
                    .attr('ry', d => radius(d))
                    .style('fill', d => node_color(d))
                    .style('fill-opacity', d => node_opacity(d))
                    .style('stroke-dasharray', d => stroke_dasharray(d))
                    .style('opacity', d => node_opacity(d))
                    .transition().duration(500).style('stroke', d => stroke(d))
                    .style('stroke-width', d => stroke_width(d));

                g.append('text')
                    .attr('y', -8)
                    .text(d => d.label)
                    .style('text-anchor', 'middle').style('opacity', d => node_opacity(d));

                g.on('mouseover', (event, d) => this.tooltip.html(d.title).transition().duration(200).style('opacity', 0.9))
                    .on('mousemove', event => this.tooltip.style('left', (event.pageX) + 'px').style('top', (event.pageY - 28) + 'px'))
                    .on('mouseout', event => this.tooltip.transition().duration(500).style('opacity', 0))
                    .on('click', (event, d) => { d.fx = null; d.fy = null; });

                g.call(d3.drag()
                    .on('start', drag_started)
                    .on('drag', dragging)
                    .on('end', drag_ended));

                return g;
            },
            update => {
                update.select('rect')
                    .style('fill', d => node_color(d))
                    .style('fill-opacity', d => node_opacity(d))
                    .style('stroke-dasharray', d => stroke_dasharray(d))
                    .style('opacity', d => node_opacity(d)).transition().duration(500)
                    .style('stroke', d => stroke(d))
                    .style('stroke-width', d => stroke_width(d));
                update.select('text')
                    .style('opacity', d => node_opacity(d));
                return update;
            }
        );

        const l_group = this.graph_g.selectAll('line').data(links).join(
            enter => {
                return enter.append('line').attr('stroke', 'dimgray').style('stroke-dasharray', d => stroke_dasharray(d));
            },
            update => {
                update.style('stroke-dasharray', d => stroke_dasharray(d));
                return update;
            }
        );

        this.simulation.nodes(nodes).on('tick', () => {
            n_group.attr('transform', d => `translate(${d.x}, ${d.y})`);
            l_group.each(l => {
                let src = intersection({ x: l.source.x - 15, y: l.source.y - 5 }, { x: l.source.x - 15, y: l.source.y + 5 }, { x: l.source.x, y: l.source.y }, { x: l.target.x, y: l.target.y });
                if (!src) src = intersection({ x: l.source.x - 15, y: l.source.y + 5 }, { x: l.source.x + 15, y: l.source.y + 5 }, { x: l.source.x, y: l.source.y }, { x: l.target.x, y: l.target.y });
                if (!src) src = intersection({ x: l.source.x + 15, y: l.source.y + 5 }, { x: l.source.x + 15, y: l.source.y - 5 }, { x: l.source.x, y: l.source.y }, { x: l.target.x, y: l.target.y });
                if (!src) src = intersection({ x: l.source.x + 15, y: l.source.y - 5 }, { x: l.source.x - 15, y: l.source.y - 5 }, { x: l.source.x, y: l.source.y }, { x: l.target.x, y: l.target.y });

                if (src) {
                    l.x1 = src.x;
                    l.y1 = src.y;
                } else {
                    l.x1 = l.source.x;
                    l.y1 = l.source.y;
                }

                let trgt = intersection({ x: l.target.x - 17, y: l.target.y - 7 }, { x: l.target.x - 17, y: l.target.y + 7 }, { x: l.source.x, y: l.source.y }, { x: l.target.x, y: l.target.y });
                if (!trgt) trgt = intersection({ x: l.target.x - 17, y: l.target.y + 7 }, { x: l.target.x + 17, y: l.target.y + 7 }, { x: l.source.x, y: l.source.y }, { x: l.target.x, y: l.target.y });
                if (!trgt) trgt = intersection({ x: l.target.x + 17, y: l.target.y + 7 }, { x: l.target.x + 17, y: l.target.y - 7 }, { x: l.source.x, y: l.source.y }, { x: l.target.x, y: l.target.y });
                if (!trgt) trgt = intersection({ x: l.target.x + 17, y: l.target.y - 7 }, { x: l.target.x - 17, y: l.target.y - 7 }, { x: l.source.x, y: l.source.y }, { x: l.target.x, y: l.target.y });

                if (trgt) {
                    l.x2 = trgt.x;
                    l.y2 = trgt.y;
                } else {
                    l.x1 = l.target.x;
                    l.y1 = l.target.y;
                }
            }).attr('x1', d => d.x1).attr('y1', d => d.y1).attr('x2', d => d.x2).attr('y2', d => d.y2).attr('marker-end', 'url(#triangle)');
        });
        this.simulation.force('link').links(links);

        this.simulation.restart();
        this.simulation.alpha(0.3);
    }
}

function stroke(n) {
    return n.current ? '#ff00ff' : '#262626';
}

function stroke_width(n) {
    return n.current ? '2' : '1';
}

function stroke_dasharray(n) {
    if (!n)
        console.log('here..');
    switch (n.state) {
        case 0: // False
            return '1';
        case 1: // True
            return null;
        case 2: // Undefined
            return '2';
        default:
            break;
    }
}

function radius(n) {
    return n.phi ? 1 : 4;
}

function node_color(n) {
    switch (n.state) {
        case 0: // False
            return '#d9d9d9';
        default:
            return color_interpolator(n.cost);
    }
}

function node_opacity(n) {
    switch (n.state) {
        case 0: // False
            return 0.5;
        default:
            return 1;
    }
}

function intersection(p0, p1, p2, p3) {
    const s1_x = p1.x - p0.x, s1_y = p1.y - p0.y, s2_x = p3.x - p2.x, s2_y = p3.y - p2.y;

    const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
    const t = (s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);

    if (s >= 0 && s <= 1 && t >= 0 && t <= 1)
        return { x: p0.x + (t * s1_x), y: p0.y + (t * s1_y) };
    else
        return undefined;
}

function drag_started(event, d) {
    if (!event.active) d.reasoner.simulation.alphaTarget(0.3).restart();
    d3.select(this).attr('cursor', 'grabbing');
}

function dragging(event, d) {
    d.fx = event.x;
    d.fy = event.y;
    d.reasoner.tooltip.style('left', (event.sourceEvent.pageX) + 'px').style('top', (event.sourceEvent.pageY - 28) + 'px');
}

function drag_ended(event, d) {
    if (!event.active) d.reasoner.simulation.alphaTarget(0);
    d.fx = d.x;
    d.fy = d.y;
    d3.select(this).attr('cursor', 'grab');
}