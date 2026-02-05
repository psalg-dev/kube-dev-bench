/**
 * Logger utility for production-safe logging.
 * In development, logs are output to console.
 * In production, logs are suppressed to avoid console noise.
 */

const isDev = import.meta.env?.DEV ?? false;

type LogMethod = (...args: unknown[]) => void;
type Logger = {
  log: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  debug: LogMethod;
  trace: LogMethod;
  table: LogMethod;
  group: LogMethod;
  groupEnd: () => void;
  groupCollapsed: LogMethod;
  time: (label?: string) => void;
  timeEnd: (label?: string) => void;
};

/**
 * Logger object with methods matching console API.
 * Logs are only output in development mode.
 */
export const logger: Logger = {
  /**
   * Log a message (equivalent to console.log)
   * @param  {...any} args - Arguments to log
   */
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log an info message (equivalent to console.info)
   * @param  {...any} args - Arguments to log
   */
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Log a warning message (equivalent to console.warn)
   * @param  {...any} args - Arguments to log
   */
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log an error message (equivalent to console.error)
   * In production, errors are still logged for debugging critical issues.
   * @param  {...any} args - Arguments to log
   */
  error: (...args: unknown[]) => {
    // Always log errors, even in production
    console.error(...args);
  },

  /**
   * Log a debug message (equivalent to console.debug)
   * @param  {...any} args - Arguments to log
   */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /**
   * Log a trace message (equivalent to console.trace)
   * @param  {...any} args - Arguments to log
   */
  trace: (...args: unknown[]) => {
    if (isDev) {
      console.trace(...args);
    }
  },

  /**
   * Log a table (equivalent to console.table)
   * @param  {...any} args - Arguments to log
   */
  table: (...args: unknown[]) => {
    if (isDev) {
      console.table(...args);
    }
  },

  /**
   * Start a timer group (equivalent to console.group)
   * @param  {...any} args - Arguments to log
   */
  group: (...args: unknown[]) => {
    if (isDev) {
      console.group(...args);
    }
  },

  /**
   * End a timer group (equivalent to console.groupEnd)
   */
  groupEnd: () => {
    if (isDev) {
      console.groupEnd();
    }
  },

  /**
   * Start a collapsed group (equivalent to console.groupCollapsed)
   * @param  {...any} args - Arguments to log
   */
  groupCollapsed: (...args: unknown[]) => {
    if (isDev) {
      console.groupCollapsed(...args);
    }
  },

  /**
   * Start a timer (equivalent to console.time)
   * @param {string} label - Timer label
   */
  time: (label?: string) => {
    if (isDev) {
      console.time(label ?? 'default');
    }
  },

  /**
   * End a timer (equivalent to console.timeEnd)
   * @param {string} label - Timer label
   */
  timeEnd: (label?: string) => {
    if (isDev) {
      console.timeEnd(label ?? 'default');
    }
  },
};

export default logger;
