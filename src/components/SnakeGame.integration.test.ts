import { describe, it, expect } from 'bun:test';

// ============================================================================
// Integration Test - Full autopilot simulation with comprehensive scenarios
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

const manhattanDistance = (a: Position, b: Position): number => {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};

const isInBounds = (pos: Position): boolean => {
  return pos.x >= 0 && pos.x < GRID_SIZE && pos.y >= 0 && pos.y < GRID_SIZE;
};

const isSafePosition = (pos: Position, snake: Position[], excludeTail: boolean = false): boolean => {
  if (!isInBounds(pos)) return false;
  const bodyToCheck = excludeTail ? snake.slice(0, -1) : snake;
  return !bodyToCheck.some((segment) => segment.x === pos.x && segment.y === pos.y);
};

const getNeighbors = (pos: Position, snake: Position[], excludeTail: boolean = true): Position[] => {
  const neighbors: Position[] = [];
  for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]) {
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
      while (node && node.parent !== null) {
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
      if (!visited.has(`${neighbor.x},${neighbor.y}`)) {
        queue.push(neighbor);
      }
    }
  }
  return count;
};

const canReachTail = (from: Position, snake: Position[]): boolean => {
  if (snake.length < 3) return true;
  const tail = snake[snake.length - 1];
  const visited = new Set<string>();
  const queue: Position[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === tail.x && current.y === tail.y) return true;
    const key = `${current.x},${current.y}`;
    if (visited.has(key)) continue;
    if (!isSafePosition(current, snake, true)) continue;
    visited.add(key);
    const neighbors = getNeighbors(current, snake, true);
    for (const neighbor of neighbors) queue.push(neighbor);
  }
  return false;
};

const getSafeDirections = (snake: Position[], currentDirection: Direction) => {
  const head = snake[0];
  const safeDirections: { dir: Direction; pos: Position; score: number; canReachTail: boolean }[] = [];
  for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]) {
    if (dir === OPPOSITE_DIRECTIONS[currentDirection]) continue;
    const pos = { x: head.x + DIRECTION_VECTORS[dir].x, y: head.y + DIRECTION_VECTORS[dir].y };
    if (isSafePosition(pos, snake, true)) {
      const simulatedSnake = [pos, ...snake.slice(0, -1)];
      const reachable = countReachableCells(simulatedSnake[0], simulatedSnake);
      const canReach = canReachTail(simulatedSnake[0], simulatedSnake);
      safeDirections.push({ dir, pos, score: canReach ? reachable + 10000 : reachable, canReachTail: canReach });
    }
  }
  return safeDirections;
};

const decideNextDirection = (snake: Position[], food: Position, currentDirection: Direction): Direction => {
  const head = snake[0], safeMoves = getSafeDirections(snake, currentDirection);
  if (safeMoves.length === 0) return currentDirection;
  const tailSafe = safeMoves.filter(m => m.canReachTail), path = findPath(head, food, snake);

  // STEP 1: Try to eat food
  if (path && path.length > 0) {
    const dir = getDirectionToPosition(head, path[0]);
    if (dir) {
      if (snake.length < 6 && safeMoves.some(m => m.dir === dir)) return dir;
      if (tailSafe.some(m => m.dir === dir)) return dir;
    }
  }

  // STEP 2: Follow tail to survive
  if (tailSafe.length > 0) {
    if (snake.length > 2) {
      const tail = snake[snake.length - 1], tailDir = getDirectionToPosition(head, tail);
      if (tailDir && tailSafe.some(m => m.dir === tailDir)) return tailDir;
      const towardTail = tailSafe.filter(d => manhattanDistance(d.pos, tail) < manhattanDistance(head, tail));
      if (towardTail.length > 0) { towardTail.sort((a, b) => b.score - a.score); return towardTail[0].dir; }
    }
    tailSafe.sort((a, b) => b.score - a.score);
    return tailSafe[0].dir;
  }

  safeMoves.sort((a, b) => b.score - a.score);
  return safeMoves[0].dir;
};

const spawnFood = (snake: Position[]): Position => {
  let food: Position;
  do {
    food = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(s => s.x === food.x && s.y === food.y));
  return food;
};

// ============================================================================
// Comprehensive Integration Tests
// ============================================================================

describe('Autopilot Integration - Comprehensive Tests', () => {
  
  describe('Basic Functionality', () => {
    it('should reach nearby food', () => {
      const snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }];
      const food = { x: 8, y: 5 };
      const direction = 'RIGHT';
      
      let currentSnake = [...snake];
      let currentDirection = direction;
      let foodEaten = false;
      
      for (let i = 0; i < 20; i++) {
        currentDirection = decideNextDirection(currentSnake, food, currentDirection);
        const newHead = {
          x: currentSnake[0].x + DIRECTION_VECTORS[currentDirection].x,
          y: currentSnake[0].y + DIRECTION_VECTORS[currentDirection].y,
        };
        
        expect(isInBounds(newHead)).toBe(true);
        expect(currentSnake.slice(0, -1).some(s => s.x === newHead.x && s.y === newHead.y)).toBe(false);
        
        currentSnake = [newHead, ...currentSnake.slice(0, -1)];
        
        if (newHead.x === food.x && newHead.y === food.y) {
          foodEaten = true;
          break;
        }
      }
      
      expect(foodEaten).toBe(true);
    });

    it('should navigate for 100 steps without dying', () => {
      let snake: Position[] = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
      let food = spawnFood(snake);
      let direction = 'RIGHT';
      let steps = 0;

      for (let step = 0; step < 100; step++) {
        direction = decideNextDirection(snake, food, direction);
        const newHead = {
          x: snake[0].x + DIRECTION_VECTORS[direction].x,
          y: snake[0].y + DIRECTION_VECTORS[direction].y,
        };

        expect(isInBounds(newHead)).toBe(true);
        expect(snake.slice(0, -1).some(s => s.x === newHead.x && s.y === newHead.y)).toBe(false);

        snake = [newHead, ...snake.slice(0, -1)];
        steps++;

        if (newHead.x === food.x && newHead.y === food.y) {
          snake = [newHead, ...snake];
          food = spawnFood(snake);
        }
      }

      expect(steps).toBe(100);
    });
  });

  describe('Long-term Survival', () => {
    it('should survive 500 steps with growing snake', () => {
      let snake: Position[] = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
      let food = spawnFood(snake);
      let direction = 'RIGHT';
      let deaths = 0;
      let foodEaten = 0;
      let maxSnakeLength = snake.length;
      
      for (let step = 0; step < 500; step++) {
        direction = decideNextDirection(snake, food, direction);
        const newHead = {
          x: snake[0].x + DIRECTION_VECTORS[direction].x,
          y: snake[0].y + DIRECTION_VECTORS[direction].y,
        };
        
        // Check for death
        if (!isInBounds(newHead) || snake.slice(0, -1).some(s => s.x === newHead.x && s.y === newHead.y)) {
          deaths++;
          break; // Test fails if we die
        }
        
        snake = [newHead, ...snake.slice(0, -1)];
        
        if (newHead.x === food.x && newHead.y === food.y) {
          foodEaten++;
          snake = [newHead, ...snake];
          maxSnakeLength = Math.max(maxSnakeLength, snake.length);
          food = spawnFood(snake);
        }
      }
      
      expect(deaths).toBe(0);
      expect(foodEaten).toBeGreaterThan(1); // Should eat at least 2 food
    });

    it('should survive 1000+ steps (long-term test)', () => {
      let snake: Position[] = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
      let food = spawnFood(snake);
      let direction = 'RIGHT';
      let deaths = 0, foodEaten = 0, maxSnakeLength = snake.length;
      for (let step = 0; step < 1000; step++) {
        direction = decideNextDirection(snake, food, direction);
        const newHead = { x: snake[0].x + DIRECTION_VECTORS[direction].x, y: snake[0].y + DIRECTION_VECTORS[direction].y };
        if (!isInBounds(newHead) || snake.slice(0, -1).some(s => s.x === newHead.x && s.y === newHead.y)) { deaths++; break; }
        snake = [newHead, ...snake.slice(0, -1)];
        if (newHead.x === food.x && newHead.y === food.y) {
          foodEaten++;
          snake = [newHead, ...snake];
          maxSnakeLength = Math.max(maxSnakeLength, snake.length);
          food = spawnFood(snake);
        }
      }
      expect(deaths).toBe(0);
      expect(foodEaten).toBeGreaterThan(1); // Should eat at least 2 food
      console.log(`Survived 1000 steps, ate ${foodEaten} food, max length: ${maxSnakeLength}`);
    });

    it('should handle snake length up to 20 segments', () => {
      // Create a snake of length 15
      let snake: Position[] = [];
      for (let i = 0; i < 15; i++) {
        snake.push({ x: 10, y: 10 - i });
      }
      
      let food = spawnFood(snake);
      let direction = 'DOWN';
      let survived = 0;
      
      for (let i = 0; i < 100; i++) {
        direction = decideNextDirection(snake, food, direction);
        const newHead = {
          x: snake[0].x + DIRECTION_VECTORS[direction].x,
          y: snake[0].y + DIRECTION_VECTORS[direction].y,
        };
        
        if (!isInBounds(newHead)) break;
        if (snake.slice(0, -1).some(s => s.x === newHead.x && s.y === newHead.y)) break;
        
        snake = [newHead, ...snake.slice(0, -1)];
        survived++;
        
        if (newHead.x === food.x && newHead.y === food.y) {
          snake = [newHead, ...snake];
          if (snake.length >= 20) break; // Test passed if we reach 20
          food = spawnFood(snake);
        }
      }
      
      // Should survive at least 50 steps
      expect(survived).toBeGreaterThan(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle food in corner', () => {
      const snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }];
      const food = { x: 0, y: 0 };
      const direction = 'RIGHT';
      let currentSnake = [...snake];
      let currentDirection = direction;
      let survived = 0;
      for (let i = 0; i < 50; i++) {
        currentDirection = decideNextDirection(currentSnake, food, currentDirection);
        const newHead = { x: currentSnake[0].x + DIRECTION_VECTORS[currentDirection].x, y: currentSnake[0].y + DIRECTION_VECTORS[currentDirection].y };
        expect(isInBounds(newHead)).toBe(true);
        currentSnake = [newHead, ...currentSnake.slice(0, -1)];
        survived++;
        if (newHead.x === food.x && newHead.y === food.y) break;
      }
      expect(survived).toBeGreaterThan(30);
    });

    it('should handle trapped situation', () => {
      // Create a U-shaped trap scenario
      const snake = [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 7, y: 6 },
        { x: 7, y: 5 },
        { x: 7, y: 4 },
        { x: 6, y: 4 },
        { x: 5, y: 4 },
      ];
      const food = { x: 3, y: 5 };
      const direction = 'RIGHT';
      
      let currentSnake = [...snake];
      let currentDirection = direction;
      let survived = 0;
      
      for (let i = 0; i < 20; i++) {
        currentDirection = decideNextDirection(currentSnake, food, currentDirection);
        const newHead = {
          x: currentSnake[0].x + DIRECTION_VECTORS[currentDirection].x,
          y: currentSnake[0].y + DIRECTION_VECTORS[currentDirection].y,
        };
        
        if (!isInBounds(newHead)) break;
        if (currentSnake.slice(0, -1).some(s => s.x === newHead.x && s.y === newHead.y)) break;
        
        currentSnake = [newHead, ...currentSnake.slice(0, -1)];
        survived++;
      }
      
      // Should survive at least 10 steps even in tricky situation
      expect(survived).toBeGreaterThan(10);
    });

    it('should not oscillate infinitely', () => {
      const snake = [{ x: 10, y: 10 }, { x: 10, y: 11 }];
      const food = { x: 15, y: 10 };
      const direction = 'RIGHT';
      
      let currentSnake = [...snake];
      let currentDirection = direction;
      const directions: Direction[] = [];
      
      for (let i = 0; i < 20; i++) {
        currentDirection = decideNextDirection(currentSnake, food, currentDirection);
        directions.push(currentDirection);
        
        const newHead = {
          x: currentSnake[0].x + DIRECTION_VECTORS[currentDirection].x,
          y: currentSnake[0].y + DIRECTION_VECTORS[currentDirection].y,
        };
        
        currentSnake = [newHead, ...currentSnake.slice(0, -1)];
      }
      
      // Check that we're not just oscillating between 2 directions
      const uniqueDirections = new Set(directions);
      expect(uniqueDirections.size).toBeGreaterThan(1);
      
      // Should generally move toward food (more RIGHT than LEFT)
      const rightCount = directions.filter(d => d === 'RIGHT').length;
      const leftCount = directions.filter(d => d === 'LEFT').length;
      expect(rightCount).toBeGreaterThanOrEqual(leftCount);
    });
  });

  describe('Performance', () => {
    it('should make decisions quickly (< 10ms per decision)', () => {
      const snake: Position[] = [];
      for (let i = 0; i < 20; i++) {
        snake.push({ x: 10, y: 10 - i });
      }
      const food = { x: 15, y: 15 };
      
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        decideNextDirection(snake, food, 'DOWN');
      }
      const elapsed = performance.now() - start;
      
      // Average should be < 10ms per decision
      expect(elapsed / 50).toBeLessThan(10);
    });
  });
});
