import { describe, it, expect } from 'bun:test';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };

const GRID_SIZE = 20;
const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 }, LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 },
};
const OPPOSITE_DIRECTIONS: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
const manhattanDistance = (a: Position, b: Position) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const isInBounds = (pos: Position) => pos.x >= 0 && pos.x < GRID_SIZE && pos.y >= 0 && pos.y < GRID_SIZE;
const isSafePosition = (pos: Position, snake: Position[], excludeTail = true) => {
  if (!isInBounds(pos)) return false;
  return !(excludeTail ? snake.slice(0, -1) : snake).some(s => s.x === pos.x && s.y === pos.y);
};
const getNeighbors = (pos: Position, snake: Position[]) => {
  const neighbors: Position[] = [];
  for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]) {
    const n = { x: pos.x + DIRECTION_VECTORS[dir].x, y: pos.y + DIRECTION_VECTORS[dir].y };
    if (isSafePosition(n, snake, true)) neighbors.push(n);
  }
  return neighbors;
};
const getDirectionToPosition = (from: Position, to: Position): Direction | null => {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dx === 1 && dy === 0) return 'RIGHT';
  if (dx === -1 && dy === 0) return 'LEFT';
  if (dx === 0 && dy === 1) return 'DOWN';
  if (dx === 0 && dy === -1) return 'UP';
  return null;
};

interface PathNode { x: number; y: number; g: number; h: number; parent: PathNode | null; }

const findPath = (start: Position, goal: Position, snake: Position[]): Position[] | null => {
  if (!isSafePosition(goal, snake, true)) return null;
  const openSet = new Map<string, PathNode>();
  const closedSet = new Set<string>();
  openSet.set(`${start.x},${start.y}`, { x: start.x, y: start.y, g: 0, h: manhattanDistance(start, goal), parent: null });
  while (openSet.size > 0) {
    let current: PathNode | null = null, currentKey = '', lowestF = Infinity;
    for (const [key, node] of openSet) { const f = node.g + node.h; if (f < lowestF) { lowestF = f; current = node; currentKey = key; } }
    if (!current) break;
    openSet.delete(currentKey);
    if (current.x === goal.x && current.y === goal.y) {
      const path: Position[] = []; let node: PathNode | null = current;
      while (node && node.parent) { path.unshift({ x: node.x, y: node.y }); node = node.parent; }
      return path; // Path excludes start, includes goal
    }
    closedSet.add(currentKey);
    for (const neighbor of getNeighbors({ x: current.x, y: current.y }, snake)) {
      const key = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(key)) continue;
      const tentativeG = current.g + 1, existing = openSet.get(key);
      if (!existing || tentativeG < existing.g) openSet.set(key, { x: neighbor.x, y: neighbor.y, g: tentativeG, h: manhattanDistance(neighbor, goal), parent: current });
    }
  }
  return null;
};

const countReachableCells = (start: Position, snake: Position[]) => {
  const visited = new Set<string>(), queue: Position[] = [start]; let count = 0;
  while (queue.length > 0) {
    const current = queue.shift()!, key = `${current.x},${current.y}`;
    if (visited.has(key) || !isSafePosition(current, snake, true)) continue;
    visited.add(key); count++;
    for (const n of getNeighbors(current, snake)) if (!visited.has(`${n.x},${n.y}`)) queue.push(n);
  }
  return count;
};

const canReachTail = (from: Position, snake: Position[]) => {
  if (snake.length < 3) return true;
  const tail = snake[snake.length - 1], visited = new Set<string>(), queue: Position[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === tail.x && current.y === tail.y) return true;
    const key = `${current.x},${current.y}`;
    if (visited.has(key) || !isSafePosition(current, snake, true)) continue;
    visited.add(key);
    for (const n of getNeighbors(current, snake)) queue.push(n);
  }
  return false;
};

const getSafeDirections = (snake: Position[], currentDirection: Direction) => {
  const head = snake[0], moves: { dir: Direction; pos: Position; score: number; canReachTail: boolean }[] = [];
  for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]) {
    if (dir === OPPOSITE_DIRECTIONS[currentDirection]) continue;
    const pos = { x: head.x + DIRECTION_VECTORS[dir].x, y: head.y + DIRECTION_VECTORS[dir].y };
    if (isSafePosition(pos, snake, true)) {
      const sim = [pos, ...snake.slice(0, -1)];
      const reachable = countReachableCells(sim[0], sim), canReach = canReachTail(sim[0], sim);
      moves.push({ dir, pos, score: canReach ? reachable + 10000 : reachable, canReachTail: canReach });
    }
  }
  return moves;
};

const decideNextDirection = (snake: Position[], food: Position, currentDirection: Direction): Direction => {
  const head = snake[0], safeMoves = getSafeDirections(snake, currentDirection);
  if (safeMoves.length === 0) return currentDirection;
  
  // STEP 1: ALWAYS go for food if path exists
  const path = findPath(head, food, snake);
  if (path && path.length > 0) {
    const nextPos = path[0], dir = getDirectionToPosition(head, nextPos);
    if (dir) return dir; // Always follow path!
  }
  
  // STEP 2: No path to food - follow tail (only for long snakes)
  if (snake.length > 5) {
    const tailSafe = safeMoves.filter(m => m.canReachTail);
    if (tailSafe.length > 0) {
      const tail = snake[snake.length - 1], tailDir = getDirectionToPosition(head, tail);
      if (tailDir && tailSafe.some(m => m.dir === tailDir)) return tailDir;
      const towardTail = tailSafe.filter(d => manhattanDistance(d.pos, tail) < manhattanDistance(head, tail));
      if (towardTail.length > 0) { towardTail.sort((a, b) => b.score - a.score); return towardTail[0].dir; }
      tailSafe.sort((a, b) => b.score - a.score);
      return tailSafe[0].dir;
    }
  }
  
  // STEP 3: Pick move with most space
  safeMoves.sort((a, b) => b.score - a.score);
  return safeMoves[0].dir;
};

describe('Debug Autopilot Behavior', () => {
  it('should show movement pattern for 200 steps', () => {
    let snake: Position[] = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
    let food = { x: 15, y: 10 };
    let direction = 'RIGHT';
    const directions: Direction[] = [];
    const positions: Position[] = [];
    let foodEaten = 0;
    let pathFoundCount = 0;

    for (let step = 0; step < 200; step++) {
      directions.push(direction);
      positions.push({ ...snake[0] });
      
      // Debug: check if path exists
      const path = findPath(snake[0], food, snake);
      if (path) pathFoundCount++;
      
      // Debug: check safe moves
      const sm = getSafeDirections(snake, direction);
      const tailSafe = sm.filter(m => m.canReachTail);
      if (step < 5) console.log(`Step ${step}: head=${JSON.stringify(snake[0])}, food=${JSON.stringify(food)}, path=${path ? 'yes' : 'no'}, safeMoves=${sm.map(m => m.dir).join(',')}, tailSafe=${tailSafe.map(m => m.dir).join(',')}`);
      
      direction = decideNextDirection(snake, food, direction);
      const newHead = { x: snake[0].x + DIRECTION_VECTORS[direction].x, y: snake[0].y + DIRECTION_VECTORS[direction].y };
      
      if (!isInBounds(newHead)) { console.log(`Step ${step}: Hit wall at ${JSON.stringify(newHead)}`); break; }
      if (snake.slice(0, -1).some(s => s.x === newHead.x && s.y === newHead.y)) { console.log(`Step ${step}: Hit self`); break; }
      
      snake = [newHead, ...snake.slice(0, -1)];
      
      if (newHead.x === food.x && newHead.y === food.y) {
        foodEaten++;
        snake = [newHead, ...snake];
        do { food = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) }; } while (snake.some(s => s.x === food.x && s.y === food.y));
      }
    }

    console.log(`Survived ${directions.length} steps, ate ${foodEaten} food, path found ${pathFoundCount}/${directions.length}`);
    
    // Check for oscillation
    let oscillations = 0;
    for (let i = 2; i < directions.length; i++) {
      if (directions[i] === directions[i-2] && directions[i] !== directions[i-1]) oscillations++;
    }
    console.log(`Oscillation count: ${oscillations}`);
    
    // Check direction distribution
    const dirCount: Record<string, number> = { UP: 0, DOWN: 0, LEFT: 0, RIGHT: 0 };
    directions.forEach(d => dirCount[d]++);
    console.log('Direction distribution:', dirCount);
    
    // Check position range
    const xs = positions.map(p => p.x), ys = positions.map(p => p.y);
    console.log(`X range: ${Math.min(...xs)}-${Math.max(...xs)}, Y range: ${Math.min(...ys)}-${Math.max(...ys)}`);
    
    expect(directions.length).toBeGreaterThan(100);
    expect(foodEaten).toBeGreaterThan(0);
  });
});
