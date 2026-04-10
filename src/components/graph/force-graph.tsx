"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getNodeColor } from "@/lib/graph/colors";
import { apiFetch } from "@/lib/api";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface GraphNode {
  id: string;
  name: string;
  type: string;
  source: string | null;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
  name: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function KnowledgeGraph() {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const router = useRouter();

  useEffect(() => {
    apiFetch<GraphData>("/api/graph").then((res) => {
      if (res.ok) setData(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const handleNodeClick = useCallback(
    (node: { id?: string | number }) => {
      if (node.id) router.push(`/knowledge/${node.id}`);
    },
    [router]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading graph...
      </div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No knowledge nodes yet. Install the Neo skill and index a project to see your graph.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <ForceGraph2D
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        nodeColor={(node) => getNodeColor((node as GraphNode).type)}
        nodeLabel={(node) => {
          const n = node as GraphNode;
          return `${n.name} (${n.type})`;
        }}
        nodeRelSize={6}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkLabel={(link) => (link as GraphLink).name}
        onNodeClick={handleNodeClick}
        backgroundColor="transparent"
      />
    </div>
  );
}
