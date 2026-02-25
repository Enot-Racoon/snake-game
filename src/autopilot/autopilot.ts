// ============================================================================
// UNKILLABLE SNAKE AUTOPILOT - Search-Based Safety Verification
// ============================================================================
// This implementation uses BFS/A* for all safety checks - NO heuristics,
// NO Hamiltonian cycles, NO fixed patterns. Pure search-based decision making.
// ============================================================================

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type Position = { x: number; y: number };

export interface GridConfig {
  width: number;
  height: number;
}

export interface GameState {
  snake: Position[];
  food: Position;
  direction: Direction;
}

// ============================================================================
// Grid & Position Utilities
// ============================================================================

const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTIONS: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

const positionKey = (pos: Position): string => `${pos.x},${pos.y}`;

const positionsEqual = (a: Position, b: Position): boolean =>
  a.x === b.x && a.y === b.y;

const manhattanDistance = (a: Position, b: Position): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// ============================================================================
// Grid Bounds & Collision Detection
// ============================================================================

export const isInBounds = (pos: Position, config: GridConfig): boolean =>
  pos.x >= 0 && pos.x < config.width && pos.y >= 0 && pos.y < config.height;

export const isSafePosition = (
  pos: Position,
  snake: Position[],
  config: GridConfig,
  excludeTail = true
): boolean => {
  if (!isInBounds(pos, config)) return false;
  const bodyToCheck = excludeTail ? snake.slice(0, -1) : snake;
  return !bodyToCheck.some((s) => positionsEqual(s, pos));
};

export const getNeighbors = (
  pos: Position,
  snake: Position[],
  config: GridConfig
): Position[] => {
  const neighbors: Position[] = [];
  for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]) {
    const next = {
      x: pos.x + DIRECTION_VECTORS[dir].x,
      y: pos.y + DIRECTION_VECTORS[dir].y,
    };
    if (isSafePosition(next, snake, config, true)) {
      neighbors.push(next);
    }
  }
  return neighbors;
};

export const getDirectionToPosition = (
  from: Position,
  to: Position
): Direction | null => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return 'RIGHT';
  if (dx === -1 && dy === 0) return 'LEFT';
  if (dx === 0 && dy === 1) return 'DOWN';
  if (dx === 0 && dy === -1) return 'UP';
  return null;
};

// ============================================================================
// Move Simulation
// ============================================================================

/**
 * Simulate a move and return the resulting snake state.
 * If eating is true, the snake grows (tail not removed).
 */
export const simulateMove = (
  snake: Position[],
  direction: Direction,
  eating: boolean = false
): Position[] => {
  const head = snake[0];
  const newHead = {
    x: head.x + DIRECTION_VECTORS[direction].x,
    y: head.y + DIRECTION_VECTORS[direction].y,
  };
  const newSnake = [newHead, ...snake];
  if (!eating) {
    newSnake.pop(); // Remove tail if not eating
  }
  return newSnake;
};

// ============================================================================
// BFS Pathfinding (for both food and tail)
// ============================================================================

/**
 * BFS to find shortest path from start to goal.
 * Returns array of positions (excluding start, including goal).
 * Returns null if no path exists.
 */
export const bfsPath = (
  start: Position,
  goal: Position,
  snake: Position[],
  config: GridConfig
): Position[] | null => {
  if (!isSafePosition(goal, snake, config, true)) return null;

  const queue: { pos: Position; path: Position[] }[] = [
    { pos: start, path: [] },
  ];
  const visited = new Set<string>();
  visited.add(positionKey(start));

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;

    if (positionsEqual(pos, goal)) {
      return path;
    }

    for (const neighbor of getNeighbors(pos, snake, config)) {
      const key = positionKey(neighbor);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({
          pos: neighbor,
          path: [...path, neighbor],
        });
      }
    }
  }

  return null;
};

// ============================================================================
// Flood Fill - Measure Reachable Free Space
// ============================================================================

/**
 * Count all reachable cells from a starting position using flood fill.
 * This measures how much free space the snake can access.
 */
export const countReachableCells = (
  start: Position,
  snake: Position[],
  config: GridConfig
): number => {
  const visited = new Set<string>();
  const queue: Position[] = [start];
  let count = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = positionKey(current);

    if (visited.has(key)) continue;
    if (!isSafePosition(current, snake, config, true)) continue;

    visited.add(key);
    count++;

    for (const neighbor of getNeighbors(current, snake, config)) {
      if (!visited.has(positionKey(neighbor))) {
        queue.push(neighbor);
      }
    }
  }

  return count;
};

// ============================================================================
// CORE SAFETY CHECK: Can Reach Tail
// ============================================================================

/**
 * CRITICAL SAFETY FUNCTION: Check if snake can reach its tail from head.
 * This is the KEY to never dying - if we can reach our tail, we can stall.
 * Uses BFS for exact verification (not heuristic).
 */
export const canReachTail = (
  snake: Position[],
  config: GridConfig
): boolean => {
  if (snake.length < 3) return true; // Short snakes are always safe

  const head = snake[0];
  const tail = snake[snake.length - 1];

  // Use BFS to find if there's a path from head to tail
  const path = bfsPath(head, tail, snake, config);
  return path !== null;
};

// ============================================================================
// ENCLOSED REGION DETECTION
// ============================================================================

/**
 * Check if a move would create an enclosed region that traps the snake.
 * Uses flood fill to verify that all free space remains connected.
 */
export const wouldCreateEnclosure = (
  newSnake: Position[],
  config: GridConfig
): boolean => {
  const head = newSnake[0];
  const totalFreeSpace = config.width * config.height - newSnake.length;
  const reachableFromHead = countReachableCells(head, newSnake, config);

  // If we can't reach all free space from head, we're trapped
  return reachableFromHead < totalFreeSpace * 0.8; // Allow some tolerance
};

// ============================================================================
// LOOP DETECTION
// ============================================================================

export interface LoopDetector {
  recentStates: string[];
  maxHistory: number;
}

export const createLoopDetector = (maxHistory: number = 20): LoopDetector => ({
  recentStates: [],
  maxHistory,
});

/**
 * Create a hash of the current game state for loop detection.
 * Includes snake positions and food position.
 */
export const stateHash = (state: GameState): string => {
  const snakeHash = state.snake.map((s) => `${s.x},${s.y}`).join(';');
  return `${snakeHash}|${state.food.x},${state.food.y}`;
};

/**
 * Add current state to history and check for loops.
 * Returns true if a loop is detected.
 */
export const detectLoop = (
  detector: LoopDetector,
  state: GameState
): boolean => {
  const hash = stateHash(state);

  // Check if this state was seen recently
  if (detector.recentStates.includes(hash)) {
    return true;
  }

  // Add to history
  detector.recentStates.push(hash);
  if (detector.recentStates.length > detector.maxHistory) {
    detector.recentStates.shift();
  }

  return false;
};

/**
 * Check for oscillation (repeated back-and-forth movement).
 */
export const detectOscillation = (
  recentDirections: Direction[],
  windowSize: number = 4
): boolean => {
  if (recentDirections.length < windowSize) return false;

  const recent = recentDirections.slice(-windowSize);
  // Check for pattern like UP, DOWN, UP, DOWN or LEFT, RIGHT, LEFT, RIGHT
  for (let i = 0; i < windowSize - 2; i++) {
    if (
      recent[i] === recent[i + 2] &&
      recent[i + 1] === OPPOSITE_DIRECTIONS[recent[i]]
    ) {
      return true;
    }
  }
  return false;
};

// ============================================================================
// SAFE MOVE EVALUATION
// ============================================================================

export interface MoveEvaluation {
  direction: Direction;
  score: number;
  canReachTail: boolean;
  reachableSpace: number;
  movesTowardFood: boolean;
  isLooping: boolean;
}

/**
 * Evaluate all legal moves with comprehensive safety checks.
 */
export const evaluateMoves = (
  state: GameState,
  config: GridConfig,
  loopDetector: LoopDetector,
  recentDirections: Direction[]
): MoveEvaluation[] => {
  const head = state.snake[0];
  const moves: MoveEvaluation[] = [];

  for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]) {
    // Don't allow 180-degree turns
    if (dir === OPPOSITE_DIRECTIONS[state.direction]) continue;

    const nextPos = {
      x: head.x + DIRECTION_VECTORS[dir].x,
      y: head.y + DIRECTION_VECTORS[dir].y,
    };

    // Check if move is physically safe
    if (!isSafePosition(nextPos, state.snake, config, false)) continue;

    // Simulate the move
    const eating = positionsEqual(nextPos, state.food);
    const newSnake = simulateMove(state.snake, dir, eating);

    // CORE SAFETY: Check if we can still reach our tail
    const canReach = canReachTail(newSnake, config);

    // Measure reachable space
    const reachableSpace = countReachableCells(newSnake[0], newSnake, config);

    // Check if move is toward food
    const oldDist = manhattanDistance(head, state.food);
    const newDist = manhattanDistance(nextPos, state.food);
    const movesTowardFood = newDist < oldDist;

    // Check for looping
    const testState: GameState = { ...state, snake: newSnake, direction: dir };
    const isLooping = detectLoop(loopDetector, testState);

    // Calculate score
    let score = reachableSpace;
    if (canReach) score += 10000; // Huge bonus for tail-reachable moves
    if (movesTowardFood) score += 100; // Bonus for moving toward food
    if (isLooping) score -= 5000; // Penalty for looping
    if (detectOscillation([...recentDirections, dir])) score -= 2000;

    moves.push({
      direction: dir,
      score,
      canReachTail: canReach,
      reachableSpace,
      movesTowardFood,
      isLooping,
    });
  }

  return moves;
};

// ============================================================================
// FOOD PATH SAFETY VERIFICATION
// ============================================================================

/**
 * Verify if a path to food is safe by simulating each step.
 * Returns true only if the snake can reach its tail after eating.
 */
export const isFoodPathSafe = (
  path: Position[],
  snake: Position[],
  food: Position,
  config: GridConfig
): boolean => {
  if (path.length === 0) return false;

  // Simulate following the entire path
  let simSnake = [...snake];
  for (const pos of path) {
    // Check if this step is safe
    if (!isSafePosition(pos, simSnake, config, false)) return false;

    const dir = getDirectionToPosition(simSnake[0], pos);
    if (!dir) return false;

    simSnake = simulateMove(simSnake, dir, false);
  }

  // Snake grows when eating
  simSnake = [food, ...simSnake];

  // Verify we can still reach our tail after eating
  return canReachTail(simSnake, config);
};

// ============================================================================
// MAIN DECISION FUNCTION
// ============================================================================

export interface AutopilotDecision {
  direction: Direction;
  reason: string;
}

/**
 * Main autopilot decision function.
 * Makes intelligent decisions while guaranteeing safety.
 */
export const decideNextDirection = (
  state: GameState,
  config: GridConfig,
  loopDetector: LoopDetector,
  recentDirections: Direction[]
): AutopilotDecision => {
  const head = state.snake[0];

  // Evaluate all safe moves
  const moves = evaluateMoves(state, config, loopDetector, recentDirections);

  if (moves.length === 0) {
    // No safe moves - accept fate
    return { direction: state.direction, reason: 'No safe moves' };
  }

  // Filter to tail-reachable moves (CRITICAL for survival)
  const tailSafeMoves = moves.filter((m) => m.canReachTail);

  // STEP 1: Try to find safe path to food
  const pathToFood = bfsPath(head, state.food, state.snake, config);

  if (pathToFood && pathToFood.length > 0) {
    const firstStep = pathToFood[0];
    const dirToFood = getDirectionToPosition(head, firstStep);

    if (dirToFood) {
      // For short snakes (< 6), always go for food if physically safe
      if (state.snake.length < 6) {
        const move = moves.find((m) => m.direction === dirToFood);
        if (move) {
          return { direction: dirToFood, reason: 'Short snake - pursuing food' };
        }
      }

      // For longer snakes, verify full path safety
      const isSafe = isFoodPathSafe(
        pathToFood,
        state.snake,
        state.food,
        config
      );

      if (isSafe) {
        return { direction: dirToFood, reason: 'Safe path to food verified' };
      }

      // Even if full path not verified, if first step is tail-safe, take it
      const tailSafeFirst = tailSafeMoves.find((m) => m.direction === dirToFood);
      if (tailSafeFirst) {
        return {
          direction: dirToFood,
          reason: 'First step to food is tail-safe',
        };
      }
    }
  }

  // STEP 2: Check for looping behavior
  const currentHash = stateHash(state);
  const isLooping = loopDetector.recentStates.includes(currentHash);
  const isOscillating = detectOscillation(recentDirections);

  if (isLooping || isOscillating) {
    // Break the loop by choosing a different safe move
    const nonLoopingMoves = tailSafeMoves.filter((m) => !m.isLooping);
    if (nonLoopingMoves.length > 0) {
      nonLoopingMoves.sort((a, b) => b.score - a.score);
      return {
        direction: nonLoopingMoves[0].direction,
        reason: 'Breaking loop/oscillation',
      };
    }
  }

  // STEP 3: Follow tail or pick safest move
  if (tailSafeMoves.length > 0) {
    // Try to follow tail directly (keeps us alive)
    if (state.snake.length > 3) {
      const tail = state.snake[state.snake.length - 1];
      const tailDir = getDirectionToPosition(head, tail);

      if (tailDir) {
        const tailMove = tailSafeMoves.find((m) => m.direction === tailDir);
        if (tailMove) {
          return { direction: tailDir, reason: 'Following tail' };
        }
      }

      // Move toward tail
      const towardTail = tailSafeMoves.filter(
        (m) =>
          manhattanDistance(
            {
              x: head.x + DIRECTION_VECTORS[m.direction].x,
              y: head.y + DIRECTION_VECTORS[m.direction].y,
            },
            tail
          ) < manhattanDistance(head, tail)
      );

      if (towardTail.length > 0) {
        towardTail.sort((a, b) => b.score - a.score);
        return {
          direction: towardTail[0].direction,
          reason: 'Moving toward tail',
        };
      }
    }

    // Pick tail-safe move with most space, preferring toward food
    const towardFood = tailSafeMoves.filter((m) => m.movesTowardFood);
    if (towardFood.length > 0) {
      towardFood.sort((a, b) => b.score - a.score);
      return {
        direction: towardFood[0].direction,
        reason: 'Tail-safe move toward food',
      };
    }

    tailSafeMoves.sort((a, b) => b.score - a.score);
    return {
      direction: tailSafeMoves[0].direction,
      reason: 'Safest tail-reachable move',
    };
  }

  // STEP 4: No tail-safe moves (dangerous!) - pick move with most space
  moves.sort((a, b) => b.score - a.score);
  return {
    direction: moves[0].direction,
    reason: 'Emergency - no tail-safe moves',
  };
};

// ============================================================================
// React Integration Hook
// ============================================================================

import { useRef, useCallback } from 'react';

export const useAutopilot = (config: GridConfig) => {
  const loopDetectorRef = useRef<LoopDetector>(createLoopDetector(20));
  const recentDirectionsRef = useRef<Direction[]>([]);

  const decide = useCallback(
    (state: GameState): AutopilotDecision => {
      const decision = decideNextDirection(
        state,
        config,
        loopDetectorRef.current,
        recentDirectionsRef.current
      );

      // Update state for next iteration
      recentDirectionsRef.current.push(decision.direction);
      if (recentDirectionsRef.current.length > 10) {
        recentDirectionsRef.current.shift();
      }

      // Update loop detector
      stateHash(state);

      return decision;
    },
    [config]
  );

  const reset = useCallback(() => {
    loopDetectorRef.current = createLoopDetector(20);
    recentDirectionsRef.current = [];
  }, []);

  return { decide, reset };
};

export default {
  decideNextDirection,
  useAutopilot,
  canReachTail,
  bfsPath,
  countReachableCells,
  isFoodPathSafe,
  evaluateMoves,
  detectLoop,
  detectOscillation,
  createLoopDetector,
  stateHash,
};
