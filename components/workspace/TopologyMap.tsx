'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { GraphNode, OperationalGraphData } from '@/lib/nerve/operational-graph';

interface TopologyMapProps {
    graph: OperationalGraphData;
    focusNodeId?: string | null;
    blastRadius?: string[];
    onNodeSelect?: (nodeId: string) => void;
}

interface LayoutNode extends GraphNode {
    x: number;
    y: number;
}

/**
 * Interactive SVG topology visualization.
 * Nodes = assets (color-coded by health), edges = relationships.
 * Supports hover, click, and blast-radius highlighting.
 */
export function TopologyMap({
    graph,
    focusNodeId,
    blastRadius = [],
    onNodeSelect,
}: TopologyMapProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

    // Responsive sizing
    useEffect(() => {
        const container = svgRef.current?.parentElement;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: Math.max(400, entry.contentRect.height),
                });
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Force-directed layout (simplified)
    const layoutNodes = useCallback((): LayoutNode[] => {
        const { width, height } = dimensions;
        const cx = width / 2;
        const cy = height / 2;

        return graph.nodes.map((node, i) => {
            const angle = (2 * Math.PI * i) / graph.nodes.length;
            const radius = Math.min(width, height) * 0.35;

            // Cluster by type
            const typeOffset = node.type === 'agent' ? 0.8 : node.type === 'user' ? 1.2 : 1;

            return {
                ...node,
                x: cx + Math.cos(angle) * radius * typeOffset,
                y: cy + Math.sin(angle) * radius * typeOffset,
            };
        });
    }, [graph.nodes, dimensions]);

    const nodes = layoutNodes();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Health → color mapping
    const getNodeColor = (node: GraphNode) => {
        if (node.health >= 80) return 'hsl(var(--health-good))';
        if (node.health >= 50) return 'hsl(var(--oracle))';
        if (node.health >= 20) return 'hsl(var(--health-critical))';
        return 'hsl(var(--muted-foreground))';
    };

    const getNodeRadius = (node: GraphNode) => {
        if (node.type === 'agent') return 8;
        if (node.type === 'user') return 6;
        return 12; // assets are largest
    };

    const isInBlastRadius = (nodeId: string) => blastRadius.includes(nodeId);
    const isFocused = (nodeId: string) => nodeId === focusNodeId;

    return (
        <div className="card p-0 overflow-hidden min-h-[400px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-nerve" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    <h3 className="text-sm font-semibold">Infrastructure Topology</h3>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--health-good))' }} />
                        Healthy
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--oracle))' }} />
                        Warning
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--health-critical))' }} />
                        Critical
                    </span>
                </div>
            </div>

            {/* Empty state */}
            {graph.nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <svg className="mb-3 h-12 w-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                    </svg>
                    <p className="text-sm font-medium text-muted-foreground">No topology data yet</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">Add assets and relationships to see the graph</p>
                </div>
            ) : (
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                    className="w-full"
                    style={{ height: dimensions.height }}
                >
                    {/* Grid background */}
                    <defs>
                        <pattern id="topo-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
                        </pattern>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#topo-grid)" />

                    {/* Edges */}
                    {graph.edges.map((edge, i) => {
                        const source = nodeMap.get(edge.source);
                        const target = nodeMap.get(edge.target);
                        if (!source || !target) return null;

                        const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;

                        return (
                            <line
                                key={i}
                                x1={source.x}
                                y1={source.y}
                                x2={target.x}
                                y2={target.y}
                                stroke={isHighlighted ? 'hsl(var(--nerve))' : 'hsl(var(--border))'}
                                strokeWidth={isHighlighted ? 2 : 1}
                                strokeDasharray={edge.type === 'MONITORS' ? '4 2' : undefined}
                                opacity={hoveredNode && !isHighlighted ? 0.2 : 0.6}
                                className="transition-all duration-200"
                            />
                        );
                    })}

                    {/* Nodes */}
                    {nodes.map(node => {
                        const r = getNodeRadius(node);
                        const color = getNodeColor(node);
                        const isHovered = hoveredNode === node.id;
                        const inBlast = isInBlastRadius(node.id);
                        const focused = isFocused(node.id);
                        const dimmed = hoveredNode && !isHovered &&
                            !graph.edges.some(e =>
                                (e.source === hoveredNode && e.target === node.id) ||
                                (e.target === hoveredNode && e.source === node.id)
                            );

                        return (
                            <g
                                key={node.id}
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredNode(node.id)}
                                onMouseLeave={() => setHoveredNode(null)}
                                onClick={() => onNodeSelect?.(node.id)}
                                opacity={dimmed ? 0.25 : 1}
                            >
                                {/* Blast radius ring */}
                                {(inBlast || focused) && (
                                    <circle
                                        cx={node.x}
                                        cy={node.y}
                                        r={r + 6}
                                        fill="none"
                                        stroke={focused ? 'hsl(var(--nerve))' : 'hsl(var(--health-critical))'}
                                        strokeWidth={2}
                                        strokeDasharray="3 3"
                                        opacity={0.6}
                                    >
                                        <animate attributeName="stroke-dashoffset" from="0" to="12" dur="1s" repeatCount="indefinite" />
                                    </circle>
                                )}

                                {/* Risk pulse for degraded nodes */}
                                {node.health < 50 && (
                                    <circle
                                        cx={node.x}
                                        cy={node.y}
                                        r={r}
                                        fill={color}
                                        opacity={0.3}
                                    >
                                        <animate attributeName="r" from={r} to={r + 10} dur="2s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite" />
                                    </circle>
                                )}

                                {/* Main node */}
                                <circle
                                    cx={node.x}
                                    cy={node.y}
                                    r={isHovered ? r + 2 : r}
                                    fill={color}
                                    stroke={isHovered ? 'white' : 'none'}
                                    strokeWidth={2}
                                    filter={isHovered ? 'url(#glow)' : undefined}
                                    className="transition-all duration-200"
                                />

                                {/* Node icon (small shape inside) */}
                                {node.type === 'agent' && (
                                    <rect
                                        x={node.x - 3}
                                        y={node.y - 3}
                                        width={6}
                                        height={6}
                                        fill="white"
                                        opacity={0.8}
                                        rx={1}
                                    />
                                )}

                                {/* Label (on hover) */}
                                {isHovered && (
                                    <g>
                                        <rect
                                            x={node.x - 50}
                                            y={node.y - r - 28}
                                            width={100}
                                            height={22}
                                            rx={6}
                                            fill="hsl(var(--card))"
                                            stroke="hsl(var(--border))"
                                            strokeWidth={1}
                                        />
                                        <text
                                            x={node.x}
                                            y={node.y - r - 14}
                                            textAnchor="middle"
                                            fill="hsl(var(--foreground))"
                                            fontSize={11}
                                            fontWeight={500}
                                        >
                                            {node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })}

                    {/* Summary badge */}
                    <g>
                        <rect
                            x={8}
                            y={dimensions.height - 32}
                            width={220}
                            height={24}
                            rx={6}
                            fill="hsl(var(--card))"
                            opacity={0.9}
                            stroke="hsl(var(--border))"
                            strokeWidth={1}
                        />
                        <text
                            x={16}
                            y={dimensions.height - 16}
                            fill="hsl(var(--muted-foreground))"
                            fontSize={10}
                        >
                            {graph.summary.totalNodes} nodes · {graph.summary.totalEdges} edges ·{' '}
                            {graph.summary.criticalNodes > 0
                                ? `${graph.summary.criticalNodes} critical`
                                : `${graph.summary.healthyNodes} healthy`}
                        </text>
                    </g>
                </svg>
            )}
        </div>
    );
}
