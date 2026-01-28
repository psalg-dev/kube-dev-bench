/* eslint-disable no-console */
/**
 * Logger utility for production-safe logging.
 * In development, logs are output to console.
 * In production, logs are suppressed to avoid console noise.
 */

const isDev = Boolean(import.meta?.env?.DEV);

/**
 * Logger object with methods matching console API.
 * Logs are only output in development mode.
 */
export const logger = {
  /**
   * Log a message (equivalent to console.log)
   * @param  {...any} args - Arguments to log
   */
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log an info message (equivalent to console.info)
   * @param  {...any} args - Arguments to log
   */
  info: (...args) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Log a warning message (equivalent to console.warn)
   * @param  {...any} args - Arguments to log
   */
  warn: (...args) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log an error message (equivalent to console.error)
   * In production, errors are still logged for debugging critical issues.
   * @param  {...any} args - Arguments to log
   */
  error: (...args) => {
    // Always log errors, even in production
    console.error(...args);
  },

  /**
   * Log a debug message (equivalent to console.debug)
   * @param  {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /**
   * Log a trace message (equivalent to console.trace)
   * @param  {...any} args - Arguments to log
   */
  trace: (...args) => {
    if (isDev) {
      console.trace(...args);
    }
  },

  /**
   * Log a table (equivalent to console.table)
   * @param  {...any} args - Arguments to log
   */
  table: (...args) => {
    if (isDev) {
      console.table(...args);
    }
  },

  /**
   * Start a timer group (equivalent to console.group)
   * @param  {...any} args - Arguments to log
   */
  group: (...args) => {
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
  groupCollapsed: (...args) => {
    if (isDev) {
      console.groupCollapsed(...args);
    }
  },

  /**
   * Start a timer (equivalent to console.time)
   * @param {string} label - Timer label
   */
  time: (label) => {
    if (isDev) {
      console.time(label);
    }
  },

  /**
   * End a timer (equivalent to console.timeEnd)
   * @param {string} label - Timer label
   */
  timeEnd: (label) => {
    if (isDev) {
      console.timeEnd(label);
    }
  },
};

export default logger;
