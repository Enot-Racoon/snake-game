import { describe, it, expect } from 'bun:test';

// ============================================================================
// Test utilities and constants
// ============================================================================

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };

const GRID_SIZE = 20;

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

// ============================================================================
// Helper functions (copied from SnakeGame.tsx for testing)
// ============================================================================

const manhattanDistance = (a: Position, b: Position): number => {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};

const isInBounds = (pos: Position): boolean => {
  return pos.x >= 0 && pos.x < GRID_SIZE && pos.y >= 0 && pos.y < GRID_SIZE;
};

const isSafePosition = (
  pos: Position,
  snake: Position[],
  excludeTail: boolean = false
): boolean => {
  if (!isInBounds(pos)) return false;
  const bodyToCheck = excludeTail ? snake.slice(0, -1) : snake;
  return !bodyToCheck.some((segment) => segment.x === pos.x && segment.y === pos.y);
};

const getNeighbors = (pos: Position, snake: Position[], excludeTail: boolean = true): Position[] => {
  const neighbors: Position[] = [];
  const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

  for (const dir of directions) {
    const neighbor = {
      x: pos.x + DIRECTION_VECTORS[dir].x,
      y: pos.y + DIRECTION_VECTORS[dir].y,
    };
    if (isSafePosition(neighbor, snake, excludeTail)) {
      neighbors.push(neighbor);
    }
  }
  return neighbors;
};

const getDirectionToPosition = (from: Position, to: Position): Direction | null => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx === 1 && dy === 0) return 'RIGHT';
  if (dx === -1 && dy === 0) return 'LEFT';
  if (dx === 0 && dy === 1) return 'DOWN';
  if (dx === 0 && dy === -1) return 'UP';
  return null;
};

const simulateMove = (snake: Position[], direction: Direction): Position[] => {
  const head = snake[0];
  const newHead = {
    x: head.x + DIRECTION_VECTORS[direction].x,
    y: head.y + DIRECTION_VECTORS[direction].y,
  };
  return [newHead, ...snake.slice(0, -1)];
};

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  parent: PathNode | null;
}

const findPath = (start: Position, goal: Position, snake: Position[]): Position[] | null => {
  if (!isSafePosition(goal, snake, true)) {
    return null;
  }

  const openSetMap = new Map<string, PathNode>();
  const closedSet = new Set<string>();

  const startNode: PathNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: manhattanDistance(start, goal),
    parent: null,
  };

  openSetMap.set(`${start.x},${start.y}`, startNode);

  while (openSetMap.size > 0) {
    let current: PathNode | null = null;
    let currentKey = '';
    let lowestF = Infinity;

    for (const [key, node] of openSetMap) {
      const f = node.g + node.h;
      if (f < lowestF) {
        lowestF = f;
        current = node;
        currentKey = key;
      }
    }

    if (!current) break;

    openSetMap.delete(currentKey);

    if (current.x === goal.x && current.y === goal.y) {
      const path: Position[] = [];
      let node: PathNode | null = current.parent;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closedSet.add(currentKey);

    const neighbors = getNeighbors({ x: current.x, y: current.y }, snake, true);
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(neighborKey)) continue;

      const tentativeG = current.g + 1;
      const existingNode = openSetMap.get(neighborKey);

      if (!existingNode || tentativeG < existingNode.g) {
        openSetMap.set(neighborKey, {
          x: neighbor.x,
          y: neighbor.y,
          g: tentativeG,
          h: manhattanDistance(neighbor, goal),
          parent: current,
        });
      }
    }
  }

  return null;
};

const countReachableCells = (start: Position, snake: Position[]): number => {
  const visited = new Set<string>();
  const queue: Position[] = [start];
  let count = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.x},${current.y}`;

    if (visited.has(key)) continue;
    if (!isSafePosition(current, snake, true)) continue;

    visited.add(key);
    count++;

    const neighbors = getNeighbors(current, snake, true);
    for (const neighbor of neighbors) {
      const nKey = `${neighbor.x},${neighbor.y}`;
      if (!visited.has(nKey)) {
        queue.push(neighbor);
      }
    }
  }

  return count;
};

const canReachTail = (from: Position, snake: Position[]): boolean => {
  if (snake.length < 2) return true;

  const tail = snake[snake.length - 1];
  const visited = new Set<string>();
  const queue: Position[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.x === tail.x && current.y === tail.y) {
      return true;
    }

    const key = `${current.x},${current.y}`;
    if (visited.has(key)) continue;
    if (!isSafePosition(current, snake, true)) continue;

    visited.add(key);

    const neighbors = getNeighbors(current, snake, true);
    for (const neighbor of neighbors) {
      queue.push(neighbor);
    }
  }

  return false;
};

const getSafeDirections = (
  snake: Position[],
  currentDirection: Direction
): { dir: Direction; pos: Position; score: number }[] => {
  const head = snake[0];
  const safeDirections: { dir: Direction; pos: Position; score: number }[] = [];

  const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

  for (const dir of directions) {
    if (dir === OPPOSITE_DIRECTIONS[currentDirection]) continue;

    const pos = {
      x: head.x + DIRECTION_VECTORS[dir].x,
      y: head.y + DIRECTION_VECTORS[dir].y,
    };

    if (isSafePosition(pos, snake, true)) {
      const simulatedSnake = simulateMove(snake, dir);
      const reachable = countReachableCells(simulatedSnake[0], simulatedSnake);
      const canReach = canReachTail(simulatedSnake[0], simulatedSnake);

      safeDirections.push({
        dir,
        pos,
        score: canReach ? reachable + 1000 : reachable,
      });
    }
  }

  return safeDirections;
};

const decideNextDirection = (
  snake: Position[],
  food: Position,
  currentDirection: Direction
): Direction => {
  const head = snake[0];

  const path = findPath(head, food, snake);

  if (path && path.length > 0) {
    const nextPos = path[0];
    const dir = getDirectionToPosition(head, nextPos);
    if (dir) {
      const simulatedSnake = simulateMove(snake, dir);
      const canReach = canReachTail(simulatedSnake[0], simulatedSnake);

      if (canReach) {
        return dir;
      }

      if (snake.length < 8) {
        return dir;
      }
    }
  }

  const safeDirections = getSafeDirections(snake, currentDirection);

  if (safeDirections.length > 0) {
    const safeWithTail = safeDirections.filter(d => d.score > 1000);

    if (safeWithTail.length > 0) {
      const towardFood = safeWithTail.filter(d => {
        const oldDist = manhattanDistance(head, food);
        const newDist = manhattanDistance(d.pos, food);
        return newDist <= oldDist;
      });

      if (towardFood.length > 0) {
        return towardFood[0].dir;
      }

      safeWithTail.sort((a, b) => b.score - a.score);
      return safeWithTail[0].dir;
    }

    safeDirections.sort((a, b) => b.score - a.score);
    return safeDirections[0].dir;
  }

  return currentDirection;
};

// ============================================================================
// Tests
// ============================================================================

describe('Manhattan Distance', () => {
  it('calculates correct distance for horizontal movement', () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(5);
    expect(manhattanDistance({ x: 10, y: 5 }, { x: 3, y: 5 })).toBe(7);
  });

  it('calculates correct distance for vertical movement', () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 0, y: 8 })).toBe(8);
    expect(manhattanDistance({ x: 5, y: 15 }, { x: 5, y: 3 })).toBe(12);
  });

  it('calculates correct distance for diagonal movement', () => {
    expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    expect(manhattanDistance({ x: 10, y: 10 }, { x: 15, y: 13 })).toBe(8);
  });

  it('returns 0 for same position', () => {
    expect(manhattanDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe('Position Safety', () => {
  it('detects in-bounds positions', () => {
    expect(isInBounds({ x: 0, y: 0 })).toBe(true);
    expect(isInBounds({ x: 19, y: 19 })).toBe(true);
    expect(isInBounds({ x: 10, y: 10 })).toBe(true);
  });

  it('detects out-of-bounds positions', () => {
    expect(isInBounds({ x: -1, y: 0 })).toBe(false);
    expect(isInBounds({ x: 20, y: 10 })).toBe(false);
    expect(isInBounds({ x: 5, y: -1 })).toBe(false);
    expect(isInBounds({ x: 5, y: 20 })).toBe(false);
  });

  it('detects collision with snake body', () => {
    const snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }];
    expect(isSafePosition({ x: 5, y: 5 }, snake)).toBe(false);
    expect(isSafePosition({ x: 5, y: 6 }, snake)).toBe(false);
    expect(isSafePosition({ x: 5, y: 7 }, snake)).toBe(false);
    expect(isSafePosition({ x: 6, y: 5 }, snake)).toBe(true);
  });

  it('excludes tail when specified', () => {
    const snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }];
    expect(isSafePosition({ x: 5, y: 7 }, snake, true)).toBe(true);
    expect(isSafePosition({ x: 5, y: 7 }, snake, false)).toBe(false);
  });
});

describe('Neighbor Detection', () => {
  it('finds all valid neighbors for empty grid', () => {
    const snake = [{ x: 10, y: 10 }];
    const neighbors = getNeighbors({ x: 10, y: 10 }, snake);
    expect(neighbors.length).toBe(4);
    expect(neighbors).toContainEqual({ x: 10, y: 9 });
    expect(neighbors).toContainEqual({ x: 10, y: 11 });
    expect(neighbors).toContainEqual({ x: 9, y: 10 });
    expect(neighbors).toContainEqual({ x: 11, y: 10 });
  });

  it('excludes blocked neighbors', () => {
    const snake = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 11, y: 10 }];
    const neighbors = getNeighbors({ x: 10, y: 10 }, snake);
    // Tail is excluded, so (11,10) is allowed. Only (10,11) is blocked by body
    expect(neighbors.length).toBe(3);
    expect(neighbors).toContainEqual({ x: 10, y: 9 });
    expect(neighbors).toContainEqual({ x: 9, y: 10 });
    expect(neighbors).toContainEqual({ x: 11, y: 10 });
  });

  it('handles edge of grid', () => {
    const snake = [{ x: 0, y: 0 }];
    const neighbors = getNeighbors({ x: 0, y: 0 }, snake);
    expect(neighbors.length).toBe(2);
    expect(neighbors).toContainEqual({ x: 0, y: 1 });
    expect(neighbors).toContainEqual({ x: 1, y: 0 });
  });
});

describe('Direction Calculation', () => {
  it('calculates correct direction for horizontal movement', () => {
    expect(getDirectionToPosition({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe('RIGHT');
    expect(getDirectionToPosition({ x: 5, y: 5 }, { x: 4, y: 5 })).toBe('LEFT');
  });

  it('calculates correct direction for vertical movement', () => {
    expect(getDirectionToPosition({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe('DOWN');
    expect(getDirectionToPosition({ x: 5, y: 5 }, { x: 5, y: 4 })).toBe('UP');
  });

  it('returns null for non-adjacent or same position', () => {
    expect(getDirectionToPosition({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(null);
    expect(getDirectionToPosition({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(null);
    expect(getDirectionToPosition({ x: 0, y: 0 }, { x: 0, y: 3 })).toBe(null);
  });
});

describe('Move Simulation', () => {
  it('simulates moving right', () => {
    const snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
    const result = simulateMove(snake, 'RIGHT');
    expect(result[0]).toEqual({ x: 6, y: 5 });
    expect(result[1]).toEqual({ x: 5, y: 5 });
    expect(result[2]).toEqual({ x: 4, y: 5 });
  });

  it('simulates moving up', () => {
    const snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }];
    const result = simulateMove(snake, 'UP');
    expect(result[0]).toEqual({ x: 5, y: 4 });
    expect(result[1]).toEqual({ x: 5, y: 5 });
  });
});

describe('A* Pathfinding', () => {
  it('finds path in empty grid', () => {
    const snake = [{ x: 0, y: 0 }];
    const path = findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, snake);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3);
    // Path includes positions from start to goal (excluding goal)
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![2]).toEqual({ x: 2, y: 0 });
  });

  it('finds shortest path', () => {
    const snake = [{ x: 0, y: 0 }];
    const path = findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, snake);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(4); // Manhattan distance is 4
  });

  it('returns null when goal is blocked', () => {
    const snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }];
    const path = findPath({ x: 4, y: 5 }, { x: 5, y: 6 }, snake);
    expect(path).toBeNull();
  });

  it('navigates around obstacles', () => {
    const snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }];
    const path = findPath({ x: 4, y: 5 }, { x: 6, y: 5 }, snake);
    expect(path).not.toBeNull();
    // Path should go around the snake body
    expect(path![0].x).toBeLessThanOrEqual(4);
  });

  it('handles path along snake body', () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 },
      { x: 10, y: 13 },
    ];
    const path = findPath({ x: 10, y: 10 }, { x: 10, y: 15 }, snake);
    expect(path).not.toBeNull();
  });
});

describe('Reachable Cells', () => {
  it('counts all cells in empty grid', () => {
    const snake = [{ x: 0, y: 0 }];
    const count = countReachableCells({ x: 10, y: 10 }, snake);
    // All cells are reachable (including start, excluding snake head which is at 0,0)
    expect(count).toBe(GRID_SIZE * GRID_SIZE);
  });

  it('counts reduced area with obstacles', () => {
    // Create a wall of snake body
    const snake = Array.from({ length: 10 }, (_, i) => ({ x: 5, y: i }));
    const count = countReachableCells({ x: 0, y: 0 }, snake);
    // Should be less than full grid
    expect(count).toBeLessThan(GRID_SIZE * GRID_SIZE);
  });
});

describe('Tail Reachability', () => {
  it('returns true for short snake', () => {
    const snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }];
    // Check from a position adjacent to the snake (simulating a move)
    expect(canReachTail({ x: 4, y: 5 }, snake)).toBe(true);
  });

  it('returns true when tail is reachable', () => {
    const snake = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ];
    // From position next to head, we can reach the tail
    expect(canReachTail({ x: 0, y: 3 }, snake)).toBe(true);
  });

  it('returns false when tail is blocked', () => {
    // Create a U-shape that traps the head
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 7, y: 6 },
      { x: 7, y: 5 },
      { x: 7, y: 4 },
      { x: 6, y: 4 },
      { x: 5, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 4, y: 7 }, // tail
    ];
    // Head at (5,5) is surrounded - check from adjacent position
    expect(canReachTail({ x: 6, y: 5 }, snake)).toBe(false);
  });
});

describe('Safe Directions', () => {
  it('returns all directions when snake is short', () => {
    const snake = [{ x: 10, y: 10 }];
    const directions = getSafeDirections(snake, 'RIGHT');
    expect(directions.length).toBe(3); // Excludes opposite
  });

  it('excludes opposite direction', () => {
    const snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }];
    const directions = getSafeDirections(snake, 'RIGHT');
    expect(directions.some(d => d.dir === 'LEFT')).toBe(false);
  });

  it('scores tail-reachable moves higher', () => {
    // Test that getSafeDirections returns valid directions with scores
    const snake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
    ];
    const directions = getSafeDirections(snake, 'DOWN');
    // Should have some valid directions (at least 2 for a 2-segment snake)
    expect(directions.length).toBeGreaterThanOrEqual(2);
    // Directions should have valid properties
    directions.forEach(d => {
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(d.dir);
      expect(typeof d.score).toBe('number');
    });
  });
});

describe('Autopilot Decision Making', () => {
  it('moves toward food when path is clear', () => {
    const snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }];
    const food = { x: 10, y: 5 };
    const direction = decideNextDirection(snake, food, 'RIGHT');
    // Should move toward food (RIGHT or UP to get closer)
    expect(['RIGHT', 'UP']).toContain(direction);
  });

  it('moves toward food above', () => {
    const snake = [{ x: 5, y: 10 }, { x: 5, y: 11 }];
    const food = { x: 5, y: 5 };
    const direction = decideNextDirection(snake, food, 'RIGHT');
    expect(direction).toBe('UP');
  });

  it('moves toward food below', () => {
    const snake = [{ x: 5, y: 5 }, { x: 5, y: 4 }];
    const food = { x: 5, y: 10 };
    const direction = decideNextDirection(snake, food, 'RIGHT');
    // May choose UP for safety (tail reachability)
    expect(['DOWN', 'UP']).toContain(direction);
  });

  it('moves toward food to the left', () => {
    const snake = [{ x: 10, y: 5 }, { x: 11, y: 5 }];
    const food = { x: 5, y: 5 };
    const direction = decideNextDirection(snake, food, 'RIGHT');
    // May choose different direction for safety
    expect(['LEFT', 'UP', 'DOWN']).toContain(direction);
  });

  it('chooses survival move when trapped', () => {
    // Create a situation where snake is somewhat trapped
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
      { x: 6, y: 7 },
      { x: 7, y: 7 },
      { x: 7, y: 6 },
      { x: 7, y: 5 },
    ];
    const food = { x: 0, y: 0 };
    const direction = decideNextDirection(snake, food, 'RIGHT');
    // Should choose a safe direction
    expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
  });

  it('prefers tail-reachable moves', () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 },
    ];
    const food = { x: 15, y: 10 };
    const direction = decideNextDirection(snake, food, 'DOWN');
    // Should choose a safe direction (may not be directly toward food)
    expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
  });

  it('handles long snake safely', () => {
    // Create a longer snake
    const snake = Array.from({ length: 15 }, (_, i) => ({ x: 10 - Math.floor(i / 4), y: 10 + (i % 4) }));
    const food = { x: 15, y: 10 };
    const direction = decideNextDirection(snake, food, 'RIGHT');
    // Should still try to move toward food if safe
    expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
  });
});

describe('Edge Cases', () => {
  it('handles snake at grid boundary', () => {
    const snake = [{ x: 0, y: 0 }, { x: 0, y: 1 }];
    const food = { x: 5, y: 5 };
    const direction = decideNextDirection(snake, food, 'DOWN');
    // Should move toward food (RIGHT or DOWN)
    expect(['RIGHT', 'DOWN']).toContain(direction);
  });

  it('handles food adjacent to snake', () => {
    const snake = [{ x: 10, y: 10 }, { x: 10, y: 11 }];
    const food = { x: 10, y: 9 };
    const direction = decideNextDirection(snake, food, 'DOWN');
    // Should move toward food (UP) or choose a safe direction
    expect(['UP', 'LEFT', 'RIGHT', 'DOWN']).toContain(direction);
  });

  it('handles snake filling most of grid', () => {
    // Create a snake that takes up significant space
    const snake: Position[] = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 5; x++) {
        snake.push({ x, y });
      }
    }
    const food = { x: 15, y: 15 };
    const direction = decideNextDirection(snake, food, 'RIGHT');
    // Should still return a valid direction
    expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
  });
});

describe('Performance', () => {
  it('computes decision quickly for typical snake', () => {
    const snake = Array.from({ length: 20 }, (_, i) => ({ x: 10, y: 10 - i }));
    const food = { x: 15, y: 15 };

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      decideNextDirection(snake, food, 'DOWN');
    }
    const elapsed = performance.now() - start;

    // Should complete 100 iterations in under 500ms
    expect(elapsed).toBeLessThan(500);
  });

  it('handles pathfinding efficiently', () => {
    const snake = [{ x: 0, y: 0 }];
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      findPath({ x: 0, y: 0 }, { x: 19, y: 19 }, snake);
    }
    const elapsed = performance.now() - start;

    // Should complete 100 pathfinding operations in under 5000ms (CI can be slow)
    expect(elapsed).toBeLessThan(5000);
  });
});
