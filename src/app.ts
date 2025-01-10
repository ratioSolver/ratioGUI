export class App implements AppListener {

  private static instance: App;
  private selected_comp: Component<any, HTMLElement> | null = null;
  private app_listeners: Set<AppListener> = new Set();

  private constructor() { }

  static get_instance() {
    if (!App.instance)
      App.instance = new App();
    return App.instance;
  }

  get_selected_component(): Component<any, HTMLElement> | null { return this.selected_comp; }

  selected_component(component: Component<any, HTMLElement> | null): void {
    this.selected_comp = component;
    for (const listener of this.app_listeners) { listener.selected_component(component); }
  }

  add_app_listener(listener: AppListener): void {
    this.app_listeners.add(listener);
  }

  remove_app_listener(listener: AppListener): void {
    this.app_listeners.delete(listener);
  }
}

export interface AppListener {

  selected_component(component: Component<any, HTMLElement> | null): void;
}

export abstract class Component<P, E extends HTMLElement> {

  payload: P; // The payload of the component
  element: E; // The element of the component

  constructor(payload: P, element: E) {
    this.payload = payload;
    this.element = element;
  }

  remove(): void {
    this.unmounting();
    this.element.remove();
  }

  unmounting(): void { }
}

export abstract class ListComponent<P, E extends HTMLElement, L extends HTMLElement> extends Component<Component<P, E>[], L> {

  compareFn: (a: P, b: P) => number; // The comparison function
  children: Component<P, E>[] = []; // The children of the list component sorted by the comparison function

  constructor(payload: Component<P, E>[], element: L, compareFn?: (a: P, b: P) => number) {
    super(payload, element)
    this.compareFn = compareFn || ((a, b) => 0);
    this.children = payload;
    this.children.sort((a, b) => this.compareFn(a.payload, b.payload));
    const fragment = document.createDocumentFragment();
    for (const child of this.children)
      fragment.appendChild(child.element);
    this.element.appendChild(fragment);
  }

  add_child(child: Component<P, E>): void {
    this.children.push(child);
    this.children.sort((a, b) => this.compareFn(a.payload, b.payload));
    const index = this.children.indexOf(child);
    if (index === this.children.length - 1)
      this.element.appendChild(child.element);
    else
      this.element.insertBefore(child.element, this.children[index + 1].element);
  }

  remove_child(child: Component<P, E>): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.remove();
    } else
      throw new Error('Child not found');
  }

  remove(): void {
    for (const child of this.children)
      child.remove();
    super.remove();
  }
}

export class AppComponent extends Component<App, HTMLDivElement> {

  private constructor() {
    super(App.get_instance(), document.querySelector('#app') as HTMLDivElement);
    this.element.classList.add('d-flex', 'flex-column', 'h-100');
  }
}

export class AnchorComponent<P> extends Component<P, HTMLAnchorElement> {

  constructor(payload: P) { super(payload, document.createElement('a')); }
}

export class UListComponent<P> extends ListComponent<P, HTMLLIElement, HTMLUListElement> {

  constructor(payload: Component<P, HTMLLIElement>[], compareFn?: (a: P, b: P) => number) {
    super(payload, document.createElement('ul'), compareFn);
  }
}