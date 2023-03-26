export class Solver {

    constructor(id = 'default') {
        this.id = id;

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
}