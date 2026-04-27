const CATEGORY_COLOR_VARIABLES = [
  '--category-color-1',
  '--category-color-2',
  '--category-color-3',
  '--category-color-4',
  '--category-color-5',
  '--category-color-6',
  '--category-color-7',
  '--category-color-8',
  '--category-color-9',
  '--category-color-10',
  '--category-color-11',
  '--category-color-12',
];

const CATEGORY_COLOR_FALLBACK = [
  '#6B9BD1',
  '#F4A261',
  '#E76F51',
  '#2A9D8F',
  '#E9C46A',
  '#8E6C88',
  '#4ECDC4',
  '#FF6B9D',
  '#95B8D1',
  '#B8A87E',
  '#7BB662',
  '#D4A5A5',
];

//Hash function consistently converts a string to a number.
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function getCategoryPalette(): string[] {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return CATEGORY_COLOR_FALLBACK;
  }

  const styles = window.getComputedStyle(document.documentElement);
  return CATEGORY_COLOR_VARIABLES.map((cssVarName, index) => {
    const value = styles.getPropertyValue(cssVarName).trim();
    return value || CATEGORY_COLOR_FALLBACK[index];
  });
}

//Get a category color based on the category name (using the hash)
export function getCategoryColor(category: string): string {
  const palette = getCategoryPalette();
  const hash = hashString(category);
  const index = hash % palette.length;
  return palette[index];
}

// Create a color map for all categories.
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
