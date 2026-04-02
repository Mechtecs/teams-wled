import winston from "winston";

const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

const rootLogger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message, component }) =>
      component ? `${timestamp} ${level} [${component}]: ${message}` : `${timestamp} ${level}: ${message}`,
    ),
  ),
  transports: [new winston.transports.Console()],
});

export function createLogger(component: string) {
  return rootLogger.child({ component });
}
