import { KnowledgeGraph } from "@/components/graph/force-graph";

export default function GraphPage() {
  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-2xl font-bold">Knowledge Graph</h1>
      <div className="flex-1 rounded-lg border bg-background">
        <KnowledgeGraph />
      </div>
    </div>
  );
}
