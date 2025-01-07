export namespace solver {

  class env implements item_listener {

    private items: Map<number, item> = new Map();
    private item_listeners: Set<item_listener> = new Set();

    item_added(item: item): void {
      this.items.set(item.get_id(), item);
      for (const listener of this.item_listeners) listener.item_added(item);
    }
    item_removed(item: item): void {
      this.items.delete(item.get_id());
      for (const listener of this.item_listeners) listener.item_removed(item);
    }

    add_item_listener(listener: item_listener) { this.item_listeners.add(listener); }
    remove_item_listener(listener: item_listener) { this.item_listeners.delete(listener); }
  }

  export class item extends env {

    private id: number;

    constructor(id: number) {
      super();
      this.id = id;
    }

    get_id(): number { return this.id; }
  }

  export class solver extends env implements solver_listener {

    private solver_listeners: Set<solver_listener> = new Set();
    private flaws: Map<number, flaw> = new Map();
    private resolvers: Map<number, resolver> = new Map();
    private c_flaw: flaw | null = null;
    private c_resolver: resolver | null = null;

    init(flaws: Map<number, flaw>, resolvers: Map<number, resolver>, c_flaw: flaw | null, c_resolver: resolver | null): void {
      this.flaws = flaws;
      this.resolvers = resolvers;
      this.c_flaw = c_flaw;
      this.c_resolver = c_resolver;
      for (const listener of this.solver_listeners) listener.init(flaws, resolvers, c_flaw, c_resolver);
    }
    flaw_created(flaw: flaw): void {
      this.flaws.set(flaw.get_id(), flaw);
      for (const listener of this.solver_listeners) listener.flaw_created(flaw);
    }
    flaw_cost_changed(flaw: flaw): void {
      this.flaws.set(flaw.get_id(), flaw);
      for (const listener of this.solver_listeners) listener.flaw_cost_changed(flaw);
    }
    current_flaw(flaw: flaw): void {
      this.c_flaw = flaw;
      if (this.c_resolver)
        this.current_resolver(null);
      for (const listener of this.solver_listeners) listener.current_flaw(flaw);
    }
    resolver_created(resolver: resolver): void {
      this.resolvers.set(resolver.get_id(), resolver);
      for (const listener of this.solver_listeners) listener.resolver_created(resolver);
    }
    current_resolver(resolver: resolver): void {
      this.c_resolver = resolver;
      for (const listener of this.solver_listeners) listener.current_resolver(resolver);
    }

    add_solver_listener(listener: solver_listener) {
      this.solver_listeners.add(listener);
      listener.init(this.flaws, this.resolvers, this.c_flaw, this.c_resolver);
    }
    remove_solver_listener(listener: solver_listener) { this.solver_listeners.delete(listener); }
  }

  export class flaw {

    private id: number;
    private cost: number = 0;

    constructor(id: number) {
      this.id = id;
    }

    get_id(): number { return this.id; }
    get_cost(): number { return this.cost; }
  }

  export class resolver {

    private id: number;

    constructor(id: number) {
      this.id = id;
    }

    get_id(): number { return this.id; }
  }

  export interface item_listener {

    item_added(item: item): void;
    item_removed(item: item): void;
  }

  export interface solver_listener {

    init(flaws: Map<number, flaw>, resolvers: Map<number, resolver>, c_flaw: flaw | null, c_resolver: resolver | null): void;

    flaw_created(flaw: flaw): void;
    flaw_cost_changed(flaw: flaw): void;
    current_flaw(flaw: flaw): void;

    resolver_created(resolver: resolver): void;
    current_resolver(resolver: resolver): void;
  }
}