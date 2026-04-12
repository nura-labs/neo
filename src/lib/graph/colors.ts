export const nodeTypeColors: Record<string, string> = {
  // Knowledge types
  pattern: "#60a5fa",       // blue
  convention: "#4ade80",    // green
  architecture: "#f9a8d4",  // pink
  decision: "#fbbf24",      // amber
  concept: "#67e8f9",       // cyan
  workflow: "#c084fc",      // purple
  snippet: "#a3e635",       // lime

  // Structure types
  module: "#a78bfa",        // violet
  api: "#38bdf8",           // sky
  service: "#2dd4bf",       // teal
  config: "#d4d4d8",        // zinc

  // Entity types
  person: "#f472b6",        // pink
  project: "#34d399",       // emerald
  team: "#fb7185",          // rose
  tool: "#818cf8",          // indigo

  // Reference types
  reference: "#fb923c",     // orange
  research: "#fcd34d",      // yellow
  note: "#9ca3af",          // gray
};

export function getNodeColor(type: string): string {
  return nodeTypeColors[type] ?? "#9ca3af";
}
