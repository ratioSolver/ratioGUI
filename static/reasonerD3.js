const color_interpolator = d3.scaleSequential(d3.interpolateRdYlGn).domain([15, 0]);
const bisect_value = d3.bisector(d => d.to).left;
const font_size = 14;

class ReasonerD3 extends Reasoner {

    constructor(timelines_id = 'timelines', graph_id = 'graph', width = window.innerWidth, height = window.innerHeight - 56) {
        super();
        const timelines_svg = d3.select('#' + timelines_id).append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', '0 0 ' + width + ' ' + height);

        this.ag_lg = timelines_svg.append('defs').append('linearGradient').attr('id', 'ag-lg').attr('x1', '0%').attr('x2', '0%').attr('y1', '0%').attr('y2', '100%');
        this.ag_lg.append('stop').attr('offset', '0%').style('stop-color', 'navajowhite').style('stop-opacity', 1);
        this.ag_lg.append('stop').attr('offset', '20%').style('stop-color', 'ivory').style('stop-opacity', 1);
        this.ag_lg.append('stop').attr('offset', '100%').style('stop-color', 'navajowhite').style('stop-opacity', 1);

        this.timelines_g = timelines_svg.append('g');

        this.timelines_height = height;

        this.timelines_x_scale = d3.scaleLinear().range([0, width]);
        this.timelines_y_scale = d3.scaleBand().rangeRound([0, this.timelines_height]).padding(0.1);

        this.timelines_axis_g = timelines_svg.append('g');
        this.timelines_x_axis = d3.axisBottom(this.timelines_x_scale);
        this.timelines_axis_g.call(this.timelines_x_axis);

        this.scale = 1;
        this.timelines_zoom = d3.zoom().on('zoom', event => {
            this.timelines_axis_g.call(this.timelines_x_axis.scale(event.transform.rescaleX(this.timelines_x_scale)));
            this.timelines_g.attr('transform', event.transform);
            if (this.scale != event.transform.k) {
                this.scale = event.transform.k;
                wrap_text(this.scale);
            }
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
            .force('link', d3.forceLink().distance(70))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('pos', d3.forceX().x(d => (d.phi ? d.pos.lb : this.nodes.get(d.effect).pos.lb - 0.5) * 200).strength(0.5));

        this.tooltip = d3.select('body').append('div') // the tooltip always 'exists' as its own html div, even when not visible
            .style('position', 'absolute') // the absolute position is necessary so that we can manually define its position later
            .style('opacity', 0) // hide it from default at the start so it only appears on hover
            .attr('class', 'tooltip');
    }

    state_changed(message) {
        if (message.executing)
            for (const atm of this.executing_tasks)
                atm.current = false;
        super.state_changed(message);
        for (const tl of this.timelines.values())
            switch (tl.type) {
                case 'Agent':
                    tl.values = tl.values.map(atm_id => this.atoms.get(atm_id));
                    const ends = [0];
                    for (const val of tl.values) {
                        if (val.exprs.has('at')) {
                            val.from = val.exprs.get('at').value.num / val.exprs.get('at').value.den;
                            val.to = val.from + 1;
                        } else {
                            val.from = val.exprs.get('start').value.num / val.exprs.get('start').value.den;
                            val.to = val.exprs.get('end').value.num / val.exprs.get('end').value.den;
                        }
                        val.y = values_y(val.from, val.from === val.to ? val.from + 0.1 : val.to, ends);
                        val.text = this.ag_value_title(val);
                    }
                    break;
                case 'StateVariable':
                    for (const val of tl.values) {
                        val.from = val.from.num / val.from.den;
                        val.to = val.to.num / val.to.den;
                        val.text = this.sv_value_name(val);
                        val.atoms = val.atoms.map(atm_id => this.atoms.get(atm_id));
                    }
                    break;
                case 'ReusableResource':
                    tl.capacity = tl.capacity.num / tl.capacity.den;
                    for (const val of tl.values) {
                        val.from = val.from.num / val.from.den;
                        val.to = val.to.num / val.to.den;
                        val.usage = val.usage.num / val.usage.den;
                        val.atoms = val.atoms.map(atm_id => this.atoms.get(atm_id));
                    }
                    if (tl.values.length)
                        tl.values.push({
                            atoms: [],
                            from: tl.values[tl.values.length - 1].to,
                            to: this.horizon,
                            usage: 0
                        });
                    else
                        tl.values.push({
                            atoms: [],
                            from: this.origin,
                            to: this.horizon,
                            usage: 0
                        });
                    break;
                case 'ConsumableResource':
                    tl.capacity = tl.capacity.num / tl.capacity.den;
                    for (const val of tl.values) {
                        val.from = val.from.num / val.from.den;
                        val.to = val.to.num / val.to.den;
                        val.start = val.start.num / val.start.den;
                        val.end = val.end.num / val.end.den;
                        val.atoms = val.atoms.map(atm_id => this.atoms.get(atm_id));
                    }
                    if (tl.values.length)
                        tl.values.push({
                            atoms: [],
                            from: tl.values[tl.values.length - 1].to,
                            to: this.horizon,
                            start: tl.values[tl.values.length - 1].end,
                            end: tl.values[tl.values.length - 1].end
                        });
                    else
                        tl.values.push({
                            atoms: [],
                            from: this.origin,
                            to: this.horizon,
                            start: 0,
                            end: 0
                        });
                    break;
            }
        for (const atm of this.executing_tasks)
            atm.current = true;
        this.update_timelines();
        if (message.time)
            this.update_time();
    }

    solution_found() {
        if (this.current_flaw) this.current_flaw.current = false;
        if (this.current_resolver) this.current_resolver.current = false;
        super.solution_found();
        this.update_time();
        this.update_graph();
    }

    inconsistent_problem() {
        super.inconsistent_problem();
    }

    tick(message) {
        super.tick(message);
        this.update_time();
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

    start(message) {
        super.start(message);
        for (const atm of message.start)
            this.atoms.get(atm).current = true;
        this.update_timelines();
    }

    end(message) {
        for (const atm of message.end)
            this.atoms.get(atm).current = false;
        super.end(message);
        this.update_timelines();
    }

    update_timelines() {
        this.timelines_x_scale.domain([0, this.horizon]);
        this.timelines_axis_g.call(this.timelines_x_axis);
        this.timelines_y_scale.domain(d3.range(this.timelines.size));

        const timelines = Array.from(this.timelines.values());
        this.timelines_g.selectAll('g.timeline').data(timelines).join(
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
                    .text(d => this.timeline_name(d))
                    .style('text-anchor', 'start');

                return tl_g;
            },
            update => {
                update.select('rect').transition()
                    .attr('width', this.timelines_x_scale(this.horizon) + 20);

                update.select('text')
                    .text(d => this.timeline_name(d));

                return update;
            });

        for (const [i, tl] of timelines.entries())
            this.update_timeline(i, tl);
    }

    update_timeline(i, tl) {
        switch (tl.type) {
            case 'Agent':
                const max_overlap = d3.max(tl.values, d => d.y) + 1;
                const agent_y_scale = d3.scaleBand().domain(d3.range(max_overlap)).rangeRound([0, this.timelines_y_scale.bandwidth() * 0.9]).padding(0.1);
                d3.select('#tl-' + tl.id).selectAll('g').data(tl.values).join(
                    enter => {
                        const tl_val_g = enter.append('g')
                            .attr('class', 'wrappable');

                        tl_val_g.append('rect')
                            .attr('x', d => this.timelines_x_scale(d.from))
                            .attr('y', d => this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth() * 0.1 + agent_y_scale(max_overlap - 1 - d.y))
                            .attr('width', d => d.from === d.to ? 1 : this.timelines_x_scale(d.to) - this.timelines_x_scale(d.from))
                            .attr('height', agent_y_scale.bandwidth())
                            .attr('rx', 5)
                            .attr('ry', 5)
                            .style('fill', 'url(#ag-lg)')
                            .style('stroke', d => value_stroke(d))
                            .style('stroke-width', d => stroke_width(d));

                        tl_val_g.append('text')
                            .attr('x', d => this.timelines_x_scale(d.from) + (d.from === d.to ? 1 : this.timelines_x_scale(d.to) - this.timelines_x_scale(d.from)) / 2)
                            .attr('y', d => this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth() * 0.1 + agent_y_scale(max_overlap - 1 - d.y) + agent_y_scale.bandwidth() / 2)
                            .text(d => d.text)
                            .style('text-anchor', 'middle');

                        tl_val_g.on('mouseover', (event, d) => this.tooltip.html(this.ag_value_content(d)).transition().duration(200).style('opacity', .9))
                            .on('mousemove', event => this.tooltip.style('left', (event.pageX) + 'px').style('top', (event.pageY - 28) + 'px'))
                            .on('mouseout', event => this.tooltip.transition().duration(500).style('opacity', 0));

                        return tl_val_g;
                    },
                    update => {
                        update.select('rect').transition().duration(200)
                            .attr('x', d => this.timelines_x_scale(d.from))
                            .attr('y', d => this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth() * 0.1 + agent_y_scale(max_overlap - 1 - d.y))
                            .attr('width', d => d.from === d.to ? 1 : this.timelines_x_scale(d.to) - this.timelines_x_scale(d.from))
                            .attr('height', agent_y_scale.bandwidth() * 0.9)
                            .style('stroke', d => value_stroke(d))
                            .style('stroke-width', d => stroke_width(d));

                        update.select('text')
                            .text(d => d.text)
                            .attr('x', d => this.timelines_x_scale(d.from) + (d.from === d.to ? 1 : this.timelines_x_scale(d.to) - this.timelines_x_scale(d.from)) / 2)
                            .attr('y', d => this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth() * 0.1 + agent_y_scale(max_overlap - 1 - d.y) + agent_y_scale.bandwidth() / 2);

                        return update;
                    }
                );
                break;
            case 'StateVariable':
                d3.select('#tl-' + tl.id).selectAll('g').data(tl.values).join(
                    enter => {
                        const tl_val_g = enter.append('g')
                            .attr('class', 'wrappable');

                        tl_val_g.append('rect')
                            .attr('x', d => this.timelines_x_scale(d.from))
                            .attr('y', d => this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth() * 0.1)
                            .attr('width', d => this.timelines_x_scale(d.to) - this.timelines_x_scale(d.from))
                            .attr('height', this.timelines_y_scale.bandwidth() * 0.9)
                            .attr('rx', 5)
                            .attr('ry', 5)
                            .style('fill', d => sv_value_fill(d))
                            .style('stroke', d => value_stroke(d))
                            .style('stroke-width', d => stroke_width(d));

                        tl_val_g.append('text')
                            .attr('x', d => this.timelines_x_scale(d.from) + (this.timelines_x_scale(d.to) - this.timelines_x_scale(d.from)) / 2)
                            .attr('y', d => this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth() * 0.5)
                            .text(d => d.text)
                            .style('text-anchor', 'middle');

                        tl_val_g.on('mouseover', (event, d) => this.tooltip.html(this.sv_value_content(d)).transition().duration(200).style('opacity', .9))
                            .on('mousemove', event => this.tooltip.style('left', (event.pageX) + 'px').style('top', (event.pageY - 28) + 'px'))
                            .on('mouseout', event => this.tooltip.transition().duration(500).style('opacity', 0));

                        return tl_val_g;
                    },
                    update => {
                        update.select('rect').transition().duration(200)
                            .attr('x', d => this.timelines_x_scale(d.from))
                            .attr('y', d => this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth() * 0.1).attr('width', d => this.timelines_x_scale(d.to) - this.timelines_x_scale(d.from))
                            .attr('height', this.timelines_y_scale.bandwidth() * 0.9)
                            .style('fill', d => sv_value_fill(d))
                            .style('stroke', d => value_stroke(d))
                            .style('stroke-width', d => stroke_width(d));

                        update.select('text')
                            .text(d => d.text)
                            .transition().duration(200)
                            .attr('x', d => this.timelines_x_scale(d.from) + (this.timelines_x_scale(d.to) - this.timelines_x_scale(d.from)) / 2)
                            .attr('y', d => this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth() * 0.5);

                        return update;
                    }
                );
                break;
            case 'ReusableResource':
                const rr_max_val = (tl.values.length ? Math.max(d3.max(tl.values, d => d.usage), tl.capacity) : tl.capacity);
                const rr_y_scale = d3.scaleLinear().domain([0, rr_max_val + rr_max_val * 0.1]).range([this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth(), this.timelines_y_scale(i)]);
                const rr_g = d3.select('#tl-' + tl.id);
                rr_g.selectAll('path').data([tl.values]).join(
                    enter => {
                        const tl_val_g = enter.append('path')
                            .attr('fill', 'aliceblue')
                            .attr('stroke', 'lightblue')
                            .attr('d', d3.area().curve(d3.curveStepAfter)
                                .x(d => this.timelines_x_scale(d.from))
                                .y0(this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth())
                                .y1(d => rr_y_scale(d.usage)));

                        tl_val_g
                            .on('mouseover', (event, d) => {
                                const i = bisect_value(d, this.timelines_x_scale.invert(d3.pointer(event)[0]), 1);
                                return this.tooltip.html(this.rr_value_content(d[i])).transition().duration(200).style('opacity', .9);
                            })
                            .on('mousemove', (event, d) => {
                                const i = bisect_value(d, this.timelines_x_scale.invert(d3.pointer(event)[0]), 1);
                                this.tooltip.html(this.rr_value_content(d[i])).transition().duration(200).style('opacity', .9);
                                return this.tooltip.style('left', (event.pageX) + 'px').style('top', (event.pageY - 28) + 'px');
                            })
                            .on('mouseout', event => this.tooltip.transition().duration(500).style('opacity', 0));

                        return tl_val_g;
                    },

                    update => {
                        update.transition().duration(200)
                            .attr('d', d3.area().curve(d3.curveStepAfter)
                                .x(d => this.timelines_x_scale(d.from))
                                .y0(this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth())
                                .y1(d => rr_y_scale(d.usage)));

                        return update;
                    }
                );
                rr_g.selectAll('line').data([tl.capacity]).join(
                    enter => {
                        const line_g = enter.append('line')
                            .attr('stroke-width', 2)
                            .attr('stroke-opacity', 0.8)
                            .attr('stroke-linecap', 'round')
                            .attr('stroke', 'darkslategray');
                        line_g
                            .attr('x1', this.timelines_x_scale(0))
                            .attr('y1', d => rr_y_scale(d))
                            .attr('x2', this.timelines_x_scale(this.horizon))
                            .attr('y2', d => rr_y_scale(d));
                        return line_g;
                    },

                    update => {
                        update.transition().duration(200)
                            .attr('y1', d => rr_y_scale(d))
                            .attr('x2', this.timelines_x_scale(this.horizon))
                            .attr('y2', d => rr_y_scale(d));
                        return update;
                    }
                );
                break;
            case 'ConsumableResource':
                const cr_max_val = (tl.values.length ? Math.max(d3.max(tl.values, d => Math.max(d.start, d.end)), tl.capacity) : tl.capacity);
                const cr_min_val = (tl.values.length ? Math.min(d3.min(tl.values, d => Math.min(d.start, d.end)), 0) : 0);
                const cr_y_scale = d3.scaleLinear().domain([cr_min_val, cr_max_val + cr_max_val * 0.1]).range([this.timelines_y_scale(i) + this.timelines_y_scale.bandwidth(), this.timelines_y_scale(i)]);
                const cr_g = d3.select('#tl-' + tl.id);
                cr_g.selectAll('path').data([tl.values]).join(
                    enter => {
                        const tl_val_g = enter.append('path')
                            .attr('fill', 'aliceblue')
                            .attr('stroke', 'lightblue')
                            .attr('d', d3.area().curve(d3.curveLinear)
                                .x(d => this.timelines_x_scale(d.from))
                                .y0(cr_y_scale(0))
                                .y1(d => cr_y_scale(d.start)));

                        tl_val_g
                            .on('mouseover', (event, d) => {
                                const i = bisect_value(d, this.timelines_x_scale.invert(d3.pointer(event)[0]));
                                return this.tooltip.html(this.cr_value_content(d[i])).transition().duration(200).style('opacity', .9);
                            })
                            .on('mousemove', (event, d) => {
                                const i = bisect_value(d, this.timelines_x_scale.invert(d3.pointer(event)[0]));
                                this.tooltip.html(this.cr_value_content(d[i])).transition().duration(200).style('opacity', .9);
                                return this.tooltip.style('left', (event.pageX) + 'px').style('top', (event.pageY - 28) + 'px');
                            })
                            .on('mouseout', event => this.tooltip.transition().duration(500).style('opacity', 0));

                        return tl_val_g;
                    },

                    update => {
                        update.transition().duration(200)
                            .attr('d', d3.area().curve(d3.curveLinear)
                                .x(d => this.timelines_x_scale(d.from))
                                .y0(cr_y_scale(0))
                                .y1(d => cr_y_scale(d.start)));

                        return update;
                    }
                );
                cr_g.selectAll('line').data([tl.capacity, 0]).join(
                    enter => {
                        const line_g = enter.append('line')
                            .attr('stroke-width', 2)
                            .attr('stroke-opacity', 0.8)
                            .attr('stroke-linecap', 'round')
                            .attr('stroke', 'darkslategray');
                        line_g
                            .attr('x1', this.timelines_x_scale(0))
                            .attr('y1', d => cr_y_scale(d))
                            .attr('x2', this.timelines_x_scale(this.horizon))
                            .attr('y2', d => cr_y_scale(d));
                        return line_g;
                    },

                    update => {
                        update.transition().duration(200)
                            .attr('y1', d => cr_y_scale(d))
                            .attr('x2', this.timelines_x_scale(this.horizon))
                            .attr('y2', d => cr_y_scale(d));
                        return update;
                    }
                );
                break;
        }
        wrap_text(this.scale);
    }

    update_time() {
        if (this.timelines.size)
            this.timelines_g.selectAll('g.time').data([this.current_time]).join(
                enter => {
                    const t_g = enter.append('g').attr('class', 'time');
                    t_g.append('line')
                        .attr('stroke-width', 2)
                        .attr('stroke-linecap', 'round')
                        .attr('stroke', 'lavender')
                        .attr('stroke-opacity', 0.4)
                        .attr('x1', this.timelines_x_scale(this.current_time))
                        .attr('y1', 0).attr('x2', this.timelines_x_scale(this.current_time))
                        .attr('y2', this.timelines_height);
                    t_g.append('line')
                        .attr('stroke-width', 0.2)
                        .attr('stroke-linecap', 'round')
                        .attr('stroke', 'black')
                        .attr('x1', this.timelines_x_scale(this.current_time))
                        .attr('y1', 0).attr('x2', this.timelines_x_scale(this.current_time))
                        .attr('y2', this.timelines_height);
                    return t_g;
                },
                update => {
                    update.selectAll('line').transition().duration(200)
                        .attr('x1', this.timelines_x_scale(this.current_time))
                        .attr('x2', this.timelines_x_scale(this.current_time));
                    return update;
                });
    }

    update_graph() {
        const nodes = Array.from(this.nodes.values());
        const links = Array.from(this.edges);
        for (const link of links) {
            link.source = this.nodes.get(link.from);
            link.target = this.nodes.get(link.to);
        }

        const l_group = this.graph_g.selectAll('line').data(links).join(
            enter => {
                return enter.append('line').attr('stroke', 'dimgray').style('stroke-dasharray', d => stroke_dasharray(d));
            },
            update => {
                update.style('stroke-dasharray', d => stroke_dasharray(d));
                return update;
            }
        );

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
                    .transition().duration(500).style('stroke', d => node_stroke(d))
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
                    .style('stroke', d => node_stroke(d))
                    .style('stroke-width', d => stroke_width(d));

                update.select('text')
                    .style('opacity', d => node_opacity(d));

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

function values_y(start, end, ends) {
    for (let i = 0; i < ends.length; i++)
        if (ends[i] <= start) {
            ends[i] = end;
            return i;
        }
    ends.push(end);
    return ends.length - 1;
}

function value_stroke(n) {
    return n.current ? 'dimgray' : 'lightgray';
}

function node_stroke(n) {
    return n.current ? '#ff00ff' : '#262626';
}

function stroke_width(n) {
    return n.current ? '2' : '1';
}

function stroke_dasharray(n) {
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

function wrap_text(scale) {
    for (const d of d3.selectAll('.wrappable').nodes()) {
        if (scale > 1)
            d.lastChild.style.fontSize = font_size / scale;
        const width = d.firstChild.width.baseVal.value;
        d.lastChild.textContent = d3.select(d).datum().text;
        while (d.lastChild.getComputedTextLength() >= width - 5)
            d.lastChild.textContent = d.lastChild.textContent.slice(0, -1);
    }
}