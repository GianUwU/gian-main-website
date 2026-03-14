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
 * Improved hash function to consistently convert a string to a number.
 * Uses a combination of character codes with better distribution.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a category color based on the category name.
 * The same category name always gets the same color, regardless of other categories.
 * New categories added won't affect the colors of existing ones.
 */
export function getCategoryColor(category: string): string {
  const hash = hashString(category);
  const index = hash % PLEASANT_COLORS.length;
  return PLEASANT_COLORS[index];
}

/**
 * Create a color map for multiple categories based on their names.
 * Colors are determined by the category name hash, ensuring consistency.
 */
export function createCategoryColorMap(categories: string[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  categories.forEach((cat) => {
    colorMap.set(cat, getCategoryColor(cat));
  });
  return colorMap;
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
