import { memo } from 'react'
import { BaseEdge, Position, useInternalNode } from '@xyflow/react'
import type { EdgeProps, Node } from '@xyflow/react'
import type { WorkflowEdgeSide, WorkflowEdgeStyle, WorkflowNodeType } from '../../types'
import { WORKFLOW_EDGE_TYPE } from './flowMapping'
import type { WorkflowFlowEdge, WorkflowFlowNodeData } from './flowMapping'

/**
 * Custom edge of the workflow diagram: an orthogonal (right-angle) line with rounded corners,
 * an arrowhead and an optional label drawn on a background-coloured halo.
 *
 * How an edge is routed depends on the sides it leaves from and arrives at (see routeEdge):
 * - Same lane, forward (right to left): a straight line.
 * - Cross lane (bottom to top or top to bottom): the line leaves the node, runs along the lane
 *   boundary and then goes straight to the target.
 * - Backward same lane (bottom to bottom): the line loops beneath the nodes.
 * - Left to left: a bus that runs down the left gutter (the START edges).
 * - Top to top: a loop that runs around the top of the diagram (the final 'next request' edge).
 *
 * Styling hooks for WorkflowPage.css:
 * - The wrapper group has the class workflow-edge plus one tone class:
 *   workflow-edge--flow (normal flow), workflow-edge--decision (leaves a decision),
 *   workflow-edge--feedback (feedback loop) or workflow-edge--bad (either end needs
 *   definition, or the edge is a failure path).
 * - The CSS custom property --workflow-edge-color sets the colour of the arrowhead. Set it on the
 *   tone classes together with the stroke of the line (.react-flow__edge-path).
 * - The CSS custom property --workflow-edge-halo sets the colour of the halo behind the label.
 */

/** Length of the straight piece kept between a node and the first bend, in pixels. */
const STUB = 16
/** Radius of the rounded corners, in pixels. */
const CORNER_RADIUS = 6
/**
 * Distance between the top of a node and the top boundary of its lane. It mirrors the lane padding
 * used to build the swimlanes in flowMapping.ts, so cross-lane lines run along the lane boundary.
 */
const LANE_EDGE_PADDING = 35
/** How far into the left (or right) margin a bus runs when the edge has no route offset. */
const BUS_OFFSET = 30
/** How far above or beneath the nodes a loop runs when the edge has no route offset. */
const LOOP_OFFSET = 40
/** Extra room used when a line has to go around the nodes. */
const DETOUR_SPAN = 50
/** Approximate width of one label character at the label font size, used to size the halo. */
const LABEL_CHAR_WIDTH = 6

interface Point {
  x: number
  y: number
}

/** The direction a line travels when it leaves a node through the given side. */
const DIRECTIONS: Record<WorkflowEdgeSide, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
}

type EdgeTone = 'flow' | 'decision' | 'feedback' | 'bad'

type WorkflowCardNode = Node<WorkflowFlowNodeData, WorkflowNodeType>

function isHorizontal(side: WorkflowEdgeSide): boolean {
  return side === 'left' || side === 'right'
}

function sideOf(position: Position): WorkflowEdgeSide {
  switch (position) {
    case Position.Left:
      return 'left'
    case Position.Right:
      return 'right'
    case Position.Top:
      return 'top'
    default:
      return 'bottom'
  }
}

/** Slides a point along the side of the node it sits on. */
function slide(point: Point, side: WorkflowEdgeSide, offset: number): Point {
  if (offset === 0) return point
  return isHorizontal(side)
    ? { x: point.x, y: point.y + offset }
    : { x: point.x + offset, y: point.y }
}

/**
 * Works out the corner points of the line from `start` to `end`.
 * `routeOffset` moves the middle part of the line: it shifts the run along a lane boundary,
 * pushes a bus into the left or right margin (negative is left) and sets how far a loop runs
 * above (negative) or beneath (positive) the nodes.
 */
function routeEdge(
  start: Point,
  end: Point,
  sourceSide: WorkflowEdgeSide,
  targetSide: WorkflowEdgeSide,
  routeOffset: number | undefined,
): Point[] {
  const d = DIRECTIONS[sourceSide]
  const e = DIRECTIONS[targetSide]
  const sourceHorizontal = isHorizontal(sourceSide)
  const targetHorizontal = isHorizontal(targetSide)

  // Both ends on a left or right side.
  if (sourceHorizontal && targetHorizontal) {
    if (sourceSide === targetSide) {
      // A bus in the left or right margin that both ends connect to.
      const x =
        d.x < 0
          ? Math.min(
              Math.min(start.x, end.x) + (routeOffset ?? -BUS_OFFSET),
              Math.min(start.x, end.x) - STUB,
            )
          : Math.max(
              Math.max(start.x, end.x) + (routeOffset ?? BUS_OFFSET),
              Math.max(start.x, end.x) + STUB,
            )
      return [start, { x, y: start.y }, { x, y: end.y }, end]
    }
    // Facing sides at the same height: a straight line.
    if (Math.abs(start.y - end.y) < 1) return [start, end]
    const gap = (end.x - start.x) * d.x
    if (gap > 2) {
      const x = (start.x + end.x) / 2 + (routeOffset ?? 0)
      return [start, { x, y: start.y }, { x, y: end.y }, end]
    }
    // The target is behind the source: leave, go around beneath and come back.
    const y = Math.max(start.y, end.y) + DETOUR_SPAN + (routeOffset ?? 0)
    const startX = start.x + d.x * STUB
    const endX = end.x + e.x * STUB
    return [
      start,
      { x: startX, y: start.y },
      { x: startX, y },
      { x: endX, y },
      { x: endX, y: end.y },
      end,
    ]
  }

  // Both ends on a top or bottom side.
  if (!sourceHorizontal && !targetHorizontal) {
    if (sourceSide === targetSide) {
      // A loop above (top to top) or beneath (bottom to bottom) both nodes.
      const y =
        d.y < 0
          ? Math.min(
              Math.min(start.y, end.y) + (routeOffset ?? -LOOP_OFFSET),
              Math.min(start.y, end.y) - STUB,
            )
          : Math.max(
              Math.max(start.y, end.y) + (routeOffset ?? LOOP_OFFSET),
              Math.max(start.y, end.y) + STUB,
            )
      return [start, { x: start.x, y }, { x: end.x, y }, end]
    }
    if (Math.abs(start.x - end.x) < 1) return [start, end]
    const gap = (end.y - start.y) * d.y
    if (gap > 2) {
      // Run along a lane boundary: just above the target lane when going down, and just above
      // the source lane when going up. Fall back to the middle when that boundary does not fit.
      const candidate =
        d.y > 0 ? end.y + e.y * LANE_EDGE_PADDING : start.y + d.y * LANE_EDGE_PADDING
      const low = Math.min(start.y, end.y) + 2
      const high = Math.max(start.y, end.y) - 2
      const base = candidate > low && candidate < high ? candidate : (start.y + end.y) / 2
      const y = base + (routeOffset ?? 0)
      return [start, { x: start.x, y }, { x: end.x, y }, end]
    }
    // The target is behind the source: leave, go around to the side and come back.
    const startY = start.y + d.y * STUB
    const endY = end.y + e.y * STUB
    const x =
      (Math.abs(end.x - start.x) < 2 * STUB
        ? Math.max(start.x, end.x) + DETOUR_SPAN
        : (start.x + end.x) / 2) + (routeOffset ?? 0)
    return [
      start,
      { x: start.x, y: startY },
      { x, y: startY },
      { x, y: endY },
      { x: end.x, y: endY },
      end,
    ]
  }

  // One end on a left or right side and the other on a top or bottom side.
  if (sourceHorizontal) {
    const fits = (end.x - start.x) * d.x > 2 && (start.y - end.y) * e.y > 2
    if (fits) return [start, { x: end.x, y: start.y }, end]
    const startX = start.x + d.x * STUB
    const endY = end.y + e.y * STUB
    return [
      start,
      { x: startX, y: start.y },
      { x: startX, y: endY },
      { x: end.x, y: endY },
      end,
    ]
  }
  const fits = (end.y - start.y) * d.y > 2 && (start.x - end.x) * e.x > 2
  if (fits) return [start, { x: start.x, y: end.y }, end]
  const startY = start.y + d.y * STUB
  const endX = end.x + e.x * STUB
  return [
    start,
    { x: start.x, y: startY },
    { x: endX, y: startY },
    { x: endX, y: end.y },
    end,
  ]
}

/** Removes repeated points and points that sit in the middle of a straight run. */
function simplify(points: Point[]): Point[] {
  const deduped: Point[] = []
  for (const point of points) {
    const last = deduped[deduped.length - 1]
    if (last && Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) {
      continue
    }
    deduped.push(point)
  }
  const result: Point[] = []
  deduped.forEach((point, index) => {
    const previous = result[result.length - 1]
    const next = deduped[index + 1]
    if (previous && next) {
      const sameColumn = Math.abs(previous.x - point.x) < 0.5 && Math.abs(point.x - next.x) < 0.5
      const sameRow = Math.abs(previous.y - point.y) < 0.5 && Math.abs(point.y - next.y) < 0.5
      if (sameColumn || sameRow) return
    }
    result.push(point)
  })
  return result
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Builds the SVG path of a line through the points, with rounded corners. */
function toPath(points: Point[]): string {
  const first = points[0]
  if (!first) return ''
  let path = `M ${round(first.x)} ${round(first.y)}`
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index]
    if (!current) continue
    const previous = points[index - 1]
    const next = points[index + 1]
    if (!previous || !next) {
      path += ` L ${round(current.x)} ${round(current.y)}`
      continue
    }
    const incoming = distance(previous, current)
    const outgoing = distance(current, next)
    const radius = Math.min(CORNER_RADIUS, incoming / 2, outgoing / 2)
    if (radius <= 0) {
      path += ` L ${round(current.x)} ${round(current.y)}`
      continue
    }
    const before = {
      x: current.x + ((previous.x - current.x) / incoming) * radius,
      y: current.y + ((previous.y - current.y) / incoming) * radius,
    }
    const after = {
      x: current.x + ((next.x - current.x) / outgoing) * radius,
      y: current.y + ((next.y - current.y) / outgoing) * radius,
    }
    path += ` L ${round(before.x)} ${round(before.y)} Q ${round(current.x)} ${round(current.y)} ${round(after.x)} ${round(after.y)}`
  }
  return path
}

/** The middle of the longest straight run, where the label is placed. */
function labelPoint(points: Point[]): Point {
  const first = points[0] ?? { x: 0, y: 0 }
  let best = first
  let bestLength = -1
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    if (!from || !to) continue
    const length = distance(from, to)
    if (length > bestLength) {
      bestLength = length
      best = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
    }
  }
  return best
}

/** Which colour group an edge belongs to. */
function edgeTone(
  style: WorkflowEdgeStyle | undefined,
  sourceData: WorkflowFlowNodeData | undefined,
  targetData: WorkflowFlowNodeData | undefined,
): EdgeTone {
  if (
    style === 'failure' ||
    sourceData?.status === 'needs-definition' ||
    targetData?.status === 'needs-definition'
  ) {
    return 'bad'
  }
  if (style === 'feedback') return 'feedback'
  if (sourceData?.nodeType === 'decision') return 'decision'
  return 'flow'
}

function WorkflowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  style,
  interactionWidth,
}: EdgeProps<WorkflowFlowEdge>) {
  const sourceNode = useInternalNode<WorkflowCardNode>(source)
  const targetNode = useInternalNode<WorkflowCardNode>(target)

  const sourceSide = sideOf(sourcePosition)
  const targetSide = sideOf(targetPosition)
  const start = slide({ x: sourceX, y: sourceY }, sourceSide, data?.sourceOffset ?? 0)
  const end = slide({ x: targetX, y: targetY }, targetSide, data?.targetOffset ?? 0)

  const points = simplify(routeEdge(start, end, sourceSide, targetSide, data?.routeOffset))
  const path = points.length >= 2 ? toPath(points) : toPath([start, end])

  const tone = edgeTone(data?.style, sourceNode?.data, targetNode?.data)
  const text = typeof label === 'string' ? label : ''
  const labelAt = labelPoint(points)
  const markerId = `workflow-arrow-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`

  const haloColor = 'var(--workflow-edge-halo, var(--color-surface-alt))'

  return (
    <g className={`workflow-edge workflow-edge--${tone}`}>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="10"
          markerHeight="10"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            style={{ fill: 'var(--workflow-edge-color, var(--color-text-muted))' }}
          />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={`url(#${markerId})`}
        style={style}
        interactionWidth={interactionWidth}
      />
      {text ? (
        <g
          className="workflow-edge__label"
          pointerEvents="none"
          data-label-width={Math.round(text.length * LABEL_CHAR_WIDTH)}
        >
          <text
            x={round(labelAt.x)}
            y={round(labelAt.y)}
            dy="0.35em"
            textAnchor="middle"
            className="workflow-edge__label-halo"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fill: haloColor,
              stroke: haloColor,
              strokeWidth: 5,
              strokeLinejoin: 'round',
            }}
          >
            {text}
          </text>
          <text
            x={round(labelAt.x)}
            y={round(labelAt.y)}
            dy="0.35em"
            textAnchor="middle"
            className="workflow-edge__label-text"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fill: 'var(--color-text)',
            }}
          >
            {text}
          </text>
        </g>
      ) : null}
    </g>
  )
}

const WorkflowEdgeComponent = memo(WorkflowEdge)

/**
 * Maps React Flow edge types to components. Defined at module level so the
 * object keeps the same identity between renders.
 */
export const edgeTypes = {
  [WORKFLOW_EDGE_TYPE]: WorkflowEdgeComponent,
}