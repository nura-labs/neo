export const nodeTypeColors: Record<string, string> = {
  pattern: "#3b82f6",       // blue
  convention: "#22c55e",    // green
  module: "#a855f7",        // purple
  architecture: "#f97316",  // orange
  decision: "#eab308",      // yellow
  concept: "#06b6d4",       // cyan
  note: "#6b7280",          // gray
  reference: "#ec4899",     // pink
};

export function getNodeColor(type: string): string {
  return nodeTypeColors[type] ?? "#6b7280";
}
