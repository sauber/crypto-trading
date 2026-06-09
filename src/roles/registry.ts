export interface RoleEntry<T> {
  name: string;
  create(): T;
  createFromParams(params: number[]): T;
  optimizableParams: ParamSpec[];
}

export interface ParamSpec {
  key: string;
  lo: number;
  hi: number;
  int: boolean;
}

export class RoleRegistry<T> {
  private entries = new Map<string, RoleEntry<T>>();

  register(
    name: string,
    factory: () => T,
    fromParams: (params: number[]) => T,
    paramSpecs: ParamSpec[],
  ): void {
    this.entries.set(name, { name, create: factory, createFromParams: fromParams, optimizableParams: paramSpecs });
  }

  get(name: string): RoleEntry<T> {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`Ukendt "${name}". Mulige: ${[...this.entries.keys()].join("|")}`);
    return entry;
  }

  list(): string[] {
    return [...this.entries.keys()];
  }
}
