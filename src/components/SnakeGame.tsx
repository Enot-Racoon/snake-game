import { useEffect, useRef, useState, useCallback } from 'react';
import { useAutopilot, type Direction, type Position, type GridConfig, type GameState } from '../autopilot/autopilot';

const CANVAS_SIZE = 400;
const GRID_SIZE = 20;
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE;
const MIN_SPEED = 5;
const MAX_SPEED = 500;
const SPEED_STEP = 10;
const INITIAL_SPEED = 150;

const GRID_CONFIG: GridConfig = { width: GRID_SIZE, height: GRID_SIZE };

// ============================================================================
// Game Component
// ============================================================================

const getRandomPosition = (snake: Position[]): Position => {
  let pos: Position;
  do {
    pos = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
};

const getInitialSnake = (): Position[] => [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState<Position[]>(getInitialSnake);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
  const [gameSpeed, setGameSpeed] = useState(INITIAL_SPEED);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snakeHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [showControls, setShowControls] = useState(false);

  // Autopilot hook
  const { decide: autopilotDecide, reset: resetAutopilot } = useAutopilot(GRID_CONFIG);

  const directionRef = useRef(direction);
  const gameLoopRef = useRef<number | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const resetGame = useCallback(() => {
    setSnake(getInitialSnake());
    setFood(getRandomPosition(getInitialSnake()));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setGameOver(false);
    setScore(0);
    setIsPaused(false);
    setGameStarted(true);
    setGameSpeed(INITIAL_SPEED);
    resetAutopilot();
  }, [resetAutopilot]);

  const increaseSpeed = useCallback(() => setGameSpeed(p => Math.max(MIN_SPEED, p - SPEED_STEP)), []);
  const decreaseSpeed = useCallback(() => setGameSpeed(p => Math.min(MAX_SPEED, p + SPEED_STEP)), []);
  const setMaxSpeed = useCallback(() => setGameSpeed(MIN_SPEED), []);
  const setMinSpeed = useCallback(() => setGameSpeed(MAX_SPEED), []);

  const getSpeedLabel = (speed: number): string => {
    const maxLog = Math.log(MAX_SPEED), minLog = Math.log(MIN_SPEED), currentLog = Math.log(speed);
    const normalized = (maxLog - currentLog) / (maxLog - minLog);
    const multiplier = Math.pow(1000, normalized);
    if (multiplier >= 1000) return 'x1000';
    if (multiplier >= 100) return `x${Math.round(multiplier)}`;
    if (multiplier >= 10) return `x${multiplier.toFixed(1)}`;
    return `x${multiplier.toFixed(2)}`;
  };

  const changeDirection = useCallback((newDirection: Direction) => {
    const currentDirection = directionRef.current;
    const opposites: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    if (opposites[newDirection] !== currentDirection) {
      setDirection(newDirection);
      directionRef.current = newDirection;
      setAutopilot(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!gameStarted && !gameOver) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) resetGame();
      return;
    }
    if (e.key === 'p' || e.key === 'P') { setAutopilot(p => !p); return; }
    if (e.key === '+' || e.key === '=') { increaseSpeed(); return; }
    if (e.key === '-' || e.key === '_') { decreaseSpeed(); return; }
    if (e.key === 'm' || e.key === 'M') { setGameSpeed(MIN_SPEED); return; }
    if (e.key === ' ' && !gameOver) { setIsPaused(p => !p); return; }
    if (gameOver && e.key === 'Enter') { resetGame(); return; }
    if (isPaused || gameOver) return;

    const currentDirection = directionRef.current;
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W':
        if (currentDirection !== 'DOWN') changeDirection('UP'); break;
      case 'ArrowDown': case 's': case 'S':
        if (currentDirection !== 'UP') changeDirection('DOWN'); break;
      case 'ArrowLeft': case 'a': case 'A':
        if (currentDirection !== 'RIGHT') changeDirection('LEFT'); break;
      case 'ArrowRight': case 'd': case 'D':
        if (currentDirection !== 'LEFT') changeDirection('RIGHT'); break;
    }
  }, [gameStarted, gameOver, isPaused, changeDirection, resetGame, increaseSpeed, decreaseSpeed]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart || !gameStarted || gameOver || isPaused) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const minSwipeDistance = 30;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < minSwipeDistance) {
      setTouchStart(null);
      return;
    }
    const currentDirection = directionRef.current;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 0 && currentDirection !== 'LEFT') changeDirection('RIGHT');
      else if (deltaX < 0 && currentDirection !== 'RIGHT') changeDirection('LEFT');
    } else {
      if (deltaY > 0 && currentDirection !== 'UP') changeDirection('DOWN');
      else if (deltaY < 0 && currentDirection !== 'DOWN') changeDirection('UP');
    }
    setTouchStart(null);
  }, [touchStart, gameStarted, gameOver, isPaused, changeDirection]);

  useEffect(() => {
    const checkMobile = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
      setShowControls(isMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (gameOver || isPaused || !gameStarted) return;

    const moveSnake = () => {
      setSnake(prevSnake => {
        let currentDirection = directionRef.current;

        if (autopilot) {
          const gameState: GameState = {
            snake: prevSnake,
            food,
            direction: currentDirection,
          };
          const decision = autopilotDecide(gameState);
          directionRef.current = decision.direction;
          currentDirection = decision.direction;
        }

        const head = { ...prevSnake[0] };
        switch (currentDirection) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }

        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          setGameOver(true);
          return prevSnake;
        }
        if (prevSnake.some(s => s.x === head.x && s.y === head.y)) {
          setGameOver(true);
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];
        if (head.x === food.x && head.y === food.y) {
          setScore(prev => {
            const newScore = prev + 10;
            if (newScore > highScore) {
              setHighScore(newScore);
              localStorage.setItem('snakeHighScore', newScore.toString());
            }
            return newScore;
          });
          setFood(getRandomPosition(newSnake));
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    };

    gameLoopRef.current = window.setTimeout(moveSnake, gameSpeed);
    return () => { if (gameLoopRef.current) clearTimeout(gameLoopRef.current); };
  }, [autopilot, snake, food, gameOver, isPaused, gameStarted, score, highScore, gameSpeed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = '#2a2a4e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(food.x * CELL_SIZE + CELL_SIZE / 2, food.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    snake.forEach((segment, index) => {
      const gradient = ctx.createRadialGradient(
        segment.x * CELL_SIZE + CELL_SIZE / 2, segment.y * CELL_SIZE + CELL_SIZE / 2, 0,
        segment.x * CELL_SIZE + CELL_SIZE / 2, segment.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2
      );
      gradient.addColorStop(0, index === 0 ? '#4ecdc4' : '#45b7aa');
      gradient.addColorStop(1, index === 0 ? '#2cb5a8' : '#3a9f8f');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(segment.x * CELL_SIZE + 1, segment.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4);
      ctx.fill();

      if (index === 0) {
        ctx.fillStyle = '#fff';
        const eyeOffset = CELL_SIZE / 4;
        const eyeSize = 3;
        const centerX = segment.x * CELL_SIZE + CELL_SIZE / 2;
        const centerY = segment.y * CELL_SIZE + CELL_SIZE / 2;
        let eye1X, eye1Y, eye2X, eye2Y;
        switch (directionRef.current) {
          case 'UP': eye1X = centerX - eyeOffset; eye1Y = centerY - eyeOffset / 2; eye2X = centerX + eyeOffset; eye2Y = centerY - eyeOffset / 2; break;
          case 'DOWN': eye1X = centerX - eyeOffset; eye1Y = centerY + eyeOffset / 2; eye2X = centerX + eyeOffset; eye2Y = centerY + eyeOffset / 2; break;
          case 'LEFT': eye1X = centerX - eyeOffset / 2; eye1Y = centerY - eyeOffset; eye2X = centerX - eyeOffset / 2; eye2Y = centerY + eyeOffset; break;
          case 'RIGHT': eye1X = centerX + eyeOffset / 2; eye1Y = centerY - eyeOffset; eye2X = centerX + eyeOffset / 2; eye2Y = centerY + eyeOffset; break;
        }
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [snake, food, direction]);

  return (
    <div className="snake-game">
      <h1>🐍 Snake Game</h1>
      <div className="score-board">
        <div className="score"><span>Score:</span><span className="score-value">{score}</span></div>
        <div className="high-score"><span>High Score:</span><span className="score-value">{highScore}</span></div>
        <div className="speed-control">
          <span>Speed:</span>
          <div className="speed-buttons">
            <button className="speed-btn min-btn" onClick={setMinSpeed} aria-label="Minimum Speed" title="Slowest (S)">⏮</button>
            <button className="speed-btn" onClick={decreaseSpeed} aria-label="Decrease Speed" title="Slower (-)">−</button>
            <span className="speed-value">{getSpeedLabel(gameSpeed)}</span>
            <button className="speed-btn" onClick={increaseSpeed} aria-label="Increase Speed" title="Faster (+)">+</button>
            <button className="speed-btn max-btn" onClick={setMaxSpeed} aria-label="Maximum Speed" title="Fastest (M)">⚡</button>
          </div>
        </div>
        <div className={`autopilot-indicator ${autopilot ? 'active' : ''}`}>
          <span>🤖 Autopilot:</span><span className="status">{autopilot ? 'ON' : 'OFF'}</span>
        </div>
        <button className={`autopilot-toggle-btn ${autopilot ? 'active' : ''}`} onClick={() => setAutopilot(p => !p)} aria-label="Toggle Autopilot" title="Toggle Autopilot (P)">
          {autopilot ? '🤖 ON' : '🤖 OFF'}
        </button>
      </div>

      <div ref={canvasContainerRef} className="canvas-container" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
        {!gameStarted && !gameOver && (
          <div className="overlay"><div className="overlay-content">
            <h2>Ready to Play?</h2>
            <p>Use Arrow Keys or WASD to move</p>
            <p>Swipe or use D-Pad on mobile</p>
            <p>Press SPACE to pause</p>
            <p>Press P to toggle autopilot</p>
            <p>Press + / - to adjust speed, M for max</p>
            <button onClick={resetGame} className="start-button">Start Game</button>
          </div></div>
        )}
        {isPaused && !gameOver && (
          <div className="overlay"><div className="overlay-content">
            <h2>Paused</h2>
            <p>Press SPACE or tap pause button to resume</p>
          </div></div>
        )}
        {gameOver && (
          <div className="overlay"><div className="overlay-content">
            <h2>Game Over!</h2>
            <p>Final Score: {score}</p>
            {score === highScore && score > 0 && <p className="new-high-score">🎉 New High Score!</p>}
            <button onClick={resetGame} className="start-button">Play Again</button>
          </div></div>
        )}
        {showControls && gameStarted && !gameOver && (
          <div className="mobile-controls">
            <div className="d-pad">
              <button className="d-btn up" onClick={() => changeDirection('UP')} aria-label="Move Up">▲</button>
              <button className="d-btn left" onClick={() => changeDirection('LEFT')} aria-label="Move Left">◀</button>
              <button className="d-btn right" onClick={() => changeDirection('RIGHT')} aria-label="Move Right">▶</button>
              <button className="d-btn down" onClick={() => changeDirection('DOWN')} aria-label="Move Down">▼</button>
            </div>
            <div className="action-buttons">
              <button className="action-btn pause-btn" onClick={() => setIsPaused(p => !p)} aria-label={isPaused ? 'Resume' : 'Pause'}>
                {isPaused ? '▶' : '⏸'}
              </button>
              <button className={`action-btn autopilot-btn ${autopilot ? 'active' : ''}`} onClick={() => setAutopilot(p => !p)} aria-label="Toggle Autopilot">🤖</button>
            </div>
          </div>
        )}
      </div>
      <div className="controls-hint">
        <p>🎮 Arrow Keys / WASD • + / - speed • M max • SPACE pause • P autopilot • ENTER restart</p>
      </div>
    </div>
  );
}
