"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  name: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function KnowledgeGraph() {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<{ zoomToFit: (ms?: number, px?: number) => void } | null>(null);
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

  // Find connected nodes for highlight
  const connectedNodes = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) return new Set<string>();
      const connected = new Set<string>();
      connected.add(nodeId);
      data.links.forEach((link) => {
        const sourceId = typeof link.source === "string" ? link.source : link.source.id;
        const targetId = typeof link.target === "string" ? link.target : link.target.id;
        if (sourceId === nodeId) connected.add(targetId);
        if (targetId === nodeId) connected.add(sourceId);
      });
      return connected;
    },
    [data.links]
  );

  const activeNode = selectedNode || hoveredNode;
  const highlighted = connectedNodes(activeNode);
  const hasActive = activeNode !== null;

  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const isActive = n.id === activeNode;
      const isConnected = highlighted.has(n.id);
      const dimmed = hasActive && !isConnected;

      // Node size — uniform, small
      const size = isActive ? 5 : 3.5;

      // Glow for active node
      if (isActive) {
        ctx.beginPath();
        ctx.arc(x, y, size + 6, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(120, 140, 255, 0.12)";
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      if (dimmed) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      } else if (isActive) {
        ctx.fillStyle = "#fff";
      } else if (isConnected && hasActive) {
        ctx.fillStyle = "rgba(160, 180, 255, 0.8)";
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      }
      ctx.fill();

      // Label
      const fontSize = Math.max(11 / globalScale, 1.5);
      const showLabel = isActive || isConnected || globalScale > 1.5;
      if (showLabel && !dimmed) {
        ctx.font = `${isActive ? "600 " : ""}${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isActive
          ? "rgba(255, 255, 255, 0.9)"
          : isConnected && hasActive
            ? "rgba(255, 255, 255, 0.7)"
            : "rgba(255, 255, 255, 0.4)";

        // Truncate long names
        let label = n.name;
        if (label.length > 30 && !isActive) {
          label = label.substring(0, 28) + "...";
        }
        ctx.fillText(label, x, y + size + 2);
      }
    },
    [activeNode, highlighted, hasActive]
  );

  const handleNodeClick = useCallback(
    (node: object) => {
      const n = node as GraphNode;
      if (selectedNode === n.id) {
        // Double click — navigate to detail
        router.push(`/knowledge/${n.id}`);
      } else {
        setSelectedNode(n.id);
      }
    },
    [selectedNode, router]
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500 text-sm">
        Loading graph...
      </div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500 text-sm">
        No knowledge nodes yet. Install the Neo skill and index a project to see your graph.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full relative">
      <ForceGraph2D
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#1a1a2e"
        nodeRelSize={1}
        nodeVal={() => 1}
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => "replace"}
        linkColor={(link) => {
          if (!hasActive) return "rgba(255, 255, 255, 0.15)";
          const sourceId = typeof (link as GraphLink).source === "string" ? (link as GraphLink).source as string : ((link as GraphLink).source as GraphNode).id;
          const targetId = typeof (link as GraphLink).target === "string" ? (link as GraphLink).target as string : ((link as GraphLink).target as GraphNode).id;
          if (highlighted.has(sourceId) && highlighted.has(targetId)) {
            return "rgba(140, 160, 255, 0.5)";
          }
          return "rgba(255, 255, 255, 0.03)";
        }}
        linkWidth={(link) => {
          if (!hasActive) return 0.5;
          const sourceId = typeof (link as GraphLink).source === "string" ? (link as GraphLink).source as string : ((link as GraphLink).source as GraphNode).id;
          const targetId = typeof (link as GraphLink).target === "string" ? (link as GraphLink).target as string : ((link as GraphLink).target as GraphNode).id;
          if (highlighted.has(sourceId) && highlighted.has(targetId)) return 1.5;
          return 0.15;
        }}
        linkDirectionalArrowLength={0}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClick}
        onNodeHover={(node) =>
          setHoveredNode(node ? ((node as GraphNode).id ?? null) : null)
        }
        onBackgroundClick={handleBackgroundClick}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.2}
        warmupTicks={100}
        cooldownTicks={300}
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        ref={fgRef as any}
        onEngineStop={() => {
          if (fgRef.current) {
            fgRef.current.zoomToFit(400, 80);
          }
        }}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enableNodeDrag={true}
      />
    </div>
  );
}
