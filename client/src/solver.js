export class Solver {

    constructor(id, name, state) {
        this.id = id;
        this.name = name;
        this.state = state;

        this.items = new Map();
        this.atoms = new Map();

        this.timelines = new Map();
        this.origin = 0;
        this.horizon = 1;

        this.nodes = new Map();
        this.edges = new Set();
        this.current_flaw;
        this.current_resolver;

        this.current_time = 0;
        this.executing_tasks = new Set();
    }

    state_changed(message) {
        this.items.clear(); if (message.state.items) for (const itm of message.state.items) this.items.set(parseInt(itm.id), itm);
        this.atoms.clear(); if (message.state.atoms) for (const atm of message.state.atoms) this.atoms.set(parseInt(atm.id), atm);

        this.exprs = this.exprs_to_map(message.state.exprs);
        for (const itm of this.items.values())
            if (itm.exprs)
                itm.exprs = this.exprs_to_map(itm.exprs);
        for (const atm of this.atoms.values())
            if (atm.exprs)
                atm.exprs = this.exprs_to_map(atm.exprs);

        const origin_var = this.exprs.get('origin');
        const horizon_var = this.exprs.get('horizon');
        this.origin = origin_var.value.num / origin_var.value.den;
        this.horizon = horizon_var.value.num / horizon_var.value.den;

        this.timelines.clear();
        for (const tl of message.timelines)
            this.timelines.set(tl.id, tl);

        this.executing_tasks.clear();
        for (const atm of message.executing)
            this.executing_tasks.add(this.atoms.get(atm));
        this.current_time = message.time.num / message.time.den;
    }

    solution_found() {
        this.current_flaw = undefined;
        this.current_resolver = undefined;
    }

    inconsistent_problem() {
        this.current_flaw = undefined;
        this.current_resolver = undefined;
    }

    executor_state_changed(message) {
        this.state = message.state;
    }

    tick(message) {
        this.current_time = message.time.num / message.time.den;
    }

    graph(message) {
        this.nodes.clear();
        this.edges.clear();
        this.current_flaw = undefined;
        this.current_resolver = undefined;

        for (const f of message.flaws) {
            const flaw = {
                reasoner: this,
                id: f.id,
                phi: f.phi,
                causes: f.causes,
                state: f.state,
                cost: f.cost.num / f.cost.den,
                pos: f.pos,
                data: f.data
            };
            flaw.label = this.flaw_label(flaw);
            flaw.title = this.flaw_tooltip(flaw);
            this.nodes.set(flaw.id, flaw);
        }

        for (const r of message.resolvers) {
            const resolver = {
                reasoner: this,
                id: r.id,
                rho: r.rho,
                preconditions: r.preconditions,
                effect: r.effect,
                state: r.state,
                intrinsic_cost: r.intrinsic_cost.num / r.intrinsic_cost.den,
                data: r.data,
                edges: []
            };
            resolver.cost = this.estimate_cost(resolver);
            resolver.label = this.resolver_label(resolver);
            resolver.title = this.resolver_tooltip(resolver);
            this.nodes.set(resolver.id, resolver);

            const eff_edge = { from: r.id, to: r.effect, state: resolver.state };
            this.edges.add(eff_edge);
            resolver.edges.push(eff_edge);
            for (const f of resolver.preconditions) {
                const prec_edge = { from: f, to: resolver.id, state: resolver.state };
                this.edges.add(prec_edge);
                resolver.edges.push(prec_edge);
            }
        }

        if (message.current_flaw) {
            this.current_flaw = this.nodes.get(message.current_flaw);
            if (message.current_resolver)
                this.current_resolver = this.nodes.get(message.current_resolver);
        }
    }

    flaw_created(message) {
        const flaw = {
            reasoner: this,
            id: message.id,
            phi: message.phi,
            causes: message.causes,
            state: message.state,
            cost: message.cost.num / message.cost.den,
            pos: { lb: 0 },
            data: message.data
        };
        flaw.label = this.flaw_label(flaw);
        flaw.title = this.flaw_tooltip(flaw);
        this.nodes.set(flaw.id, flaw);
        for (const c_id of flaw.causes) {
            const cause = this.nodes.get(c_id);
            cause.preconditions.push(flaw.id);
            const c_res_cost = this.estimate_cost(cause);
            if (cause.cost != c_res_cost) {
                cause.cost = c_res_cost;
                cause.title = this.resolver_tooltip(cause);
            }
            const cause_edge = { from: flaw.id, to: cause.id, state: cause.state };
            this.edges.add(cause_edge);
            cause.edges.push(cause_edge);
        }
    }

    flaw_state_changed(message) {
        const flaw = this.nodes.get(message.id);
        flaw.state = message.state;
    }

    flaw_cost_changed(message) {
        const flaw = this.nodes.get(message.id);
        flaw.cost = message.cost.num / message.cost.den;
        flaw.title = this.flaw_tooltip(flaw);

        for (const c_id of flaw.causes) {
            const cause = this.nodes.get(c_id);
            const c_res_cost = this.estimate_cost(cause);
            if (cause.cost != c_res_cost) {
                cause.cost = c_res_cost;
                cause.title = this.resolver_tooltip(cause);
            }
        }
    }

    flaw_position_changed(message) {
        const flaw = this.nodes.get(message.id);
        flaw.pos = message.pos;
        flaw.title = this.flaw_tooltip(flaw);
    }

    current_flaw_changed(message) {
        this.current_flaw = this.nodes.get(message.id);
        this.current_resolver = undefined;
    }

    resolver_created(message) {
        const resolver = {
            reasoner: this,
            id: message.id,
            rho: message.rho,
            preconditions: message.preconditions,
            effect: message.effect,
            state: message.state,
            intrinsic_cost: message.intrinsic_cost.num / message.intrinsic_cost.den,
            data: message.data,
            edges: []
        };
        resolver.cost = this.estimate_cost(resolver);
        resolver.label = this.resolver_label(resolver);
        resolver.title = this.resolver_tooltip(resolver);
        this.nodes.set(resolver.id, resolver);
        const eff_edge = { from: message.id, to: message.effect, state: resolver.state };
        this.edges.add(eff_edge);
        resolver.edges.push(eff_edge);
    }

    resolver_state_changed(message) {
        const resolver = this.nodes.get(message.id);
        resolver.state = message.state;
        resolver.cost = this.estimate_cost(resolver);
        resolver.title = this.resolver_tooltip(resolver);
        for (const edge of resolver.edges) {
            edge.state = resolver.state;
        }
    }

    current_resolver_changed(message) {
        this.current_resolver = this.nodes.get(message.id);
    }

    causal_link_added(message) {
        const flaw = this.nodes.get(message.flaw_id);
        const resolver = this.nodes.get(message.resolver_id);
        resolver.preconditions.push(flaw.id);
        flaw.causes.push(resolver.id);
        this.edges.add({ from: message.flaw_id, to: message.resolver_id, resolver: resolver });
        resolver.cost = this.estimate_cost(resolver);
        resolver.title = this.resolver_tooltip(resolver);
    }

    estimate_cost(res) {
        if (!res.state) return Number.POSITIVE_INFINITY;
        return (res.preconditions.length ? Math.max.apply(this, res.preconditions.map(f_id => this.nodes.get(f_id).cost)) : 0) + res.intrinsic_cost;
    }

    starting(message) {
        console.log('starting');
        for (const atm of message.starting)
            console.log(this.atom_content(this.atoms.get(atm)));
    }

    start(message) {
        for (const atm of message.start)
            this.executing_tasks.add(this.atoms.get(atm));
    }

    ending(message) {
        console.log('ending');
        for (const atm of message.ending)
            console.log(this.atom_content(this.atoms.get(atm)));
    }

    end(message) {
        for (const atm of message.end)
            this.executing_tasks.delete(this.atoms.get(atm));
    }

    timeline_name(tl) { return tl.name; }

    ag_value_title(ag_val) { return this.atom_title(ag_val); }

    ag_value_content(ag_val) { return this.atom_content(ag_val); }

    sv_value_title(sv_val) {
        switch (sv_val.atoms.length) {
            case 0: return '';
            case 1: return this.atom_title(this.atoms.get(sv_val.atoms[0]));
            default: return Array.from(sv_val.atoms, atm => this.atom_title(this.atoms.get(atm))).join(', ');
        }
    }

    sv_value_content(sv_val) {
        switch (sv_val.atoms.length) {
            case 0: return '';
            case 1: return this.atom_content(sv_val.atoms[0]);
            default: return Array.from(sv_val.atoms, atm => '<br>' + this.atom_content(atm)).join(', ');
        }
    }

    rr_value_content(rr_val) {
        switch (rr_val.atoms.length) {
            case 0: return '0: [' + rr_val.from + ', ' + rr_val.to + ']';
            case 1: return rr_val.usage + ': [' + rr_val.from + ', ' + rr_val.to + ']<br>' + this.atom_content(rr_val.atoms[0]);
            default: return rr_val.usage + ': [' + rr_val.from + ', ' + rr_val.to + ']' + Array.from(rr_val.atoms, atm => '<br>' + this.atom_content(atm)).join(', ');
        }
    }

    cr_value_content(cr_val) {
        switch (cr_val.atoms.length) {
            case 0: return cr_val.start + ': [' + cr_val.from + ', ' + cr_val.to + ']';
            case 1: return cr_val.start + ' -> ' + cr_val.end + ': [' + cr_val.from + ', ' + cr_val.to + ']<br>' + this.atom_content(cr_val.atoms[0]);
            default: return cr_val.start + ' -> ' + cr_val.end + ': [' + cr_val.from + ', ' + cr_val.to + ']' + Array.from(cr_val.atoms, atm => '<br>' + this.atom_content(atm)).join(', ');
        }
    }

    item_title(itm) { return itm.type.split(":").pop() + '(' + Array.from(itm.exprs.keys()).join(', ') + ')'; }

    item_content(itm) {
        const pars = [];
        for (const [name, val] of itm.exprs)
            pars.push('<br>' + name + ': ' + this.val_to_string(val));
        return itm.type + '(' + pars.join(',') + '<br>)';
    }

    atom_title(atm) { return atm.type.split(":").pop() + '(' + Array.from(atm.exprs.keys()).filter(par => par != 'start' && par != 'end' && par != 'duration' && par != 'tau').map(par => this.val_to_string(atm.exprs.get(par))).join(', ') + ')'; }

    atom_content(atm) {
        const pars = [];
        for (const [name, val] of atm.exprs)
            if (name != 'tau')
                pars.push('<br>' + name + ': ' + this.val_to_string(val));
        return '\u03C3' + atm.sigma + ' ' + atm.type + '(' + pars.join(',') + '<br>)';
    }

    val_to_string(val) {
        switch (val.type) {
            case 'bool': return val.value;
            case 'real':
                const lb = val.value.lb ? val.value.lb.num / val.value.lb.den : Number.NEGATIVE_INFINITY;
                const ub = val.value.ub ? val.value.ub.num / val.value.ub.den : Number.POSITIVE_INFINITY;
                if (lb == ub)
                    return val.value.num / val.value.den;
                else
                    return val.value.num / val.value.den + ' [' + lb + ', ' + ub + ']';
            case 'string': return val.value;
            default:
                return Array.isArray(val.value) ? '[' + val.value.map(itm => itm.name).sort().join(',') + ']' : val.name;
        }
    }

    exprs_to_map(xprs_array) {
        const xprs = new Map();

        for (const xpr of xprs_array.sort((a, b) => a.name.localeCompare(b.name))) {
            switch (xpr.type) {
                case 'bool':
                case 'int':
                case 'real':
                case 'string':
                    xprs.set(xpr.name, { 'type': xpr.type, 'value': xpr.value });
                    break;
                default:
                    if (typeof xpr.value == 'object') {
                        if (xpr.value.vals.length == 1)
                            xprs.set(xpr.name, this.items.has(xpr.value.vals[0]) ? this.items.get(xpr.value.vals[0]) : this.atoms.get(xpr.value.vals[0]));
                        else
                            xprs.set(xpr.name, xpr.value.vals.map(itm_id => this.items.has(itm_id) ? this.items.get(itm_id) : this.atoms.get(itm_id)));
                    } else
                        xprs.set(xpr.name, this.items.has(xpr.value) ? this.items.get(xpr.value) : this.atoms.get(xpr.value));
                    break;
            }
        }

        return xprs;
    }

    flaw_label(flaw) {
        switch (flaw.data.type) {
            case 'fact':
                return 'fact \u03C3' + flaw.data.atom.sigma + ' ' + flaw.data.atom.type;
            case 'goal':
                return 'goal \u03C3' + flaw.data.atom.sigma + ' ' + flaw.data.atom.type;
            case 'enum':
                return 'enum';
            case 'bool':
                return 'bool';
            default:
                switch (flaw.phi) {
                    case 'b0':
                    case '\u00ACb0':
                        return flaw.data.type;
                    default:
                        return flaw.phi.replace('b', '\u03C6') + ' ' + flaw.data.type;
                }
        }
    }

    flaw_tooltip(flaw) {
        switch (flaw.phi) {
            case 'b0':
            case '\u00ACb0':
                return 'cost: ' + flaw.cost + ', pos: ' + flaw.pos.lb;
            default:
                return flaw.phi.replace('b', '\u03C6') + ', cost: ' + flaw.cost + ', pos: ' + flaw.pos.lb;
        }
    }

    resolver_label(resolver) {
        if (resolver.data.type)
            switch (resolver.data.type) {
                case 'activate':
                    return 'activate';
                case 'unify':
                    return 'unify';
                case 'assignment':
                    if (resolver.data.name)
                        return resolver.data.name;
                    else if (resolver.data.value.lit)
                        return resolver.data.value.val;
                    else if (resolver.data.value.lin) {
                        const lb = resolver.data.value.lb ? resolver.data.value.lb.num / resolver.data.value.lb.den : Number.NEGATIVE_INFINITY;
                        const ub = resolver.data.value.ub ? resolver.data.value.ub.num / resolver.data.value.ub.den : Number.POSITIVE_INFINITY;
                        if (lb == ub)
                            return resolver.data.value.num / resolver.data.value.den;
                        else
                            return resolver.data.value.num / resolver.data.value.den + ' [' + lb + ', ' + ub + ']';
                    }
                    else if (resolver.data.value.var)
                        return JSON.stringify(resolver.data.value.vals);
                    else
                        return resolver.data.value;
                default:
                    switch (resolver.rho) {
                        case 'b0':
                        case '\u00ACb0':
                            return resolver.data.type;
                        default:
                            return resolver.rho.replace('b', '\u03C1') + ' ' + resolver.data.type;
                    }
            }
        switch (resolver.rho) {
            case 'b0':
                return '\u22A4';
            case '\u00ACb0':
                return '\u22A5';
            default:
                return resolver.rho.replace('b', '\u03C1');
        }
    }

    resolver_tooltip(resolver) {
        switch (resolver.rho) {
            case 'b0':
            case '\u00ACb0':
                return 'cost: ' + resolver.cost;
            default:
                return resolver.rho.replace('b', '\u03C1') + ', cost: ' + resolver.cost;
        }
    }
}