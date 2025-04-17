import { describe, it, expect } from 'vitest';
import { parseDate, DATE_PARSING_LOCALES, DATE_FORMATS } from '../date-parser';

describe('date-parser', () => {
  describe('parseDate', () => {
    it('should parse standard ISO date strings', () => {
      const dateStr = '2025-04-17T10:15:04.000Z';
      const result = parseDate(dateStr);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(dateStr);
    });
    
    it('should parse English RSS date format', () => {
      const dateStr = 'Thu, 17 Apr 2025 10:15:04 -0300';
      const result = parseDate(dateStr);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(3); // April is 3 (zero-based)
      expect(result.getDate()).toBe(17);
    });
    
    it('should parse Portuguese RSS date format', () => {
      const dateStr = 'Qui, 17 Abr 2025 10:15:04 -0300';
      const result = parseDate(dateStr);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(3); // April is 3 (zero-based)
      expect(result.getDate()).toBe(17);
    });
    
    it('should parse Spanish RSS date format', () => {
      const dateStr = 'Jue, 17 Abr 2025 10:15:04 -0300';
      const result = parseDate(dateStr);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(3); // April is 3 (zero-based)
      expect(result.getDate()).toBe(17);
    });
    
    it('should parse French RSS date format', () => {
      const dateStr = 'Jeu, 17 Avr 2025 10:15:04 -0300';
      const result = parseDate(dateStr);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(3); // April is 3 (zero-based)
      expect(result.getDate()).toBe(17);
    });
    
    it('should return current date for invalid date strings', () => {
      const dateStr = 'not a date';
      const before = new Date();
      const result = parseDate(dateStr);
      const after = new Date();
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
  
  describe('DATE_PARSING_LOCALES', () => {
    it('should include common locales', () => {
      expect(DATE_PARSING_LOCALES).toContain('en');
      expect(DATE_PARSING_LOCALES).toContain('pt-BR');
      expect(DATE_PARSING_LOCALES).toContain('es');
      expect(DATE_PARSING_LOCALES).toContain('fr');
      expect(DATE_PARSING_LOCALES).toContain('de');
      expect(DATE_PARSING_LOCALES).toContain('it');
    });
  });
  
  describe('DATE_FORMATS', () => {
    it('should include common date formats', () => {
      expect(DATE_FORMATS).toContain('EEE, dd LLL yyyy HH:mm:ss ZZZ');
      expect(DATE_FORMATS).toContain('yyyy-MM-dd\'T\'HH:mm:ssZZZ');
    });
  });
});
