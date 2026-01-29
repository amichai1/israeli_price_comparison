/**
 * RTL (Right-to-Left) Utilities
 * 
 * Provides functions to detect and handle RTL text (Hebrew, Arabic, etc.)
 */

/**
 * Check if a string contains RTL characters (Hebrew, Arabic, etc.)
 */
export function isRTL(text: string): boolean {
  if (!text) return false;
  
  // Hebrew Unicode range: \u0590-\u05FF
  // Arabic Unicode range: \u0600-\u06FF
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF]/;
  
  return rtlRegex.test(text);
}

/**
 * Get text alignment based on RTL detection
 */
export function getTextAlign(text: string): 'left' | 'right' {
  return isRTL(text) ? 'right' : 'left';
}

/**
 * Get writing direction based on RTL detection
 */
export function getWritingDirection(text: string): 'ltr' | 'rtl' {
  return isRTL(text) ? 'rtl' : 'ltr';
}

/**
 * Get text style object with RTL support
 */
export function getRTLTextStyle(text: string) {
  const isRtl = isRTL(text);
  
  return {
    textAlign: isRtl ? ('right' as const) : ('left' as const),
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
  };
}
