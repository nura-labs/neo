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
  x?: number;
  y?: number;
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
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
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

  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const isHovered = hoveredNode === n.id;
      const baseSize = Math.max(3, Math.min(8, 3 + n.val));
      const size = isHovered ? baseSize * 1.4 : baseSize;

      // Glow effect
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
        ctx.fillStyle = getNodeColor(n.type) + "30";
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = getNodeColor(n.type);
      ctx.fill();

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Label — show always if zoomed in enough, or on hover
      const fontSize = Math.max(10 / globalScale, 2);
      if (globalScale > 0.8 || isHovered) {
        ctx.font = `${isHovered ? "bold " : ""}${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHovered
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.6)";
        ctx.fillText(n.name, x, y + size + 2);
      }
    },
    [hoveredNode]
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
        No knowledge nodes yet. Install the Neo skill and index a project to see
        your graph.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <ForceGraph2D
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0a0a0a"
        nodeRelSize={1}
        nodeVal={(node) => {
          const n = node as GraphNode;
          return Math.max(1, Math.min(5, n.val));
        }}
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => "replace"}
        linkColor={() => "rgba(255,255,255,0.08)"}
        linkWidth={0.5}
        linkDirectionalArrowLength={0}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={1}
        linkDirectionalParticleSpeed={0.003}
        linkDirectionalParticleColor={() => "rgba(255,255,255,0.15)"}
        onNodeClick={handleNodeClick}
        onNodeHover={(node) =>
          setHoveredNode(node ? ((node as GraphNode).id ?? null) : null)
        }
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={50}
        cooldownTicks={100}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enableNodeDrag={true}
      />
    </div>
  );
}
