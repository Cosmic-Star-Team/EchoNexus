import {
  FRAMEWORK_IDS,
  WORKLOAD_IDS,
  type BenchmarkOptions,
  type FrameworkId,
  type WorkloadId,
} from "./types";

const DEFAULT_WORKERS = [1, 4];
const DEFAULT_CONCURRENCY = [50, 200, 500, 1000, 2000, 5000];

type ParsedFlag = {
  name: string;
  value?: string;
  hasValue: boolean;
};

export const DEFAULT_OPTIONS: BenchmarkOptions = {
  frameworks: [...FRAMEWORK_IDS],
  workloads: [...WORKLOAD_IDS],
  workers: [...DEFAULT_WORKERS],
  concurrency: [...DEFAULT_CONCURRENCY],
  buildProfile: "release",
  warmupSeconds: 10,
  measureSeconds: 30,
  cooldownSeconds: 5,
  setupOnly: false,
};

function parseArgs(argv: string[]): ParsedFlag[] {
  const flags: ParsedFlag[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const equalIndex = arg.indexOf("=");
    if (equalIndex !== -1) {
      flags.push({
        name: arg.slice(2, equalIndex),
        value: arg.slice(equalIndex + 1),
        hasValue: true,
      });
      continue;
    }

    const name = arg.slice(2);
    const next = argv[index + 1];

    if (next !== undefined && !next.startsWith("--")) {
      flags.push({ name, value: next, hasValue: true });
      index += 1;
      continue;
    }

    flags.push({ name, hasValue: false });
  }

  return flags;
}

function parseEnumList<T extends string>(
  rawValue: string | undefined,
  allowed: readonly T[],
  flagName: string,
): T[] {
  if (rawValue === undefined) {
    throw new Error(`Missing value for --${flagName}`);
  }

  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error(`Expected at least one value for --${flagName}`);
  }

  for (const value of values) {
    if (!allowed.includes(value as T)) {
      throw new Error(`Invalid value for --${flagName}: ${value}`);
    }
  }

  return values as T[];
}

function parsePositiveIntegerList(rawValue: string | undefined, flagName: string): number[] {
  if (rawValue === undefined) {
    throw new Error(`Missing value for --${flagName}`);
  }

  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid value for --${flagName}: ${value}`);
      }

      return parsed;
    });

  if (values.length === 0) {
    throw new Error(`Expected at least one value for --${flagName}`);
  }

  return values;
}

function parseIntegerWithMinimum(
  rawValue: string | undefined,
  flagName: string,
  minimum: number,
): number {
  if (rawValue === undefined) {
    throw new Error(`Missing value for --${flagName}`);
  }

  if (rawValue?.includes(",")) {
    throw new Error(`Expected a single value for --${flagName}`);
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`Invalid value for --${flagName}: ${rawValue}`);
  }

  return value;
}

export function parseOptions(argv: string[]): BenchmarkOptions {
  const parsedFlags = parseArgs(argv);
  const options: BenchmarkOptions = {
    frameworks: [...DEFAULT_OPTIONS.frameworks],
    workloads: [...DEFAULT_OPTIONS.workloads],
    workers: [...DEFAULT_OPTIONS.workers],
    concurrency: [...DEFAULT_OPTIONS.concurrency],
    buildProfile: DEFAULT_OPTIONS.buildProfile,
    warmupSeconds: DEFAULT_OPTIONS.warmupSeconds,
    measureSeconds: DEFAULT_OPTIONS.measureSeconds,
    cooldownSeconds: DEFAULT_OPTIONS.cooldownSeconds,
    outputTag: DEFAULT_OPTIONS.outputTag,
    setupOnly: DEFAULT_OPTIONS.setupOnly,
  };

  for (const flag of parsedFlags) {
    switch (flag.name) {
      case "frameworks":
        options.frameworks = parseEnumList(
          flag.value,
          FRAMEWORK_IDS,
          flag.name,
        ) as FrameworkId[];
        break;
      case "workloads":
        options.workloads = parseEnumList(flag.value, WORKLOAD_IDS, flag.name) as WorkloadId[];
        break;
      case "workers":
        options.workers = parsePositiveIntegerList(flag.value, flag.name);
        break;
      case "concurrency":
        options.concurrency = parsePositiveIntegerList(flag.value, flag.name);
        break;
      case "release":
        if (flag.hasValue) {
          throw new Error("Option --release does not accept a value");
        }
        if (options.buildProfile === "debug") {
          throw new Error("Options --release and --debug are mutually exclusive");
        }
        options.buildProfile = "release";
        break;
      case "debug":
        if (flag.hasValue) {
          throw new Error("Option --debug does not accept a value");
        }
        if (options.buildProfile === "release" && parsedFlags.some((entry) => entry.name === "release")) {
          throw new Error("Options --release and --debug are mutually exclusive");
        }
        options.buildProfile = "debug";
        break;
      case "warmup":
        options.warmupSeconds = parseIntegerWithMinimum(flag.value, flag.name, 0);
        break;
      case "measure":
        options.measureSeconds = parseIntegerWithMinimum(flag.value, flag.name, 1);
        break;
      case "cooldown":
        options.cooldownSeconds = parseIntegerWithMinimum(flag.value, flag.name, 0);
        break;
      case "output-tag":
        if (flag.value === undefined || flag.value.length === 0) {
          throw new Error("Missing value for --output-tag");
        }
        options.outputTag = flag.value;
        break;
      case "setup":
        if (flag.hasValue) {
          throw new Error("Option --setup does not accept a value");
        }
        options.setupOnly = true;
        break;
      default:
        throw new Error(`Unknown option: --${flag.name}`);
    }
  }

  return options;
}
