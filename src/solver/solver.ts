export namespace solver {

  class Env implements EnvListener {

    protected items: Map<string, values.Value> = new Map();
    private env_listeners: Set<EnvListener> = new Set();

    value_added(name: string, value: values.Value): void {
      this.items.set(name, value);
      for (const listener of this.env_listeners) listener.value_added(name, value);
    }
    value_removed(name: string): void {
      this.items.delete(name);
      for (const listener of this.env_listeners) listener.value_removed(name);
    }

    add_item_listener(listener: EnvListener) { this.env_listeners.add(listener); }
    remove_item_listener(listener: EnvListener) { this.env_listeners.delete(listener); }

    to_string(items: Map<number, values.Value>, expressive: boolean): string {
      const pars = Array.from(this.items.entries()).filter(([name, _]) => name !== 'start' && name !== 'end' && name !== 'duration' && name !== 'tau').map(([name, value]) => `${name}: ${value.to_string(items, expressive)}`);
      return `{${pars.join(', ')}}`;
    }
  }

  export interface EnvListener {

    value_added(name: string, value: values.Value): void;
    value_removed(name: string): void;
  }

  export enum SolverState {
    reasoning,
    idle,
    adapting,
    executing,
    finished,
    failed
  }

  export class Solver extends Env implements SolverListener {

    private id: number;
    private name: string;
    private state: SolverState;

    private atoms: Map<number, values.Atom> = new Map();
    private flaws: Map<number, graph.Flaw> = new Map();
    private resolvers: Map<number, graph.Resolver> = new Map();
    private c_flaw: graph.Flaw | null = null;
    private c_resolver: graph.Resolver | null = null;
    private solver_listeners: Set<SolverListener> = new Set();

    constructor(id: number, name: string, state: SolverState) {
      super();
      this.id = id;
      this.name = name;
      this.state = state;
    }

    get_id(): number { return this.id; }
    get_name(): string { return this.name; }
    get_state(): SolverState { return this.state; }

    init(items: Map<string, values.Value>, atoms: Map<number, values.Atom>, state: SolverState, flaws: Map<number, graph.Flaw>, resolvers: Map<number, graph.Resolver>, c_flaw: graph.Flaw | null, c_resolver: graph.Resolver | null): void {
      this.items = items;
      this.atoms = atoms;
      this.state = state;
      this.flaws = flaws;
      this.resolvers = resolvers;
      this.c_flaw = c_flaw;
      this.c_resolver = c_resolver;
    }
    state_changed(state: SolverState): void {
      this.state = state;
      for (const listener of this.solver_listeners) listener.state_changed(state);
    }
    flaw_created(flaw: graph.Flaw): void {
      this.flaws.set(flaw.get_id(), flaw);
      for (const listener of this.solver_listeners) listener.flaw_created(flaw);
    }
    flaw_cost_changed(flaw: graph.Flaw): void {
      this.flaws.set(flaw.get_id(), flaw);
      for (const listener of this.solver_listeners) listener.flaw_cost_changed(flaw);
    }
    current_flaw(flaw: graph.Flaw | null): void {
      this.c_flaw = flaw;
      if (this.c_resolver)
        this.current_resolver(null);
      for (const listener of this.solver_listeners) listener.current_flaw(flaw);
    }
    resolver_created(resolver: graph.Resolver): void {
      this.resolvers.set(resolver.get_id(), resolver);
      for (const listener of this.solver_listeners) listener.resolver_created(resolver);
    }
    current_resolver(resolver: graph.Resolver | null): void {
      this.c_resolver = resolver;
      for (const listener of this.solver_listeners) listener.current_resolver(resolver);
    }

    add_solver_listener(listener: SolverListener) {
      this.solver_listeners.add(listener);
      listener.init(this.items, this.atoms, this.state, this.flaws, this.resolvers, this.c_flaw, this.c_resolver);
    }
    remove_solver_listener(listener: SolverListener) { this.solver_listeners.delete(listener); }
  }

  export interface SolverListener {

    init(items: Map<string, values.Value>, atoms: Map<number, values.Atom>, state: SolverState, flaws: Map<number, graph.Flaw>, resolvers: Map<number, graph.Resolver>, c_flaw: graph.Flaw | null, c_resolver: graph.Resolver | null): void;

    state_changed(state: SolverState): void;

    flaw_created(flaw: graph.Flaw): void;
    flaw_cost_changed(flaw: graph.Flaw): void;
    current_flaw(flaw: graph.Flaw | null): void;

    resolver_created(resolver: graph.Resolver): void;
    current_resolver(resolver: graph.Resolver | null): void;
  }

  export class SolverSet implements SolverSetListener {

    private solvers: Map<number, solver.Solver> = new Map();
    private solver_set_listeners: Set<SolverSetListener> = new Set();

    init(solvers: Map<number, Solver>): void {
      this.solvers = solvers;
    }

    solver_created(solver: Solver): void {
      this.solvers.set(solver.get_id(), solver);
      for (const listener of this.solver_set_listeners) { listener.solver_created(solver); }
    }

    solver_deleted(id: number): void {
      this.solvers.delete(id);
      for (const listener of this.solver_set_listeners) { listener.solver_deleted(id); }
    }
  }

  export interface SolverSetListener {

    init(solvers: Map<number, Solver>): void;

    solver_created(solver: Solver): void;

    solver_deleted(id: number): void;
  }

  export namespace graph {
    /**
     * Represents the state of a flaw or resolver in the CoCo framework.
     */
    export enum State {
      active,
      inactive,
      forbidden
    }

    interface FlawData {

      type: string;
      atom?: {
        sigma: number;
        type: string;
        is_fact: boolean;
      };
    }

    export class Flaw {

      private id: number;
      private phi: string;
      private causes: Resolver[];
      private state: State;
      private cost: number;
      private data: FlawData;

      constructor(id: number, phi: string, causes: Resolver[], state: State, cost: number, data: FlawData) {
        this.id = id;
        this.phi = phi;
        this.causes = causes;
        this.state = state;
        this.cost = cost;
        this.data = data;
      }

      get_id(): number { return this.id; }
      get_phi(): string { return this.phi; }
      get_causes(): Resolver[] { return this.causes; }
      get_state(): State { return this.state; }
      get_cost(): number { return this.cost; }
    }

    interface ResolverData {

      type: string;
      name?: string;
      value?: any;
    }

    export class Resolver {

      private id: number;
      private rho: string;
      private preconditions: Flaw[];
      private flaw: Flaw;
      private state: State;
      private intrinsic_cost: number;
      private data: ResolverData;

      constructor(id: number, rho: string, preconditions: Flaw[], flaw: Flaw, state: State, intrinsic_cost: number, data: ResolverData) {
        this.id = id;
        this.rho = rho;
        this.preconditions = preconditions;
        this.flaw = flaw;
        this.state = state;
        this.intrinsic_cost = intrinsic_cost;
        this.data = data;
      }

      get_id(): number { return this.id; }
      get_rho(): string { return this.rho; }
      get_preconditions(): Flaw[] { return this.preconditions; }
      get_flaw(): Flaw { return this.flaw; }
      get_state(): State { return this.state; }
      get_intrinsic_cost(): number { return this.intrinsic_cost; }

      get_cost(): number {
        if (this.state == State.forbidden)
          return Infinity;
        return (this.preconditions.length ? Math.max.apply(null, this.preconditions.map(flaw => flaw.get_cost())) : 0) + this.intrinsic_cost;
      }
    }
  }

  export namespace values {

    export class Rational {

      private num: number;
      private den: number;

      constructor(num: number, den: number) {
        this.num = num;
        this.den = den;
      }

      to_number(): number { return this.num / this.den; }

      to_string(): string {
        switch (this.den) {
          case 1:
            return this.num.toString();
          case 0:
            return this.num > 0 ? '+∞' : '-∞';
          default:
            return `${this.num}/${this.den}`;
        }
      }

      static make_rational(val: any): Rational { return new Rational(val.num, val.den); }
    }

    export class InfRational extends Rational {

      private inf: Rational;

      constructor(num: number, den: number, inf: Rational = new Rational(0, 1)) {
        super(num, den);
        this.inf = inf;
      }

      static make_inf_rational(val: any): InfRational { return new InfRational(val.num, val.den, val.inf ? Rational.make_rational(val.inf) : new Rational(0, 1)); }
    }

    export interface Value {

      to_string(items: Map<number, Value>, expressive: boolean): string;
    }

    export enum LBool {

      True,
      False,
      Undefined
    }

    export class Bool implements Value {

      lit: string;
      val: LBool;

      constructor(lit: string, val: LBool) {
        this.lit = lit;
        this.val = val;
      }

      to_string(_: Map<number, Value>, expressive = false): string {
        switch (this.val) {
          case LBool.True:
            return expressive ? 'true' : '⊤';
          case LBool.False:
            return expressive ? 'false' : '⊥';
          default:
            return expressive ? 'undefined' : 'U';
        }
      }
    }

    export class Int implements Value {

      lin: string;
      val: number;
      lb?: number;
      ub?: number;

      constructor(lin: string, val: number, lb?: number, ub?: number) {
        this.lin = lin;
        this.val = val;
        this.lb = lb;
        this.ub = ub;
      }

      to_string(_: Map<number, Value>, expressive = false): string {
        if (expressive) {
          let res = `${this.val}`;
          if (this.lb || this.ub)
            res += `[${this.lb ?? '-∞'}, ${this.ub ?? '+∞'}]`;
          return res + `(${this.lin})`;
        } else
          return this.val.toString();
      }
    }

    export class Real implements Value {

      lin: string;
      val: InfRational;
      lb?: InfRational;
      ub?: InfRational;

      constructor(lin: string, val: InfRational, lb?: InfRational, ub?: InfRational) {
        this.lin = lin;
        this.val = val;
        this.lb = lb;
        this.ub = ub;
      }

      to_string(_: Map<number, Value>, expressive = false): string {
        if (expressive) {
          let res = `${this.val.to_string()}`;
          if (this.lb || this.ub)
            res += `[${this.lb?.to_string() ?? '-∞'}, ${this.ub?.to_string() ?? '+∞'}]`;
          return res + `(${this.lin})`;
        } else
          return this.val.to_string();
      }
    }

    export class Time implements Value {

      lin: string;
      val: InfRational;
      lb?: InfRational;
      ub?: InfRational;

      constructor(lin: string, val: InfRational, lb?: InfRational, ub?: InfRational) {
        this.lin = lin;
        this.val = val;
        this.lb = lb;
        this.ub = ub;
      }

      to_string(_: Map<number, Value>, expressive = false): string {
        if (expressive) {
          let res = `${this.val.to_string()}`;
          if (this.lb || this.ub)
            res += `[${this.lb?.to_string() ?? '-∞'}, ${this.ub?.to_string() ?? '+∞'}]`;
          return res + `(${this.lin})`;
        } else
          return this.val.to_string();
      }
    }

    export class String implements Value {

      val: string;

      constructor(val: string) {
        this.val = val;
      }

      to_string(items: Map<number, Value>, expressive = false): string {
        const num = Number(this.val);
        if (typeof num === "number" && !isNaN(num) && items.has(num))
          return items.get(num)!.to_string(items, expressive);
        else
          return `'${this.val}'`;
      }
    }

    export class Enum implements Value {

      v: string;
      vals: Item[];

      constructor(v: string, vals: Item[]) {
        this.v = v;
        this.vals = vals;
      }

      to_string(items: Map<number, Value>, expressive = false): string {
        if (expressive)
          return (this.vals.length == 1 ? this.vals[0].to_string(items, expressive) : `{${this.vals.map((item: Item) => item.to_string(items, expressive)).join(', ')}}`) + ` (${this.v})`;
        else
          return this.vals.length == 1 ? this.vals[0].to_string(items, expressive) : `{${this.vals.map((item: Item) => item.to_string(items, expressive)).join(', ')}}`;
      }
    }

    export class Item extends Env implements Value {

      private id: number;
      private type: string;
      private name: string;

      constructor(id: number, type: string, name: string) {
        super();
        this.id = id;
        this.type = type;
        this.name = name;
      }

      to_string(items: Map<number, Value>, expressive = false): string {
        return expressive ? this.name + ' ' + super.to_string(items, expressive) : this.name;
      }
    }

    export enum AtomState {
      Active,
      Inactive,
      Unified
    }

    export class Atom extends Item implements Value {

      private is_fact: boolean;
      private sigma: string;
      private state: AtomState;

      constructor(id: number, type: string, name: string, is_fact: boolean, sigma: string, state: AtomState) {
        super(id, type, name);
        this.is_fact = is_fact;
        this.sigma = sigma;
        this.state = state;
      }
    }

    export function make_value(value: any, items: Map<number, Value>): Value {
      switch (value.type) {
        case 'bool':
          return new Bool(value.lit, LBool[value.val as keyof typeof LBool]);
        case 'int':
          return new Int(value.lin, value.val, value.lb, value.ub);
        case 'real':
          return new Real(value.lin, InfRational.make_inf_rational(value.val), value.lb ? InfRational.make_inf_rational(value.lb) : undefined, value.ub ? InfRational.make_inf_rational(value.ub) : undefined);
        case 'time':
          return new Time(value.lin, InfRational.make_inf_rational(value.val), value.lb ? InfRational.make_inf_rational(value.lb) : undefined, value.ub ? InfRational.make_inf_rational(value.ub) : undefined);
        case 'string':
          return new String(value.val);
        case 'enum':
          return new Enum(value.v, value.vals.map((item: any) => items.get(item)));
        case 'item':
          return items.get(value.id)!;
        case 'atom':
          return items.get(value.id)!;
        default:
          throw new Error(`Unknown type: ${value.type}`);
      }
    }
  }

  export namespace timelines {

    type Impulse = { at: values.InfRational };
    type Interval = { from: values.InfRational, to: values.InfRational };
    export type TimelineValue = Impulse | Interval;
  }
}