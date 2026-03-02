import React, { useEffect, useRef, useState } from 'react';

// --- Game Constants ---
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const PLAYER_SIZE = 24;
const MAX_ENERGY = 100;
const MAX_HEALTH = 100;
const BASE_SPEED = 200; // pixels per second
const MAX_SPEED = 600;
const ACCELERATION = 200;
const DECELERATION = 150;
const LATERAL_SPEED = 350;
const ENERGY_DRAIN_RATE = 3; // energy per second
const ECHOLOCATION_COST = 15;
const ECHOLOCATION_DURATION = 2; // seconds
const INSECT_ENERGY = 15;
const COLLISION_DAMAGE = 20;
const GOAL_DISTANCE = 30000; // 30,000 meters to win

type GameState = 'menu' | 'playing' | 'paused' | 'gameover' | 'victory';
type EntityType = 'cable' | 'drone' | 'fan' | 'smoke' | 'neon' | 'insect' | 'cave';
type Language = 'en' | 'es';
type ZoneType = 'straight' | 'left-curve' | 'right-curve' | 'turbulence' | 'slow';
type EventType = 'none' | 'blackout' | 'rain' | 'drone-swarm' | 'electric-burst';

const TRANSLATIONS = {
  en: {
    title: 'DARK ROUTE',
    subtitle: 'The city never sleeps… and neither do you.',
    context: "Fly through skyscrapers, electrical cables, and drones as the night advances without stopping.\nDodge obstacles, use your echolocation, and feed on insects to recover energy.\nThe further you go, the more dangerous the city becomes.\nHow long can you resist?",
    start: 'START FLIGHT',
    restart: 'TRY AGAIN',
    playAgain: 'PLAY AGAIN',
    gameOver: 'GAME OVER',
    victory: 'CAVE REACHED!',
    victorySub: 'You survived the urban jungle.',
    distance: 'Distance',
    time: 'Time',
    energy: 'POWER',
    health: 'HEALTH',
    distLabel: 'DIST',
    timeLabel: 'TIME',
    record: 'RECORD',
    progress: 'PROGRESS',
    points: 'POINTS',
    home: 'HOME',
    paused: 'PAUSED',
    resume: 'Press ENTER to resume',
    controls: 'Controls',
    ws: 'W / S: Accelerate / Decelerate',
    ad: 'A / D: Move Left / Right',
    space: 'SPACE: Echolocation (Costs Energy)',
    enter: 'ENTER: Pause / Resume',
    legendInsects: 'Yellow dots = Insects (Energy)',
    legendCables: 'Magenta = Cables',
    legendDrones: 'Cyan = Drones',
    legendFans: 'Yellow = Fans',
    legendSmoke: 'White = Smoke',
    zoneStraight: 'CLEAR PATH',
    zoneLeft: 'CURVE LEFT',
    zoneRight: 'CURVE RIGHT',
    zoneTurbulence: 'TURBULENCE!',
    zoneSlow: 'DENSE AREA',
    eventBlackout: 'BLACKOUT!',
    eventRain: 'HEAVY RAIN',
    eventSwarm: 'DRONE SWARM!',
    eventElectric: 'ELECTRIC BURST',
  },
  es: {
    title: 'DARK ROUTE',
    subtitle: 'La ciudad nunca duerme… y tú tampoco.',
    context: "Vuela a través de rascacielos, cables eléctricos y drones mientras la noche avanza sin detenerse.\nEsquiva obstáculos, usa tu ecolocación y alimentate de insectos para recuperar energía.\nCuanto más lejos llegues, más peligrosa se vuelve la ciudad.\n¿Hasta dónde podrás resistir?",
    start: 'INICIAR VUELO',
    restart: 'REINTENTAR',
    playAgain: 'JUGAR DE NUEVO',
    gameOver: 'FIN DEL JUEGO',
    victory: '¡CUEVA ALCANZADA!',
    victorySub: 'Sobreviviste a la jungla urbana.',
    distance: 'Distancia',
    time: 'Tiempo',
    energy: 'PODER',
    health: 'SALUD',
    distLabel: 'DIST',
    timeLabel: 'TIEMPO',
    record: 'RÉCORD',
    progress: 'PROGRESO',
    points: 'PUNTOS',
    home: 'HOGAR',
    paused: 'PAUSADO',
    resume: 'Presiona ENTER para continuar',
    controls: 'Controles',
    ws: 'W / S: Acelerar / Desacelerar',
    ad: 'A / D: Izquierda / Derecha',
    space: 'ESPACIO: Ecolocalización (Cuesta Energía)',
    enter: 'ENTER: Pausa / Reanudar',
    legendInsects: 'Puntos amarillos = Insectos (Energía)',
    legendCables: 'Magenta = Cables',
    legendDrones: 'Cian = Drones',
    legendFans: 'Amarillo = Ventiladores',
    legendSmoke: 'Blanco = Humo',
    zoneStraight: 'CAMINO DESPEJADO',
    zoneLeft: 'CURVA IZQUIERDA',
    zoneRight: 'CURVA DERECHA',
    zoneTurbulence: '¡TURBULENCIA!',
    zoneSlow: 'ZONA DENSA',
    eventBlackout: '¡APAGÓN!',
    eventRain: 'LLUVIA FUERTE',
    eventSwarm: '¡ENJAMBRE DE DRONES!',
    eventElectric: 'RÁFAGA ELÉCTRICA',
  }
};

interface Entity {
  id: number;
  type: EntityType;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  vx: number;
  vy: number;
  active: boolean;
  animTime: number;
  color: string;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [language, setLanguage] = useState<Language>('en');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('dark_route_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [progress, setProgress] = useState(0);
  const [finalTime, setFinalTime] = useState('00:00.00');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[language];

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds * 100) % 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  
  // Mutable game state to avoid React re-renders during the game loop
  const stateRef = useRef({
    player: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 100,
      speed: BASE_SPEED,
    },
    energy: MAX_ENERGY,
    health: MAX_HEALTH,
    distance: 0,
    timeElapsed: 0,
    entities: [] as Entity[],
    keys: { w: false, a: false, s: false, d: false, space: false },
    echolocationTimer: 0,
    lastTime: 0,
    spawnTimer: 0,
    insectSpawnTimer: 0,
    entityIdCounter: 0,
    difficultyMultiplier: 1,
    bgOffsetY: 0,
    roadOffset: 0,
    targetRoadOffset: 0,
    cameraRotation: 0,
    windForce: 0,
    windTimer: 0,
    currentZone: 'straight' as ZoneType,
    zoneTimer: 5,
    currentEvent: 'none' as EventType,
    eventTimer: 0,
    eventDisplayTimer: 0,
    spaceWasPressed: false,
  });

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') stateRef.current.keys.w = true;
      if (key === 'a') stateRef.current.keys.a = true;
      if (key === 's') stateRef.current.keys.s = true;
      if (key === 'd') stateRef.current.keys.d = true;
      if (key === ' ') {
        stateRef.current.keys.space = true;
        // Prevent default scrolling
        if (e.target === document.body) e.preventDefault();
      }
      if (key === 'enter') {
        setGameState(prev => {
          if (prev === 'playing') return 'paused';
          if (prev === 'paused') return 'playing';
          return prev;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') stateRef.current.keys.w = false;
      if (key === 'a') stateRef.current.keys.a = false;
      if (key === 's') stateRef.current.keys.s = false;
      if (key === 'd') stateRef.current.keys.d = false;
      if (key === ' ') {
        stateRef.current.keys.space = false;
        stateRef.current.spaceWasPressed = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleTouchStart = (key: keyof typeof stateRef.current.keys) => {
    stateRef.current.keys[key] = true;
    if (key === 'space') {
      stateRef.current.spaceWasPressed = false;
    }
  };

  const handleTouchEnd = (key: keyof typeof stateRef.current.keys) => {
    stateRef.current.keys[key] = false;
    if (key === 'space') {
      stateRef.current.spaceWasPressed = false;
    }
  };

  // --- Game Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const spawnInsect = (state: any) => {
      state.entities.push({
        id: state.entityIdCounter++,
        type: 'insect',
        // Spawn relative to road offset so they stay on the path
        x: (Math.random() * (CANVAS_WIDTH - 100) + 50) - state.roadOffset,
        y: -100,
        width: 0, height: 0, radius: 10, vx: 0, vy: 0, // Increased radius from 6 to 10
        active: true, animTime: 0, color: '#ffcc00'
      });
    };

    const spawnEntity = (state: any) => {
      const rand = Math.random();
      let type: EntityType = 'cable';
      let width = 0, height = 0, radius = 0, vx = 0, vy = 0;
      
      // Spawn relative to the current road offset to keep them on the path
      // In "slow" zone, we might spawn more or different patterns
      const isSlowZone = state.currentZone === 'slow';
      const spawnChance = isSlowZone ? 0.8 : 0.4;
      
      if (Math.random() > spawnChance) return;

      let x = (Math.random() * (CANVAS_WIDTH - 120) + 60) - state.roadOffset;
      let y = -100;
      let color = '#00ffff';

      if (rand < 0.3) {
        type = 'cable';
        width = Math.random() * 150 + 50;
        height = 10;
        color = '#ff00ff'; // Magenta
      } else if (rand < 0.6) {
        type = 'drone';
        radius = 15;
        vx = (Math.random() > 0.5 ? 1 : -1) * (50 + Math.random() * 50 * state.difficultyMultiplier);
        if (state.currentEvent === 'drone-swarm') vx *= 2;
        color = '#00ffff'; // Cyan
      } else if (rand < 0.75) {
        type = 'fan';
        width = 80;
        height = 80;
        color = '#ffff00'; // Yellow
      } else if (rand < 0.9) {
        type = 'smoke';
        radius = 40;
        color = '#ffffff'; // White
      } else {
        type = 'neon';
        width = 20;
        height = 120;
        x = Math.random() > 0.5 ? 10 - state.roadOffset : CANVAS_WIDTH - 30 - state.roadOffset; // Edges
        color = `hsl(${Math.random() * 360}, 100%, 50%)`;
      }

      state.entities.push({
        id: state.entityIdCounter++,
        type, x, y, width, height, radius, vx, vy,
        active: true, animTime: 0, color
      });
    };

    const checkCollision = (player: any, entity: Entity, roadOffset: number) => {
      // Simple AABB / Circle collision against player triangle (approximated as circle for simplicity)
      const px = player.x;
      const py = player.y;
      const pr = PLAYER_SIZE / 2;

      const entityScreenX = entity.x + roadOffset;

      if (entity.type === 'insect' || entity.type === 'drone' || entity.type === 'smoke') {
        const dx = px - entityScreenX;
        const dy = py - entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < pr + entity.radius;
      } else {
        // Rectangle collision
        const rx = entityScreenX - entity.width / 2;
        const ry = entity.y - entity.height / 2;
        const rw = entity.width;
        const rh = entity.height;
        
        const testX = px < rx ? rx : px > rx + rw ? rx + rw : px;
        const testY = py < ry ? ry : py > ry + rh ? ry + rh : py;
        
        const dx = px - testX;
        const dy = py - testY;
        return (dx * dx + dy * dy) <= (pr * pr);
      }
    };

    const update = (time: number) => {
      const state = stateRef.current;
      if (state.lastTime === 0) state.lastTime = time;
      const dt = (time - state.lastTime) / 1000;
      state.lastTime = time;

      if (gameState === 'paused') {
        draw(ctx, state);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 40px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(t.paused, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.font = '20px monospace';
        ctx.fillText(t.resume, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
        animationFrameId = requestAnimationFrame(update);
        return;
      }

      if (gameState !== 'playing') {
        draw(ctx, state);
        animationFrameId = requestAnimationFrame(update);
        return;
      }

      // --- Player Movement ---
      // Organic Oscillation
      const oscillation = Math.sin(time * 0.005) * 2;
      
      if (state.keys.w) {
        state.player.speed += ACCELERATION * dt;
      } else if (state.keys.s) {
        state.player.speed -= DECELERATION * dt;
      } else {
        // Gradually return to base speed
        const targetBase = state.currentZone === 'turbulence' ? BASE_SPEED * 1.5 : BASE_SPEED;
        if (state.player.speed > targetBase) {
          state.player.speed -= DECELERATION * 0.5 * dt;
        } else if (state.player.speed < targetBase) {
          state.player.speed += ACCELERATION * 0.5 * dt;
        }
      }
      state.player.speed = Math.max(BASE_SPEED * 0.5, Math.min(state.player.speed, MAX_SPEED));

      // Wind Force
      if (state.windTimer > 0) {
        state.windTimer -= dt;
        state.player.x += state.windForce * dt;
      } else if (Math.random() < 0.005) {
        state.windTimer = 2 + Math.random() * 3;
        state.windForce = (Math.random() > 0.5 ? 1 : -1) * (100 + Math.random() * 100);
      }

      if (state.keys.a) state.player.x -= LATERAL_SPEED * dt;
      if (state.keys.d) state.player.x += LATERAL_SPEED * dt;
      
      state.player.x += oscillation; // Organic movement

      // Boundaries
      state.player.x = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, state.player.x));

      // --- Echolocation ---
      if (state.keys.space && !state.spaceWasPressed && state.energy >= ECHOLOCATION_COST) {
        state.echolocationTimer = ECHOLOCATION_DURATION;
        state.energy -= ECHOLOCATION_COST;
        state.spaceWasPressed = true;
      }
      if (state.echolocationTimer > 0) {
        state.echolocationTimer -= dt;
      }

      // --- Game Progression ---
      const distanceTraveled = state.player.speed * dt;
      state.distance += distanceTraveled;
      state.timeElapsed += dt;
      state.difficultyMultiplier = 1 + state.distance / 15000; // Scales difficulty over the longer distance
      
      // Update Zones
      state.zoneTimer -= dt;
      if (state.zoneTimer <= 0) {
        const zones: ZoneType[] = ['straight', 'left-curve', 'right-curve', 'turbulence', 'slow'];
        state.currentZone = zones[Math.floor(Math.random() * zones.length)];
        state.zoneTimer = 5 + Math.random() * 5;
        state.eventDisplayTimer = 2; // Show zone name for 2s
      }

      // Update Events
      state.eventTimer -= dt;
      if (state.eventTimer <= 0) {
        if (state.currentEvent === 'none') {
          const events: EventType[] = ['blackout', 'rain', 'drone-swarm', 'electric-burst'];
          state.currentEvent = events[Math.floor(Math.random() * events.length)];
          state.eventTimer = 5 + Math.random() * 5;
          state.eventDisplayTimer = 2;
        } else {
          state.currentEvent = 'none';
          state.eventTimer = 10 + Math.random() * 10;
        }
      }
      if (state.eventDisplayTimer > 0) state.eventDisplayTimer -= dt;

      // Update road offset for curves
      let curveIntensity = 0;
      if (state.currentZone === 'left-curve') curveIntensity = -150 * state.difficultyMultiplier;
      if (state.currentZone === 'right-curve') curveIntensity = 150 * state.difficultyMultiplier;
      
      state.targetRoadOffset = Math.sin(state.distance * 0.0005) * 80 + curveIntensity;
      state.roadOffset += (state.targetRoadOffset - state.roadOffset) * 2 * dt;
      
      // Camera rotation based on road offset change
      state.cameraRotation = (state.roadOffset / 150) * (Math.PI / 180 * 5); // Max 5 degrees

      // Energy (Power) drain over time
      state.energy -= ENERGY_DRAIN_RATE * dt;

      // Spawn Cave when reaching goal
      if (state.distance >= GOAL_DISTANCE && !state.entities.some(e => e.type === 'cave')) {
        state.entities.push({
          id: state.entityIdCounter++,
          type: 'cave',
          x: CANVAS_WIDTH / 2 - state.roadOffset,
          y: -200, // Spawn above screen
          width: CANVAS_WIDTH,
          height: 400,
          radius: 0, vx: 0, vy: 0,
          active: true, animTime: 0, color: '#000000'
        });
      }

      // Background scrolling
      state.bgOffsetY = (state.bgOffsetY + distanceTraveled) % 100;

      // --- Entities ---
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEntity(state);
        state.spawnTimer = (Math.random() * 1.5 + 0.5) / state.difficultyMultiplier;
      }

      state.insectSpawnTimer -= dt;
      if (state.insectSpawnTimer <= 0) {
        spawnInsect(state);
        state.insectSpawnTimer = 0.8; // Spawn an insect every 0.8 seconds
      }

      for (let i = state.entities.length - 1; i >= 0; i--) {
        const entity = state.entities[i];
        if (!entity.active) continue;

        // Move entity down relative to player speed
        entity.y += state.player.speed * dt;
        entity.x += entity.vx * dt;
        entity.y += entity.vy * dt;
        entity.animTime += dt;

        // Drone bouncing
        if (entity.type === 'drone') {
          if (entity.x - entity.radius < 0 || entity.x + entity.radius > CANVAS_WIDTH) {
            entity.vx *= -1;
          }
        }

        // Collision
        if (checkCollision(state.player, entity, state.roadOffset)) {
          if (entity.type === 'insect') {
            state.energy = Math.min(MAX_ENERGY, state.energy + INSECT_ENERGY);
            state.health = Math.min(MAX_HEALTH, state.health + 10);
            entity.active = false;
          } else if (entity.type === 'cave') {
             // Reached the cave!
             const finalScore = Math.floor(state.distance / 10);
             setScore(finalScore);
             if (finalScore > highScore) {
               setHighScore(finalScore);
               localStorage.setItem('dark_route_highscore', finalScore.toString());
             }
             setProgress(100);
             setFinalTime(formatTime(state.timeElapsed));
             setGameState('victory');
          } else if (entity.type === 'smoke') {
            state.health -= COLLISION_DAMAGE * 0.2 * dt; // Continuous health drain
            state.player.speed *= 0.95; // Slow down
          } else {
            state.health -= COLLISION_DAMAGE;
            entity.active = false;
            // Flash effect could be added here
            state.player.speed = BASE_SPEED * 0.5; // Stun
          }
        }

        // Remove off-screen
        if (entity.y > CANVAS_HEIGHT + 100) {
          state.entities.splice(i, 1);
        }
      }

      // Clean up inactive entities
      state.entities = state.entities.filter(e => e.active);

      // --- Game Over Check ---
      if (state.health <= 0 || state.energy <= 0) {
        const finalScore = Math.floor(state.distance / 10);
        setScore(finalScore);
        if (finalScore > highScore) {
          setHighScore(finalScore);
          localStorage.setItem('dark_route_highscore', finalScore.toString());
        }
        setProgress(Math.floor((state.distance / GOAL_DISTANCE) * 100));
        setFinalTime(formatTime(state.timeElapsed));
        setGameState('gameover');
      }

      draw(ctx, state);
      animationFrameId = requestAnimationFrame(update);
    };

    const draw = (ctx: CanvasRenderingContext2D, state: any) => {
      // Clear
      ctx.fillStyle = state.currentEvent === 'blackout' ? '#050505' : '#111111';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.save();
      // Camera Rotation and Tilting
      ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.rotate(state.cameraRotation);
      ctx.translate(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2);

      ctx.save();
      // Apply road curvature translation
      ctx.translate(state.roadOffset, 0);

      // Draw grid lines for movement illusion
      ctx.strokeStyle = state.currentEvent === 'blackout' ? '#111' : '#222222';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Draw more lines to cover the translation area
      for (let i = -400; i < CANVAS_WIDTH + 400; i += 50) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, CANVAS_HEIGHT);
      }
      for (let i = 0; i < CANVAS_HEIGHT + 100; i += 50) {
        const y = i + state.bgOffsetY - 50;
        ctx.moveTo(-400, y);
        ctx.lineTo(CANVAS_WIDTH + 400, y);
      }
      ctx.stroke();

      // Draw Road Borders
      ctx.strokeStyle = state.currentEvent === 'blackout' ? '#222' : '#333';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(20, CANVAS_HEIGHT);
      ctx.moveTo(CANVAS_WIDTH - 20, 0);
      ctx.lineTo(CANVAS_WIDTH - 20, CANVAS_HEIGHT);
      ctx.stroke();

      const isEchoActive = state.echolocationTimer > 0;

      // --- Draw Entities ---
      state.entities.forEach((entity: Entity) => {
        ctx.save();
        ctx.translate(entity.x, entity.y);

        if (entity.type === 'insect') {
          ctx.fillStyle = entity.color;
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2); // Keep visual size small but collision is larger
          ctx.fill();
          // Glow
          ctx.shadowBlur = 15;
          ctx.shadowColor = entity.color;
          ctx.fill();
        } else if (entity.type === 'cave') {
          // Draw Cave Entrance
          ctx.fillStyle = '#0a0a0a';
          ctx.beginPath();
          ctx.arc(0, 0, 150, Math.PI, 0); // Semi-circle arch
          ctx.fill();
          
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 10;
          ctx.stroke();
          
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 24px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(t.home, 0, -50);
        } else if (entity.type === 'neon') {
          ctx.fillStyle = entity.color;
          ctx.fillRect(-entity.width / 2, -entity.height / 2, entity.width, entity.height);
          ctx.shadowBlur = 20;
          ctx.shadowColor = entity.color;
          ctx.fillRect(-entity.width / 2, -entity.height / 2, entity.width, entity.height);
        } else {
          // Obstacles (hidden unless echolocation or very close)
          const distToPlayer = Math.sqrt(Math.pow(entity.x + state.roadOffset - state.player.x, 2) + Math.pow(entity.y - state.player.y, 2));
          let alpha = state.currentEvent === 'blackout' ? 0.02 : 0.1; // Barely visible normally
          
          if (isEchoActive) {
            alpha = 1.0;
          } else if (distToPlayer < 150) {
            alpha = 1.0 - (distToPlayer / 150);
          }

          ctx.globalAlpha = alpha;
          
          if (isEchoActive) {
            ctx.strokeStyle = entity.color;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = entity.color;
          } else {
            ctx.fillStyle = '#333333';
            ctx.strokeStyle = '#444444';
            ctx.lineWidth = 2;
          }

          if (entity.type === 'cable') {
            if (isEchoActive) {
              ctx.fillStyle = entity.color;
              ctx.globalAlpha = 0.8;
              ctx.fillRect(-entity.width / 2, -entity.height / 2, entity.width, entity.height);
              ctx.globalAlpha = 1.0;
              ctx.strokeRect(-entity.width / 2, -entity.height / 2, entity.width, entity.height);
            } else {
              ctx.fillRect(-entity.width / 2, -entity.height / 2, entity.width, entity.height);
              ctx.strokeRect(-entity.width / 2, -entity.height / 2, entity.width, entity.height);
            }
          } else if (entity.type === 'drone') {
            ctx.beginPath();
            ctx.arc(0, 0, entity.radius, 0, Math.PI * 2);
            if (isEchoActive) {
              ctx.fillStyle = entity.color;
              ctx.globalAlpha = 0.8;
              ctx.fill();
              ctx.globalAlpha = 1.0;
              ctx.stroke();
            } else { ctx.fill(); ctx.stroke(); }
            
            // Drone cross
            ctx.beginPath();
            ctx.moveTo(-entity.radius, 0);
            ctx.lineTo(entity.radius, 0);
            ctx.moveTo(0, -entity.radius);
            ctx.lineTo(0, entity.radius);
            ctx.stroke();
          } else if (entity.type === 'fan') {
            if (isEchoActive) {
              ctx.fillStyle = entity.color;
              ctx.globalAlpha = 0.8;
              ctx.fillRect(-entity.width / 2, -entity.height / 2, entity.width, entity.height);
              ctx.globalAlpha = 1.0;
              ctx.strokeRect(-entity.width / 2, -entity.height / 2, entity.width, entity.height);
            } else {
              ctx.fillRect(-entity.width / 2, -entity.height / 2, entity.width, entity.height);
            }
            // Rotating blades
            ctx.rotate(entity.animTime * 5);
            ctx.beginPath();
            ctx.moveTo(-entity.width / 2, -entity.height / 2);
            ctx.lineTo(entity.width / 2, entity.height / 2);
            ctx.moveTo(entity.width / 2, -entity.height / 2);
            ctx.lineTo(-entity.width / 2, entity.height / 2);
            ctx.strokeStyle = isEchoActive ? '#fff' : '#555';
            ctx.stroke();
          } else if (entity.type === 'smoke') {
            ctx.beginPath();
            ctx.arc(0, 0, entity.radius, 0, Math.PI * 2);
            ctx.arc(15, 10, entity.radius * 0.8, 0, Math.PI * 2);
            ctx.arc(-15, 5, entity.radius * 0.9, 0, Math.PI * 2);
            if (isEchoActive) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
              ctx.fill();
              ctx.stroke();
            } else {
              ctx.fillStyle = '#2a2a2a';
              ctx.fill();
            }
          }
        }
        ctx.restore();
      });

      ctx.restore(); // End of road offset translation
      ctx.restore(); // End of camera rotation

      // Rain Effect
      if (state.currentEvent === 'rain') {
        ctx.strokeStyle = 'rgba(100, 150, 255, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
          const rx = Math.random() * CANVAS_WIDTH;
          const ry = Math.random() * CANVAS_HEIGHT;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 5, ry + 15);
          ctx.stroke();
        }
      }

      // --- Draw Player (Bat / Black Triangle) ---
      ctx.save();
      ctx.translate(state.player.x, state.player.y);
      
      // Echolocation wave effect
      if (isEchoActive) {
        const waveRadius = (ECHOLOCATION_DURATION - state.echolocationTimer) * 400;
        ctx.beginPath();
        ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 255, ${state.echolocationTimer / ECHOLOCATION_DURATION})`;
        ctx.lineWidth = 5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(0, -PLAYER_SIZE); // Nose
      ctx.lineTo(PLAYER_SIZE, PLAYER_SIZE); // Right wing
      ctx.lineTo(0, PLAYER_SIZE - 5); // Tail
      ctx.lineTo(-PLAYER_SIZE, PLAYER_SIZE); // Left wing
      ctx.closePath();
      
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.strokeStyle = '#ffffff'; // White outline so it's visible on dark background
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // --- UI ---
      // Health Bar
      ctx.fillStyle = '#333';
      ctx.fillRect(20, 20, 200, 15);
      const healthRatio = Math.max(0, state.health / MAX_HEALTH);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(20, 20, 200 * healthRatio, 15);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(20, 20, 200, 15);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(t.health || 'HEALTH', 25, 31);

      // Power Bar
      ctx.fillStyle = '#333';
      ctx.fillRect(20, 40, 200, 15);
      const energyRatio = Math.max(0, state.energy / MAX_ENERGY);
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(20, 40, 200 * energyRatio, 15);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(20, 40, 200, 15);
      ctx.fillStyle = '#fff';
      ctx.fillText(t.energy, 25, 51);

      // Score & Time
      ctx.fillStyle = '#fff';
      ctx.font = '20px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${t.distLabel}: ${Math.floor(state.distance / 10)}m`, CANVAS_WIDTH - 20, 35);
      ctx.fillText(`${t.timeLabel}: ${formatTime(state.timeElapsed)}`, CANVAS_WIDTH - 20, 60);

      // Zone/Event Announcements
      if (state.eventDisplayTimer > 0) {
        ctx.save();
        ctx.globalAlpha = state.eventDisplayTimer;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        
        let msg = '';
        if (state.currentZone === 'straight') msg = t.zoneStraight;
        if (state.currentZone === 'left-curve') msg = t.zoneLeft;
        if (state.currentZone === 'right-curve') msg = t.zoneRight;
        if (state.currentZone === 'turbulence') msg = t.zoneTurbulence;
        if (state.currentZone === 'slow') msg = t.zoneSlow;
        
        ctx.fillText(msg, CANVAS_WIDTH / 2, 120);
        
        if (state.currentEvent !== 'none') {
          let eventMsg = '';
          if (state.currentEvent === 'blackout') eventMsg = t.eventBlackout;
          if (state.currentEvent === 'rain') eventMsg = t.eventRain;
          if (state.currentEvent === 'drone-swarm') eventMsg = t.eventSwarm;
          if (state.currentEvent === 'electric-burst') eventMsg = t.eventElectric;
          ctx.fillStyle = '#ff4444';
          ctx.fillText(eventMsg, CANVAS_WIDTH / 2, 160);
        }
        ctx.restore();
      }

      // Minimap
      const mapWidth = 40;
      const mapHeight = 150;
      const mapX = 20;
      const mapY = 60;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);
      
      // Player on minimap
      const progress = Math.min(1, state.distance / GOAL_DISTANCE);
      const playerMapY = mapY + mapHeight - (progress * mapHeight);
      ctx.fillStyle = '#0f0';
      ctx.beginPath();
      ctx.arc(mapX + mapWidth / 2, playerMapY, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Goal indicator on minimap
      ctx.fillStyle = '#fff';
      ctx.fillRect(mapX, mapY - 2, mapWidth, 4);
    };

    animationFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState]);

  const startGame = () => {
    stateRef.current = {
      player: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100, speed: BASE_SPEED },
      energy: MAX_ENERGY,
      health: MAX_HEALTH,
      distance: 0,
      timeElapsed: 0,
      entities: [],
      keys: { w: false, a: false, s: false, d: false, space: false },
      echolocationTimer: 0,
      lastTime: 0,
      spawnTimer: 0,
      insectSpawnTimer: 0,
      entityIdCounter: 0,
      difficultyMultiplier: 1,
      bgOffsetY: 0,
      roadOffset: 0,
      targetRoadOffset: 0,
      cameraRotation: 0,
      windForce: 0,
      windTimer: 0,
      currentZone: 'straight' as ZoneType,
      zoneTimer: 5,
      currentEvent: 'none' as EventType,
      eventTimer: 10,
      eventDisplayTimer: 0,
      spaceWasPressed: false,
    };
    setScore(0);
    setGameState('playing');
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center font-mono text-white p-4 relative overflow-hidden">
      <div className="relative w-full max-w-[800px] flex flex-col items-center">
        {/* Top Bar: Language & Fullscreen */}
        <div className="absolute -top-12 right-0 flex gap-2 z-50">
          <button 
            onClick={toggleFullscreen}
            className="px-3 py-1 rounded text-xs font-bold transition-colors bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
          >
            {isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
          </button>
          <button 
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${language === 'en' ? 'bg-cyan-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
          >
            EN
          </button>
          <button 
            onClick={() => setLanguage('es')}
            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${language === 'es' ? 'bg-cyan-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
          >
            ES
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="bg-black rounded-lg shadow-2xl border border-neutral-800 w-full h-auto max-h-[80vh] object-contain"
          style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
        />
        
        {/* Mobile Controls (Visible only when playing) */}
        {gameState === 'playing' && (
          <div className="md:hidden absolute bottom-4 left-0 right-0 flex justify-between px-4 z-50 pointer-events-none">
            {/* Left/Right Controls */}
            <div className="flex gap-2 pointer-events-auto">
              <button 
                className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center active:bg-white/40 border border-white/30"
                onTouchStart={() => handleTouchStart('a')}
                onTouchEnd={() => handleTouchEnd('a')}
                onMouseDown={() => handleTouchStart('a')}
                onMouseUp={() => handleTouchEnd('a')}
                onMouseLeave={() => handleTouchEnd('a')}
              >
                <span className="text-2xl">←</span>
              </button>
              <button 
                className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center active:bg-white/40 border border-white/30"
                onTouchStart={() => handleTouchStart('d')}
                onTouchEnd={() => handleTouchEnd('d')}
                onMouseDown={() => handleTouchStart('d')}
                onMouseUp={() => handleTouchEnd('d')}
                onMouseLeave={() => handleTouchEnd('d')}
              >
                <span className="text-2xl">→</span>
              </button>
            </div>

            {/* Action Controls */}
            <div className="flex gap-2 pointer-events-auto">
              <div className="flex flex-col gap-2">
                <button 
                  className="w-16 h-16 bg-cyan-500/30 backdrop-blur-md rounded-full flex items-center justify-center active:bg-cyan-500/60 border border-cyan-500/50"
                  onTouchStart={() => handleTouchStart('space')}
                  onTouchEnd={() => handleTouchEnd('space')}
                  onMouseDown={() => handleTouchStart('space')}
                  onMouseUp={() => handleTouchEnd('space')}
                  onMouseLeave={() => handleTouchEnd('space')}
                >
                  <span className="text-xl font-bold">ECHO</span>
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center active:bg-white/40 border border-white/30"
                  onTouchStart={() => handleTouchStart('w')}
                  onTouchEnd={() => handleTouchEnd('w')}
                  onMouseDown={() => handleTouchStart('w')}
                  onMouseUp={() => handleTouchEnd('w')}
                  onMouseLeave={() => handleTouchEnd('w')}
                >
                  <span className="text-2xl">↑</span>
                </button>
                <button 
                  className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center active:bg-white/40 border border-white/30"
                  onTouchStart={() => handleTouchStart('s')}
                  onTouchEnd={() => handleTouchEnd('s')}
                  onMouseDown={() => handleTouchStart('s')}
                  onMouseUp={() => handleTouchEnd('s')}
                  onMouseLeave={() => handleTouchEnd('s')}
                >
                  <span className="text-2xl">↓</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {gameState === 'menu' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm p-8 text-center">
            <h1 className="text-5xl font-bold mb-2 tracking-tighter text-cyan-400">{t.title}</h1>
            <p className="text-xl text-white italic mb-4">{t.subtitle}</p>
            
            <div className="max-w-md mb-8 text-neutral-300 text-sm leading-relaxed">
              {t.context.split('\n').map((line, i) => (
                <p key={i} className="mb-2">{line}</p>
              ))}
            </div>
            
            <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 mb-8 text-sm text-neutral-300 space-y-2 text-left w-full max-w-sm">
              <p className="text-white font-bold mb-2 border-b border-neutral-800 pb-1">{t.controls}</p>
              <p><span className="text-white font-bold w-16 inline-block">W / S</span> {t.ws.split(': ')[1]}</p>
              <p><span className="text-white font-bold w-16 inline-block">A / D</span> {t.ad.split(': ')[1]}</p>
              <p><span className="text-white font-bold w-16 inline-block">SPACE</span> {t.space.split(': ')[1]}</p>
              <p><span className="text-white font-bold w-16 inline-block">ENTER</span> {t.enter.split(': ')[1]}</p>
              <div className="mt-4 pt-4 border-t border-neutral-800 space-y-1">
                <p className="text-yellow-400">● {t.legendInsects}</p>
                <p className="text-magenta-400">■ {t.legendCables}</p>
                <p className="text-cyan-400">● {t.legendDrones}</p>
                <p className="text-yellow-200">■ {t.legendFans}</p>
                <p className="text-white">☁ {t.legendSmoke}</p>
              </div>
            </div>

            <button 
              onClick={startGame}
              className="px-8 py-4 bg-white text-black font-bold text-xl rounded-full hover:bg-cyan-400 hover:scale-105 transition-all active:scale-95"
            >
              {t.start}
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center rounded-lg backdrop-blur-md p-8">
            <h2 className="text-6xl font-black text-red-600 mb-6 tracking-tighter uppercase italic">{t.gameOver}</h2>
            
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
              <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-center">
                <p className="text-xs text-neutral-500 uppercase font-bold mb-1">{t.points}</p>
                <p className="text-3xl font-bold text-white">{score}</p>
              </div>
              <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-center">
                <p className="text-xs text-neutral-500 uppercase font-bold mb-1">{t.record}</p>
                <p className="text-3xl font-bold text-cyan-400">{highScore}</p>
              </div>
              <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-center">
                <p className="text-xs text-neutral-500 uppercase font-bold mb-1">{t.progress}</p>
                <p className="text-3xl font-bold text-yellow-500">{progress}%</p>
              </div>
              <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-center">
                <p className="text-xs text-neutral-500 uppercase font-bold mb-1">{t.time}</p>
                <p className="text-xl font-bold text-white mt-1">{finalTime.split('.')[0]}</p>
              </div>
            </div>

            <button 
              onClick={startGame}
              className="px-10 py-4 bg-white text-black font-bold text-xl rounded-full hover:bg-cyan-400 hover:scale-105 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              {t.restart}
            </button>
          </div>
        )}

        {gameState === 'victory' && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center rounded-lg backdrop-blur-md p-8">
            <h2 className="text-6xl font-black text-green-500 mb-2 tracking-tighter uppercase italic">{t.victory}</h2>
            <p className="text-xl mb-8 text-neutral-400">{t.victorySub}</p>
            
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
              <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-center">
                <p className="text-xs text-neutral-500 uppercase font-bold mb-1">{t.points}</p>
                <p className="text-3xl font-bold text-white">{score}</p>
              </div>
              <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-center">
                <p className="text-xs text-neutral-500 uppercase font-bold mb-1">{t.record}</p>
                <p className="text-3xl font-bold text-cyan-400">{highScore}</p>
              </div>
              <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-center col-span-2">
                <p className="text-xs text-neutral-500 uppercase font-bold mb-1">{t.time}</p>
                <p className="text-3xl font-bold text-white">{finalTime}</p>
              </div>
            </div>

            <button 
              onClick={startGame}
              className="px-10 py-4 bg-white text-black font-bold text-xl rounded-full hover:bg-cyan-400 hover:scale-105 transition-all active:scale-95 shadow-[0_0_20px_rgba(0,255,0,0.2)]"
            >
              {t.playAgain}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
