export const nodeTypeColors: Record<string, string> = {
  pattern: "#60a5fa",       // soft blue
  convention: "#4ade80",    // soft green
  module: "#a78bfa",        // soft purple
  architecture: "#f9a8d4",  // soft pink
  decision: "#fbbf24",      // amber
  concept: "#67e8f9",       // soft cyan
  note: "#9ca3af",          // gray
  reference: "#fb923c",     // soft orange
};

export function getNodeColor(type: string): string {
  return nodeTypeColors[type] ?? "#9ca3af";
}
