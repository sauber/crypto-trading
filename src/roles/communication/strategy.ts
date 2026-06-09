import type { CommunicationStrategy } from "../types.ts";

export const config = { name: "console" };

export class ConsoleComm implements CommunicationStrategy {
  readonly name = "console";

  info(role: string, message: string): void {
    console.log(`[${role}] ${message}`);
  }

  warn(role: string, message: string): void {
    console.warn(`[${role}] ⚠ ${message}`);
  }

  error(role: string, message: string): void {
    console.error(`[${role}] ✗ ${message}`);
  }
}
