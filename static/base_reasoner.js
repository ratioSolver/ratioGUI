class Reasoner {

    constructor() {
        this.items = new Map();
        this.atoms = new Map();

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

        this.executing_tasks.clear();
    }

    solution_found() {
        this.current_flaw = undefined;
        this.current_resolver = undefined;
    }

    inconsistent_problem() {
        this.current_flaw = undefined;
        this.current_resolver = undefined;
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
                id: r.id,
                rho: r.rho,
                preconditions: r.preconditions,
                effect: r.effect,
                state: r.state,
                intrinsic_cost: r.intrinsic_cost.num / r.intrinsic_cost.den,
                data: r.data,
            };
            resolver.cost = this.estimate_cost(resolver);
            resolver.label = this.resolver_label(resolver);
            resolver.title = this.resolver_tooltip(resolver);
            this.nodes.set(resolver.id, resolver);

            this.edges.add({ from: r.id, to: r.effect, resolver: resolver });
            for (const f of resolver.preconditions)
                this.edges.add({ from: f, to: resolver.id, resolver: resolver });
        }

        if (message.current_flaw) {
            this.current_flaw = message.current_flaw;
            if (message.current_resolver)
                this.current_resolver = message.current_resolver;
        }
    }

    flaw_created(message) {
    }

    flaw_state_changed(message) {
    }

    flaw_cost_changed(message) {
    }

    flaw_position_changed(message) {
    }

    current_flaw_changed(message) {
    }

    resolver_created(message) {
    }

    resolver_state_changed(message) {
    }

    current_resolver_changed(message) {
    }

    causal_link_added(message) {
    }

    estimate_cost(res) {
        if (!res.state) return Number.POSITIVE_INFINITY;
        return (res.preconditions.length ? Math.max.apply(this, res.preconditions.map(f_id => this.nodes.get(f_id).cost)) : 0) + res.intrinsic_cost;
    }

    starting(message) {
        console.log('starting');
        for (const t of message.starting)
            console.log(this.atom_content(this.atoms.get(t)));
    }

    start(message) {
        for (const t of message.start)
            this.executing_tasks.add(t);
    }

    ending(message) {
        console.log('ending');
        for (const t of message.ending)
            console.log(this.atom_content(this.atoms.get(t)));
    }

    end(message) {
        for (const t of message.end)
            this.executing_tasks.delete(t);
    }

    executing_changed(message) {
        this.executing_tasks.clear();
        for (const t of message.executing)
            this.executing_tasks.add(t);
    }

    item_title(itm) { return itm.type + '(' + Array.from(itm.exprs.keys()).join(', ') + ')'; }

    item_content(itm) {
        const pars = [];
        for (const [name, val] of itm.exprs)
            pars.push('<br>' + name + ': ' + this.val_to_string(name, val));
        return itm.type + '(' + pars.join(',') + '<br>)';
    }

    atom_title(atm) { return atm.type + '(' + Array.from(atm.exprs.keys()).filter(par => par != 'start' && par != 'end' && par != 'duration' && par != 'tau').join(', ') + ')'; }

    atom_content(atm) {
        const pars = [];
        for (const [name, val] of atm.exprs)
            if (name != 'tau')
                pars.push('<br>' + name + ': ' + this.val_to_string(name, val));
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
                return Array.isArray(val.value) ? '[' + val.value.map(itm => itm.name).sort().join(',') + ']' : val.value.name;
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