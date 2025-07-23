enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

function log(level: LogLevel, message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`, ...args);
}

export const logger = {
  info: (message: string, ...args: any[]) =>
    log(LogLevel.INFO, message, ...args),
  warn: (message: string, ...args: any[]) =>
    log(LogLevel.WARN, message, ...args),
  error: (message: string, ...args: any[]) =>
    log(LogLevel.ERROR, message, ...args),
  debug: (message: string, ...args: any[]) =>
    log(LogLevel.DEBUG, message, ...args),
};
