import pc from "picocolors";

export interface GlobalOpts {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

let globalOpts: GlobalOpts = {};

export function setGlobalOpts(opts: GlobalOpts) {
  globalOpts = opts;
}

export function getOpts(): GlobalOpts {
  return globalOpts;
}

export function printJson(value: unknown) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

export function printHuman(text: string) {
  if (!globalOpts.quiet) process.stdout.write(text + "\n");
}

/**
 * Default success output: human-friendly to stdout, JSON when --json.
 */
export function output(value: unknown, humanFallback?: (v: unknown) => string) {
  if (globalOpts.json) {
    printJson(value);
    return;
  }
  if (humanFallback) {
    printHuman(humanFallback(value));
    return;
  }
  printHuman(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

export function err(msg: string, exitCode = 1): never {
  if (globalOpts.json) {
    process.stdout.write(JSON.stringify({ error: msg }) + "\n");
  } else {
    process.stderr.write(pc.red(`✗ ${msg}\n`));
  }
  process.exit(exitCode);
}

export function success(msg: string) {
  if (!globalOpts.json && !globalOpts.quiet) {
    process.stderr.write(pc.green(`✓ ${msg}\n`));
  }
}

export function info(msg: string) {
  if (!globalOpts.json && !globalOpts.quiet) {
    process.stderr.write(pc.dim(`${msg}\n`));
  }
}

export const colors = pc;
