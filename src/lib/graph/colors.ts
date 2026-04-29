// Pastel palette — grouped by category, softer and cohesive

export const nodeTypeColors: Record<string, string> = {
  // Knowledge types → soft blue family
  pattern: "#7da0ca",
  convention: "#8badc7",
  architecture: "#6e98bf",
  decision: "#9bb4cf",
  concept: "#7da8c4",
  workflow: "#88b0c9",
  snippet: "#94b8cd",

  // Structure types → soft lavender
  module: "#a094c4",
  api: "#9a8dbe",
  service: "#a89dc8",
  config: "#b0a5cb",

  // Entity types → soft teal/green
  person: "#7ebba5",
  project: "#72b59e",
  team: "#85c0ab",
  tool: "#6daf97",

  // Reference types → warm neutral
  reference: "#bfb5a3",
  research: "#c4baa8",
  note: "#9e978c",
};

export function getNodeColor(type: string): string {
  return nodeTypeColors[type] ?? "#9e978c";
}
