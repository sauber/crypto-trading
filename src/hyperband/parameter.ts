import type { DecimalParamSpec, EnumParamSpec, ParamSpec } from "./types.ts";

/** Abstract base for all parameter types */
export abstract class Parameter {
  abstract readonly key: string;

  /** Generate a uniform-random valid value */
  abstract random(): number;

  /** Clamp and round a raw value to the nearest valid value */
  abstract round(value: number): number;

  /** Convert a raw numeric value to its config representation */
  abstract toValue(value: number): number | string;

  /** Pretty-print a value */
  abstract format(value: string | number): string;

  /** Serialize to a ParamSpec for transport or storage */
  abstract toSpec(): ParamSpec;

  /** Construct a concrete Parameter from a ParamSpec */
  static fromSpec(spec: ParamSpec): Parameter {
    switch (spec.type) {
      case "decimal":
        return new DecimalParameter(spec.key, spec.lo, spec.hi, spec.precision);
      case "enum":
        return new EnumParameter(spec.key, spec.values);
    }
  }
}

/** Numeric parameter rounded to a fixed number of decimal places */
export class DecimalParameter extends Parameter {
  override readonly key: string;
  readonly lo: number;
  readonly hi: number;
  readonly precision: number;

  constructor(key: string, lo: number, hi: number, precision: number) {
    super();
    if (precision < 0) throw new Error("precision must be >= 0");
    if (lo >= hi) throw new Error("lo must be < hi");
    this.key = key;
    this.lo = lo;
    this.hi = hi;
    this.precision = precision;
  }

  /** Uniform random within [lo, hi], then rounded */
  override random(): number {
    const v = this.lo + Math.random() * (this.hi - this.lo);
    return this.round(v);
  }

  /** Clamp to [lo, hi] and round to precision */
  override round(value: number): number {
    const clamped = Math.max(this.lo, Math.min(this.hi, value));
    const factor = Math.pow(10, this.precision);
    return Math.round(clamped * factor) / factor;
  }

  /** Return the rounded numeric value for config output */
  override toValue(value: number): number {
    return this.round(value);
  }

  /** Format as key=value with fixed decimal places */
  override format(value: string | number): string {
    const n = typeof value === "string" ? parseFloat(value) : value;
    return `${this.key}=${this.round(n).toFixed(this.precision)}`;
  }

  /** Serialize to DecimalParamSpec */
  override toSpec(): DecimalParamSpec {
    return { key: this.key, type: "decimal", lo: this.lo, hi: this.hi, precision: this.precision };
  }
}

/** Categorical parameter selecting from a fixed set of string values */
export class EnumParameter extends Parameter {
  override readonly key: string;
  readonly values: string[];

  constructor(key: string, values: string[]) {
    super();
    if (values.length < 2) throw new Error("enum must have at least 2 values");
    this.key = key;
    this.values = values;
  }

  /** Uniform random index into the values array */
  override random(): number {
    return Math.floor(Math.random() * this.values.length);
  }

  /** Clamp to valid index range */
  override round(value: number): number {
    return Math.max(0, Math.min(this.values.length - 1, Math.round(value)));
  }

  /** Return the string value at the rounded index */
  override toValue(value: number): string {
    return this.values[this.round(value)];
  }

  /** Format as key=selectedValue */
  override format(value: string | number): string {
    const idx = typeof value === "string" ? this.values.indexOf(value) : this.round(value);
    const label = idx >= 0 ? this.values[idx] : value.toString();
    return `${this.key}=${label}`;
  }

  /** Serialize to EnumParamSpec */
  override toSpec(): EnumParamSpec {
    return { key: this.key, type: "enum", values: [...this.values] };
  }
}
