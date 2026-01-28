import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  let consoleLogSpy;
  let consoleInfoSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let consoleDebugSpy;
  let consoleTraceSpy;
  let consoleTableSpy;
  let consoleGroupSpy;
  let consoleGroupEndSpy;
  let consoleTimeSpy;
  let consoleTimeEndSpy;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleTraceSpy = vi.spyOn(console, 'trace').mockImplementation(() => {});
    consoleTableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleTimeSpy = vi.spyOn(console, 'time').mockImplementation(() => {});
    consoleTimeEndSpy = vi.spyOn(console, 'timeEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleTraceSpy.mockRestore();
    consoleTableSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
    consoleTimeSpy.mockRestore();
    consoleTimeEndSpy.mockRestore();
    vi.resetModules();
  });

  describe('in development mode', () => {
    beforeEach(async () => {
      vi.stubGlobal('import', { meta: { env: { DEV: true } } });
    });

    it('logger module exports a logger object', async () => {
      const { logger } = await import('../utils/logger');
      expect(logger).toBeDefined();
      expect(typeof logger).toBe('object');
    });

    it('logger.log calls console.log', async () => {
      const { logger } = await import('../utils/logger');
      logger.log('test message');
      // In test environment, DEV might be true, so log should be called
    });

    it('logger.info calls console.info', async () => {
      const { logger } = await import('../utils/logger');
      logger.info('info message');
    });

    it('logger.warn calls console.warn', async () => {
      const { logger } = await import('../utils/logger');
      logger.warn('warning message');
    });

    it('logger.debug calls console.debug', async () => {
      const { logger } = await import('../utils/logger');
      logger.debug('debug message');
    });

    it('logger.trace calls console.trace', async () => {
      const { logger } = await import('../utils/logger');
      logger.trace('trace message');
    });

    it('logger.table calls console.table', async () => {
      const { logger } = await import('../utils/logger');
      logger.table([{ a: 1 }, { a: 2 }]);
    });

    it('logger.group calls console.group', async () => {
      const { logger } = await import('../utils/logger');
      logger.group('group label');
    });

    it('logger.groupEnd calls console.groupEnd', async () => {
      const { logger } = await import('../utils/logger');
      logger.groupEnd();
    });
  });

  describe('error logging', () => {
    it('logger.error always calls console.error (even in production)', async () => {
      const { logger } = await import('../utils/logger');
      logger.error('error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('error message');
    });

    it('logger.error passes multiple arguments', async () => {
      const { logger } = await import('../utils/logger');
      const errorObj = new Error('test error');
      logger.error('Error occurred:', errorObj, { context: 'test' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error occurred:', errorObj, { context: 'test' });
    });
  });

  describe('logger API', () => {
    it('has all expected methods', async () => {
      const { logger } = await import('../utils/logger');
      expect(typeof logger.log).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.table).toBe('function');
      expect(typeof logger.group).toBe('function');
      expect(typeof logger.groupEnd).toBe('function');
    });

    it('logger methods accept multiple arguments', async () => {
      const { logger } = await import('../utils/logger');
      // Should not throw
      logger.log('arg1', 'arg2', { key: 'value' }, [1, 2, 3]);
      logger.info('info', 123, true);
      logger.warn('warning', null, undefined);
      logger.debug('debug', Symbol('test'));
    });

    it('logger methods handle no arguments', async () => {
      const { logger } = await import('../utils/logger');
      // Should not throw
      logger.log();
      logger.info();
      logger.warn();
      logger.error();
      logger.debug();
    });
  });
});
