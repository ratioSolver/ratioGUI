function flaw_label(flaw) {
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

function flaw_tooltip(flaw) {
    switch (flaw.phi) {
        case 'b0':
        case '\u00ACb0':
            return 'cost: ' + flaw.cost + ', pos: ' + flaw.pos.lb;
        default:
            return flaw.phi.replace('b', '\u03C6') + ', cost: ' + flaw.cost + ', pos: ' + flaw.pos.lb;
    }
}

function resolver_label(resolver) {
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

function resolver_tooltip(resolver) {
    switch (resolver.rho) {
        case 'b0':
        case '\u00ACb0':
            return 'cost: ' + resolver.cost;
        default:
            return resolver.rho.replace('b', '\u03C1') + ', cost: ' + resolver.cost;
    }
}