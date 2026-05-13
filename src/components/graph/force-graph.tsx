"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ForceGraphMethods } from "react-force-graph-2d";
import { useTheme } from "next-themes";
import { apiFetch } from "@/lib/api";
import { getNodeColor } from "@/lib/graph/colors";
import { forceX, forceY, forceManyBody } from "d3-force";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  source: string | null;
  val: number;
  x?: number;
  y?: number;
  fx?: number | undefined;
  fy?: number | undefined;
  [key: string]: unknown;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  name: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface KnowledgeGraphProps {
  onNodeSelect?: (nodeId: string | null) => void;
  selectedNodeId?: string | null;
  width?: number;
  height?: number;
  typeFilter?: Set<string> | null;
}

export function KnowledgeGraph({
  onNodeSelect,
  selectedNodeId,
  width,
  height,
  typeFilter,
}: KnowledgeGraphProps) {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const { theme } = useTheme();
  const isLight = theme === "light";
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const forcesConfiguredRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    apiFetch<GraphData>("/api/graph").then((res) => {
      if (res.ok) setData(res.data);
      setLoading(false);
      // Zoom to fit after short delay for initial render
      setTimeout(() => fgRef.current?.zoomToFit(200, 40), 500);
    });
  }, []);

  useEffect(() => {
    if (width && height) {
      queueMicrotask(() => setDimensions({ width, height }));
      return;
    }
    if (!containerRef.current) return;
    const el = containerRef.current;
    function updateSize() {
      setDimensions({ width: el.clientWidth, height: el.clientHeight });
    }
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  // Filter nodes by type
  const filteredData = typeFilter && typeFilter.size > 0
    ? {
        nodes: data.nodes.filter((n) => typeFilter.has(n.type)),
        links: data.links.filter((l) => {
          const sId = typeof l.source === "string" ? l.source : l.source.id;
          const tId = typeof l.target === "string" ? l.target : l.target.id;
          const nodeIds = new Set(data.nodes.filter((n) => typeFilter.has(n.type)).map((n) => n.id));
          return nodeIds.has(sId) && nodeIds.has(tId);
        }),
      }
    : data;

  // No more dim-others. Click just opens the sidebar. Hover gets a subtle ring.
  // Selected gets a subtle same-color stroke so you can see what's open in the panel.
  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const isSelected = n.id === selectedNodeId;
      const isHovered = n.id === hoveredNode;

      const size = isSelected || isHovered ? 6 : 5;
      const nodeColor = getNodeColor(n.type);

      // Subtle ring on hover or selection
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = `${nodeColor}55`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Node circle — keep stroke subtle, no harsh black/white outlines
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.strokeStyle = isSelected
        ? nodeColor
        : isLight ? "rgba(0, 0, 0, 0.10)" : "rgba(255, 255, 255, 0.15)";
      ctx.fill();
      ctx.lineWidth = isSelected ? 1 : 0.5;
      ctx.stroke();

      // Label
      const fontSize = Math.max(11 / globalScale, 1.5);
      const showLabel = isSelected || isHovered || globalScale > 1.5;
      if (showLabel) {
        ctx.font = `${(isSelected || isHovered) ? "600 " : ""}${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = (isSelected || isHovered)
          ? isLight ? "rgba(0, 0, 0, 0.90)" : "rgba(236, 233, 230, 0.95)"
          : isLight ? "rgba(0, 0, 0, 0.40)" : "rgba(236, 233, 230, 0.45)";

        let label = n.name;
        if (label.length > 30 && !(isSelected || isHovered)) label = label.substring(0, 28) + "...";
        ctx.fillText(label, x, y + size + 2);
      }
    },
    [selectedNodeId, hoveredNode, isLight]
  );

  const handleNodeClick = useCallback(
    (node: object) => {
      const n = node as GraphNode;
      onNodeSelect?.(n.id);
    },
    [onNodeSelect]
  );

  const handleBackgroundClick = useCallback(() => {
    onNodeSelect?.(null);
    // Unpin all nodes
    data.nodes.forEach((n) => {
      n.fx = undefined;
      n.fy = undefined;
    });
  }, [onNodeSelect, data.nodes]);

  const handleNodeDragEnd = useCallback((node: object) => {
    const n = node as GraphNode;
    // Pin node where it was dropped
    n.fx = n.x;
    n.fy = n.y;
  }, []);

  if (loading) {
    return (
      <div ref={containerRef} className="h-full w-full flex items-center justify-center">
        <span className="neo-text-muted text-sm">Loading graph...</span>
      </div>
    );
  }

  if (filteredData.nodes.length === 0) {
    return (
      <div ref={containerRef} className="h-full w-full flex items-center justify-center">
        <span className="neo-text-muted text-sm">
          {typeFilter && typeFilter.size > 0
            ? "No nodes match the selected filters"
            : "No knowledge nodes yet"}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph2D
          graphData={filteredData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="transparent"
          nodeRelSize={1}
          nodeVal={() => 1}
          nodeLabel={() => ""}
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => "replace"}
          linkColor={() => isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.18)"}
          linkWidth={0.6}
          linkDirectionalArrowLength={0}
          linkDirectionalParticles={0}
          onNodeClick={handleNodeClick}
          onNodeHover={(node) => {
            setHoveredNode(node ? ((node as GraphNode).id ?? null) : null);
            // Show pointer cursor on hover so it's obvious nodes are clickable
            if (containerRef.current) {
              containerRef.current.style.cursor = node ? "pointer" : "default";
            }
          }}
          onBackgroundClick={handleBackgroundClick}
          onNodeDragEnd={handleNodeDragEnd}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.25}
          warmupTicks={100}
          cooldownTicks={300}
          ref={fgRef}
          onRenderFramePost={() => {
            const fg = fgRef.current;
            if (fg && !forcesConfiguredRef.current) {
              fg.d3Force("charge", forceManyBody().strength(-40).distanceMax(200));
              fg.d3Force("centerX", forceX(0).strength(0.06));
              fg.d3Force("centerY", forceY(0).strength(0.06));
              forcesConfiguredRef.current = true;
              fg.d3ReheatSimulation();
            }
          }}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          enableNodeDrag={true}
        />
      )}
    </div>
  );
}
