import { Inject, Injectable, type LoggerService } from "@nestjs/common";

import { CollabConfigService } from "../config/collab-config.service.js";

export type StructuredLogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "verbose";
export type StructuredLogFields = Record<string, unknown>;
type StructuredLogEntry = {
  timestamp: string;
  service: string;
  level: StructuredLogLevel;
} & StructuredLogFields;

const levelPriority = {
  silent: 0,
  fatal: 1,
  error: 2,
  warn: 3,
  info: 4,
  debug: 5,
  verbose: 6,
} as const;

const ansi = {
  reset: "\u001B[0m",
  dim: "\u001B[2m",
  red: "\u001B[31m",
  yellow: "\u001B[33m",
  green: "\u001B[32m",
  cyan: "\u001B[36m",
  magenta: "\u001B[35m",
  gray: "\u001B[90m",
} as const;

const levelColor: Record<StructuredLogLevel, string> = {
  fatal: ansi.magenta,
  error: ansi.red,
  warn: ansi.yellow,
  info: ansi.green,
  debug: ansi.cyan,
  verbose: ansi.gray,
};

@Injectable()
export class StructuredLoggerService implements LoggerService {
  constructor(@Inject(CollabConfigService) private readonly config: CollabConfigService) {}

  log(message: unknown, ...optionalParams: unknown[]) {
    this.write("info", message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]) {
    this.write("fatal", message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.write("error", message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.write("warn", message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.write("debug", message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.write("verbose", message, optionalParams);
  }

  info(event: string, fields: StructuredLogFields = {}) {
    this.event("info", event, fields);
  }

  warnEvent(event: string, fields: StructuredLogFields = {}) {
    this.event("warn", event, fields);
  }

  errorEvent(event: string, fields: StructuredLogFields = {}) {
    this.event("error", event, fields);
  }

  debugEvent(event: string, fields: StructuredLogFields = {}) {
    this.event("debug", event, fields);
  }

  event(level: StructuredLogLevel, event: string, fields: StructuredLogFields = {}) {
    this.write(level, {
      event,
      ...fields,
    });
  }

  private write(level: StructuredLogLevel, message: unknown, optionalParams: unknown[] = []) {
    if (!this.shouldWrite(level)) {
      return;
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      service: "sketchblock-collab-server",
      level,
      ...this.normalizeMessage(message, optionalParams),
    };

    const stream = level === "fatal" || level === "error" || level === "warn" ? process.stderr : process.stdout;
    const output = `${this.formatEntry(entry, Boolean(stream.isTTY))}\n`;
    if (level === "fatal" || level === "error" || level === "warn") {
      process.stderr.write(output);
      return;
    }

    process.stdout.write(output);
  }

  private formatEntry(entry: StructuredLogEntry, isTty: boolean) {
    if (!this.shouldUsePrettyFormat(isTty)) {
      return JSON.stringify(entry);
    }

    const { timestamp, level, event, message, context, service, ...fields } = entry;
    const levelLabel = this.color(level.toUpperCase().padEnd(7), levelColor[level]);
    const timeLabel = this.color(timestamp, ansi.dim);
    const serviceLabel = this.color(service, ansi.gray);
    const eventLabel =
      typeof event === "string" && event.length > 0
        ? this.color(event, ansi.cyan)
        : this.color(String(message ?? "log"), ansi.cyan);
    const contextLabel = typeof context === "string" ? ` ${this.color(`[${context}]`, ansi.gray)}` : "";
    const details = Object.keys(fields).length > 0 ? ` ${this.color(JSON.stringify(fields), ansi.gray)}` : "";

    return `${timeLabel} ${levelLabel} ${serviceLabel} ${eventLabel}${contextLabel}${details}`;
  }

  private shouldUsePrettyFormat(isTty: boolean) {
    if (this.config.logFormat === "json") {
      return false;
    }

    if (this.config.logFormat === "pretty") {
      return true;
    }

    return isTty && !process.env.NO_COLOR;
  }

  private color(value: string, colorCode: string) {
    return `${colorCode}${value}${ansi.reset}`;
  }

  private shouldWrite(level: StructuredLogLevel) {
    return levelPriority[level] <= levelPriority[this.config.logLevel];
  }

  private normalizeMessage(message: unknown, optionalParams: unknown[]) {
    if (typeof message === "object" && message !== null && !Array.isArray(message)) {
      return this.redact(message as StructuredLogFields);
    }

    const [context] = optionalParams;
    return this.redact({
      message: String(message),
      context: typeof context === "string" ? context : undefined,
    });
  }

  private redact(fields: StructuredLogFields): StructuredLogFields {
    return Object.fromEntries(
      Object.entries(fields).map(([key, value]) => {
        if (this.isSensitiveKey(key)) {
          return [key, "[redacted]"];
        }

        if (value instanceof Error) {
          return [
            key,
            {
              name: value.name,
              message: value.message,
            },
          ];
        }

        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          return [key, this.redact(value as StructuredLogFields)];
        }

        return [key, value];
      }),
    );
  }

  private isSensitiveKey(key: string) {
    const normalized = key.toLowerCase();
    return (
      normalized.includes("token") ||
      normalized.includes("secret") ||
      normalized.includes("authorization") ||
      normalized.includes("cookie") ||
      normalized.includes("payload") ||
      normalized.includes("content") ||
      normalized.includes("yjsstatebase64") ||
      normalized.includes("updatebase64")
    );
  }
}
