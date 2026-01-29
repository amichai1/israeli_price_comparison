import { describe, it, expect } from 'vitest';
import { isRTL, getTextAlign, getWritingDirection, getRTLTextStyle } from '../lib/rtl-utils';

describe('RTL Support', () => {
  describe('isRTL', () => {
    it('should detect Hebrew text', () => {
      expect(isRTL('חלב')).toBe(true);
      expect(isRTL('לחם')).toBe(true);
      expect(isRTL('שוקולד')).toBe(true);
    });

    it('should detect Arabic text', () => {
      expect(isRTL('حليب')).toBe(true);
      expect(isRTL('خبز')).toBe(true);
    });

    it('should not detect English text as RTL', () => {
      expect(isRTL('Milk')).toBe(false);
      expect(isRTL('Bread')).toBe(false);
      expect(isRTL('Chocolate')).toBe(false);
    });

    it('should handle mixed text (Hebrew + English)', () => {
      expect(isRTL('Milk חלב')).toBe(true);
      expect(isRTL('חלב Milk')).toBe(true);
    });

    it('should handle empty or null strings', () => {
      expect(isRTL('')).toBe(false);
      expect(isRTL(null as any)).toBe(false);
      expect(isRTL(undefined as any)).toBe(false);
    });

    it('should handle numbers and special characters', () => {
      expect(isRTL('123')).toBe(false);
      expect(isRTL('₪12.50')).toBe(false);
      expect(isRTL('7290027600007')).toBe(false);
    });
  });

  describe('getTextAlign', () => {
    it('should return right for Hebrew text', () => {
      expect(getTextAlign('חלב')).toBe('right');
      expect(getTextAlign('לחם')).toBe('right');
    });

    it('should return left for English text', () => {
      expect(getTextAlign('Milk')).toBe('left');
      expect(getTextAlign('Bread')).toBe('left');
    });

    it('should return right for mixed text with Hebrew', () => {
      expect(getTextAlign('Milk חלב')).toBe('right');
    });
  });

  describe('getWritingDirection', () => {
    it('should return rtl for Hebrew text', () => {
      expect(getWritingDirection('חלב')).toBe('rtl');
      expect(getWritingDirection('לחם')).toBe('rtl');
    });

    it('should return ltr for English text', () => {
      expect(getWritingDirection('Milk')).toBe('ltr');
      expect(getWritingDirection('Bread')).toBe('ltr');
    });

    it('should return rtl for mixed text with Hebrew', () => {
      expect(getWritingDirection('Milk חלב')).toBe('rtl');
    });
  });

  describe('getRTLTextStyle', () => {
    it('should return RTL style object for Hebrew text', () => {
      const style = getRTLTextStyle('חלב');
      expect(style.textAlign).toBe('right');
      expect(style.writingDirection).toBe('rtl');
    });

    it('should return LTR style object for English text', () => {
      const style = getRTLTextStyle('Milk');
      expect(style.textAlign).toBe('left');
      expect(style.writingDirection).toBe('ltr');
    });

    it('should return RTL style object for mixed text', () => {
      const style = getRTLTextStyle('Milk חלב');
      expect(style.textAlign).toBe('right');
      expect(style.writingDirection).toBe('rtl');
    });
  });

  describe('Real Product Names', () => {
    it('should handle common Hebrew product names', () => {
      const products = [
        'חלב 3% 1 ליטר',
        'לחם פרוס לבן',
        'ביצים L 12 יחידות',
        'שוקולד מריר 100 גרם',
        'גבינה צהובה פרוסה',
        'יוגורט טבעי 500 גרם',
        'עגבניות 1 ק"ג',
        'מלפפונים 1 ק"ג',
        'שמן זית 1 ליטר',
        'חזה עוף 1 ק"ג',
      ];

      products.forEach(product => {
        expect(isRTL(product)).toBe(true);
        expect(getTextAlign(product)).toBe('right');
        expect(getWritingDirection(product)).toBe('rtl');
      });
    });

    it('should handle product names with mixed Hebrew and numbers', () => {
      expect(isRTL('חלב 3%')).toBe(true);
      expect(isRTL('ביצים L 12')).toBe(true);
      expect(isRTL('500 גרם')).toBe(true);
    });

    it('should handle store names', () => {
      const stores = [
        'רמי לוי',
        'אושר עד',
        'יוחננוף',
        'שופרסל',
        'Rami Levy',
        'Osher Ad',
        'Yohananof',
        'Shufersal',
      ];

      stores.forEach(store => {
        const style = getRTLTextStyle(store);
        expect(style).toHaveProperty('textAlign');
        expect(style).toHaveProperty('writingDirection');
      });
    });
  });
});
