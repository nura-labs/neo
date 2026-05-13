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

  const connectedNodes = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) return new Set<string>();
      const connected = new Set<string>([nodeId]);
      filteredData.links.forEach((link) => {
        const sourceId = typeof link.source === "string" ? link.source : link.source.id;
        const targetId = typeof link.target === "string" ? link.target : link.target.id;
        if (sourceId === nodeId) connected.add(targetId);
        if (targetId === nodeId) connected.add(sourceId);
      });
      return connected;
    },
    [filteredData.links]
  );

  // The "selected" state is what triggers the dramatic dim-others highlight.
  // Hover just gets a subtle ring on the hovered node — Obsidian-style.
  const highlighted = connectedNodes(selectedNodeId ?? null);
  const hasSelected = selectedNodeId != null;

  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const isSelected = n.id === selectedNodeId;
      const isHovered = n.id === hoveredNode;
      const isConnected = highlighted.has(n.id);
      const dimmed = hasSelected && !isConnected;

      const size = isSelected ? 7 : isHovered ? 6 : 5;
      const nodeColor = getNodeColor(n.type);

      // Glow ring for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, size + 8, 0, 2 * Math.PI);
        ctx.fillStyle = `${nodeColor}25`;
        ctx.fill();
      }
      // Subtle hover ring (no dim of others)
      if (isHovered && !isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = `${nodeColor}66`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      if (dimmed) {
        // Soft fade — keep some color so the user still recognizes the type
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = nodeColor;
        ctx.strokeStyle = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)";
      } else if (isSelected) {
        ctx.fillStyle = nodeColor;
        ctx.strokeStyle = isLight ? "#222" : "#fff";
      } else if (isConnected && hasSelected) {
        ctx.fillStyle = nodeColor;
        ctx.strokeStyle = nodeColor;
      } else {
        ctx.fillStyle = nodeColor;
        ctx.strokeStyle = isLight ? "rgba(0, 0, 0, 0.10)" : "rgba(255, 255, 255, 0.15)";
      }
      ctx.fill();
      ctx.lineWidth = isSelected ? 1.5 : 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Label
      const fontSize = Math.max(11 / globalScale, 1.5);
      const showLabel = isSelected || isHovered || isConnected || globalScale > 1.5;
      if (showLabel) {
        ctx.font = `${(isSelected || isHovered) ? "600 " : ""}${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        if (dimmed) {
          ctx.fillStyle = isLight ? "rgba(0, 0, 0, 0.20)" : "rgba(236, 233, 230, 0.25)";
        } else if (isSelected || isHovered) {
          ctx.fillStyle = isLight ? "rgba(0, 0, 0, 0.90)" : "rgba(236, 233, 230, 0.95)";
        } else if (isConnected && hasSelected) {
          ctx.fillStyle = isLight ? "rgba(0, 0, 0, 0.65)" : "rgba(236, 233, 230, 0.7)";
        } else {
          ctx.fillStyle = isLight ? "rgba(0, 0, 0, 0.40)" : "rgba(236, 233, 230, 0.45)";
        }

        let label = n.name;
        if (label.length > 30 && !(isSelected || isHovered)) label = label.substring(0, 28) + "...";
        ctx.fillText(label, x, y + size + 2);
      }
    },
    [selectedNodeId, hoveredNode, highlighted, hasSelected, isLight]
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
          linkColor={(link) => {
            if (!hasSelected) return isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.18)";
            const sId = typeof (link as GraphLink).source === "string"
              ? (link as GraphLink).source as string
              : ((link as GraphLink).source as GraphNode).id;
            const tId = typeof (link as GraphLink).target === "string"
              ? (link as GraphLink).target as string
              : ((link as GraphLink).target as GraphNode).id;
            if (highlighted.has(sId) && highlighted.has(tId)) {
              return isLight ? "rgba(0, 0, 0, 0.40)" : "rgba(255, 255, 255, 0.5)";
            }
            return isLight ? "rgba(0, 0, 0, 0.03)" : "rgba(255, 255, 255, 0.04)";
          }}
          linkWidth={(link) => {
            if (!hasSelected) return 0.6;
            const sId = typeof (link as GraphLink).source === "string"
              ? (link as GraphLink).source as string
              : ((link as GraphLink).source as GraphNode).id;
            const tId = typeof (link as GraphLink).target === "string"
              ? (link as GraphLink).target as string
              : ((link as GraphLink).target as GraphNode).id;
            if (highlighted.has(sId) && highlighted.has(tId)) return 1.5;
            return 0.2;
          }}
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
