import { describe, it, expect } from 'vitest';
import { emptyTabMessages, getEmptyTabMessage } from '../constants/emptyTabMessages';

describe('emptyTabMessages', () => {
  it('has messages for all expected tab types', () => {
    const expectedTypes: Array<keyof typeof emptyTabMessages> = [
      'events',
      'pods',
      'consumers',
      'endpoints',
      'history',
      'rules',
      'pvcs',
      'data',
    ];
    expectedTypes.forEach((type) => {
      expect(emptyTabMessages[type]).toBeDefined();
    });
  });

  it('each message has required properties', () => {
    Object.entries(emptyTabMessages).forEach(([, msg]) => {
      expect(msg.icon).toBeDefined();
      expect(msg.title).toBeDefined();
      expect(typeof msg.title).toBe('string');
      expect(msg.description).toBeDefined();
      expect(typeof msg.description).toBe('string');
    });
  });

  describe('getEmptyTabMessage', () => {
    it('returns correct message for known tab type', () => {
      const eventsMsg = getEmptyTabMessage('events');
      expect(eventsMsg.icon).toBe('events');
      expect(eventsMsg.title).toBe('No events yet');
    });

    it('returns correct message for pods', () => {
      const podsMsg = getEmptyTabMessage('pods');
      expect(podsMsg.icon).toBe('pods');
      expect(podsMsg.title).toBe('No pods running');
    });

    it('returns correct message for consumers', () => {
      const consumersMsg = getEmptyTabMessage('consumers');
      expect(consumersMsg.icon).toBe('consumers');
      expect(consumersMsg.title).toBe('No consumers found');
    });

    it('returns default message for unknown tab type', () => {
      const unknownMsg = getEmptyTabMessage('unknown-type');
      expect(unknownMsg.icon).toBe('default');
      expect(unknownMsg.title).toBe('No data');
    });

    it('returns default message for undefined tab type', () => {
      const undefinedMsg = getEmptyTabMessage(undefined as unknown as string);
      expect(undefinedMsg.icon).toBe('default');
    });

    it('returns default message for null tab type', () => {
      const nullMsg = getEmptyTabMessage(null as unknown as string);
      expect(nullMsg.icon).toBe('default');
    });
  });
});
