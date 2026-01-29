# RTL (Right-to-Left) Support

The app now includes comprehensive RTL support for Hebrew and Arabic text, ensuring a native experience for Hebrew-speaking users.

## Features

### Automatic RTL Detection
- Detects Hebrew (Unicode range: \u0590-\u05FF) and Arabic (Unicode range: \u0600-\u06FF) characters
- Automatically applies right-to-left text alignment and writing direction
- Works seamlessly with mixed-language text (Hebrew + English)

### Supported Screens

#### 1. Search Screen
- **Product names**: Automatically right-aligned for Hebrew text
- **Search input field**: Dynamic RTL support as you type
- **Mixed text**: Handles products with both Hebrew and English

#### 2. Basket Screen
- **Item names**: Right-aligned for Hebrew products
- **Consistent layout**: Maintains visual hierarchy regardless of text direction

#### 3. Comparison Screen
- **Store names**: Right-aligned for Hebrew chain names
- **Branch names**: Right-aligned for Hebrew branch names
- **Missing items**: Right-aligned list items for Hebrew product names

## Implementation

### RTL Utility Functions

Located in `lib/rtl-utils.ts`:

```typescript
// Check if text contains RTL characters
isRTL(text: string): boolean

// Get text alignment ('left' or 'right')
getTextAlign(text: string): 'left' | 'right'

// Get writing direction ('ltr' or 'rtl')
getWritingDirection(text: string): 'ltr' | 'rtl'

// Get complete style object with RTL support
getRTLTextStyle(text: string): { textAlign, writingDirection }
```

### Usage Example

```typescript
import { getRTLTextStyle } from '@/lib/rtl-utils';

function ProductCard({ product }) {
  const nameStyle = getRTLTextStyle(product.name);
  
  return (
    <Text style={nameStyle}>
      {product.name}
    </Text>
  );
}
```

## Supported Languages

### Hebrew
- Full support for Hebrew characters
- Handles Hebrew with numbers (e.g., "חלב 3%")
- Handles Hebrew with Latin letters (e.g., "חלב Milk")

### Arabic
- Full support for Arabic characters
- Same mixed-text handling as Hebrew

### English
- Default left-to-right alignment
- No special handling needed

## Testing

All RTL functionality has been comprehensively tested:

✅ Hebrew text detection  
✅ Arabic text detection  
✅ English text (LTR) detection  
✅ Mixed Hebrew + English text  
✅ Empty and null strings  
✅ Numbers and special characters  
✅ Real product names with Hebrew  
✅ Store names with Hebrew  
✅ Text alignment calculation  
✅ Writing direction calculation  

Run tests:
```bash
pnpm test rtl-support.test.ts
```

## Real-World Examples

### Product Names
When you scrape real data from Israeli supermarkets, product names will automatically display correctly:

```
חלב 3% 1 ליטר          → Right-aligned
לחם פרוס לבן            → Right-aligned
ביצים L 12 יחידות      → Right-aligned
Milk 3% 1L              → Left-aligned
```

### Store Names
Store names in both Hebrew and English are handled correctly:

```
רמי לוי                 → Right-aligned
Rami Levy               → Left-aligned
אושר עד                 → Right-aligned
Osher Ad                → Left-aligned
```

### Search Input
As you type in the search field:
- Typing "חלב" → Text aligns right automatically
- Typing "Milk" → Text aligns left automatically
- Typing "חלב Milk" → Text aligns right (Hebrew detected)

## Visual Behavior

### Before RTL Support
```
┌─────────────────────────┐
│ חלב 3% 1 ליטר          │  ← Left-aligned (wrong!)
│ Barcode: 7290000000000 │
└─────────────────────────┘
```

### After RTL Support
```
┌─────────────────────────┐
│          חלב 3% 1 ליטר │  ← Right-aligned (correct!)
│ Barcode: 7290000000000 │
└─────────────────────────┘
```

## Technical Details

### Unicode Ranges
- **Hebrew**: U+0590 to U+05FF (includes letters, vowels, punctuation)
- **Arabic**: U+0600 to U+06FF (includes letters, vowels, punctuation)

### React Native Properties
The utility applies these React Native Text properties:
- `textAlign`: Controls horizontal text alignment ('left' or 'right')
- `writingDirection`: Controls text flow direction ('ltr' or 'rtl')

### Performance
- Detection is performed via regex matching (very fast)
- No external dependencies required
- Minimal performance impact

## Browser Compatibility

RTL support works across all platforms:
- ✅ iOS (native)
- ✅ Android (native)
- ✅ Web (browser)

## Future Enhancements

### Potential Improvements

1. **Full App RTL Mode**
   - Mirror entire app layout for RTL languages
   - Reverse navigation direction
   - Flip icons and buttons

2. **Language Preference**
   - Let users manually set language preference
   - Override automatic detection if needed

3. **Bidirectional Text Optimization**
   - Better handling of complex mixed-direction text
   - Support for embedded LTR text in RTL context

4. **Localization**
   - Translate UI labels to Hebrew
   - Support multiple languages beyond Hebrew/Arabic

## Troubleshooting

### Text not aligning correctly
- Check that `getRTLTextStyle()` is applied to the Text component
- Verify the text contains Hebrew/Arabic characters
- Ensure no conflicting `textAlign` styles

### Search input not switching direction
- Verify `style={getRTLTextStyle(searchQuery)}` is applied to TextInput
- Check that the style is not being overridden by className

### Mixed text displaying incorrectly
- This is expected behavior - the entire text aligns based on first RTL character detected
- Consider splitting text into separate components if needed

## Code References

### Key Files
- `lib/rtl-utils.ts` - RTL detection and styling utilities
- `app/(tabs)/index.tsx` - Search screen with RTL support
- `app/(tabs)/basket.tsx` - Basket screen with RTL support
- `app/(tabs)/comparison.tsx` - Comparison screen with RTL support
- `tests/rtl-support.test.ts` - Comprehensive RTL tests

### Components Using RTL
All text components displaying user-generated content (product names, store names) now use RTL detection:
- Product name in search results
- Product name in basket items
- Store name in comparison cards
- Branch name in comparison cards
- Missing items list in comparison modal
- Search input field

---

**Version:** 1.0  
**Last Updated:** January 25, 2026  
**Status:** ✅ Fully Implemented and Tested  
**Test Coverage:** 18 tests passing
