export interface ParamSpec {
  key: string;
  lo: number;
  hi: number;
  int: boolean;
}

export interface RoleEntry<T> {
  name: string;
  create: (...args: unknown[]) => T;
  fromParams?: (params: number[]) => T;
  paramSpecs?: ParamSpec[];
}

export class RoleRegistry<T> {
  private entries = new Map<string, RoleEntry<T>>();

  register(
    name: string,
    create: (...args: unknown[]) => T,
    fromParams?: (params: number[]) => T,
    paramSpecs?: ParamSpec[],
  ): void {
    this.entries.set(name, { name, create, fromParams, paramSpecs });
  }

  get(name: string): RoleEntry<T> {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`Unknown strategy "${name}". Available: ${[...this.entries.keys()].join(", ")}`);
    return entry;
  }

  list(): string[] {
    return [...this.entries.keys()];
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }
}
