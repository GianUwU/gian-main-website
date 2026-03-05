// Pleasant, hand-picked color palette
export const PLEASANT_COLORS = [
  '#6B9BD1', // soft blue
  '#F4A261', // warm orange
  '#E76F51', // coral red
  '#2A9D8F', // teal
  '#E9C46A', // golden yellow
  '#8E6C88', // mauve
  '#4ECDC4', // turquoise
  '#FF6B9D', // pink
  '#95B8D1', // powder blue
  '#B8A87E', // tan
  '#7BB662', // green
  '#D4A5A5', // dusty rose
];

/**
 * Get a category color based on its position in a sorted list of all categories.
 * This ensures consistent colors across the app regardless of insertion order.
 */
export function getCategoryColor(category: string, allCategoriesSorted: string[]): string {
  const index = allCategoriesSorted.indexOf(category);
  if (index === -1) return PLEASANT_COLORS[0];
  return PLEASANT_COLORS[index % PLEASANT_COLORS.length];
}

/**
 * Create a color map for multiple categories.
 * Categories should be sorted before passing to ensure consistent colors.
 */
export function createCategoryColorMap(categoriesSorted: string[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  categoriesSorted.forEach((cat, idx) => {
    colorMap.set(cat, PLEASANT_COLORS[idx % PLEASANT_COLORS.length]);
  });
  return colorMap;
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
