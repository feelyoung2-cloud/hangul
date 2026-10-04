import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Word, ActiveMeteor, LaserBeam, ExplosionParticle } from '../types';
import { sound } from '../utils/sound';
import {
  Heart,
  Zap,
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Shield,
  HelpCircle,
  Crosshair
} from 'lucide-react';

interface GameCanvasProps {
  words: Word[];
  studentName: string;
  initialLives?: number;
  initialFallSpeed?: number;
  onGameOver: (stats: {
    score: number;
    accuracy: number;
    maxCombo: number;
    wordsDestroyed: number;
  }) => void;
  onOpenLeaderboard: () => void;
  onOpenTeacher: () => void;
  onLogout: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  words,
  studentName,
  initialLives = 3,
  initialFallSpeed = 1,
  onGameOver,
  onOpenLeaderboard,
  onOpenTeacher,
  onLogout,
}) => {
  // Game Play State
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(initialLives);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [wordsDestroyed, setWordsDestroyed] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [correctAttempts, setCorrectAttempts] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isInputShaking, setIsInputShaking] = useState(false);
  const [shieldHitFlash, setShieldHitFlash] = useState(false);
  const [activeHint, setActiveHint] = useState<string | null>(null);

  // Sound State
  const [isMuted, setIsMuted] = useState(sound.getMuted());

  // Animation Refs
  const meteorsRef = useRef<ActiveMeteor[]>([]);
  const lasersRef = useRef<LaserBeam[]>([]);
  const particlesRef = useRef<ExplosionParticle[]>([]);
  const lastSpawnTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Ship aim angle
  const shipAngleRef = useRef<number>(0);

  // Game Difficulty State
  const speedMultiplierRef = useRef<number>(initialFallSpeed);

  // Sync lives when prop changes
  useEffect(() => {
    setLives(initialLives);
  }, [initialLives]);

  // Keep input focused
  useEffect(() => {
    if (isPlaying && !isPaused) {
      inputRef.current?.focus();
    }
  }, [isPlaying, isPaused]);

  // Calculate Combo Multiplier
  const getComboMultiplier = useCallback((c: number) => {
    if (c >= 20) return 3.0; // FEVER
    if (c >= 10) return 2.0;
    if (c >= 5) return 1.5;
    if (c >= 2) return 1.2;
    return 1.0;
  }, []);

  // Spawn a new meteor
  const spawnMeteor = useCallback(() => {
    if (words.length === 0) return;

    // Pick a random word
    const randomWord = words[Math.floor(Math.random() * words.length)];

    // Ensure meteor x coordinate is spaced between 12% and 88%
    const x = Math.floor(Math.random() * 74) + 13;

    // Base speed depending on difficulty and current multiplier
    let baseSpeed = 0.12;
    if (randomWord.difficulty === 'normal') baseSpeed = 0.15;
    if (randomWord.difficulty === 'hard') baseSpeed = 0.18;

    const speed = baseSpeed * speedMultiplierRef.current;

    const newMeteor: ActiveMeteor = {
      id: `meteor_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      word: randomWord,
      x,
      y: -5, // Start above the top edge
      speed,
      size: Math.max(80, Math.min(180, randomWord.text.length * 16 + 40)),
      color:
        randomWord.difficulty === 'hard'
          ? '#f43f5e'
          : randomWord.difficulty === 'normal'
          ? '#eab308'
          : '#38bdf8',
    };

    meteorsRef.current.push(newMeteor);
  }, [words]);

  // Create Explosion Particles
  const createExplosion = (x: number, y: number, color: string) => {
    const count = 28;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 5 + 2;
      particlesRef.current.push({
        id: `p_${Date.now()}_${i}`,
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        alpha: 1,
        size: Math.random() * 4 + 2,
        color: ['#ffffff', color, '#fef08a', '#f97316'][Math.floor(Math.random() * 4)],
      });
    }
  };

  // Trigger Laser Beam
  const fireLaser = (targetX: number, targetY: number, currentCombo: number) => {
    const isFever = currentCombo >= 20;
    lasersRef.current.push({
      id: `laser_${Date.now()}`,
      startX: 50, // Ship is at 50% bottom
      startY: 88,
      targetX,
      targetY,
      progress: 0,
      color: isFever ? '#ec4899' : currentCombo >= 10 ? '#a855f7' : '#38bdf8',
    });
  };

  // Main Game Loop
  useEffect(() => {
    if (!isPlaying || isPaused) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
      const height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

      ctx.clearRect(0, 0, width, height);

      // 1. Meteor Spawning
      const now = Date.now();
      const currentSpawnInterval = Math.max(2000, 4200 - Math.min(wordsDestroyed * 70, 2200));
      const maxConcurrent = Math.min(6, 3 + Math.floor(wordsDestroyed / 8));

      if (now - lastSpawnTimeRef.current > currentSpawnInterval && meteorsRef.current.length < maxConcurrent) {
        spawnMeteor();
        lastSpawnTimeRef.current = now;
      }

      // 2. Update and Draw Meteors
      const survivingMeteors: ActiveMeteor[] = [];
      const shieldY = height * 0.82;

      for (const meteor of meteorsRef.current) {
        meteor.y += meteor.speed * 60 * dt;

        // Meteor Coordinates in Pixels
        const px = (meteor.x / 100) * width;
        const py = (meteor.y / 100) * height;

        // Check if meteor hit bottom shield
        if (py >= shieldY && !meteor.isHit) {
          // Breach shield!
          sound.playShieldDamage();
          createExplosion(px, shieldY, '#f43f5e');
          setShieldHitFlash(true);
          setTimeout(() => setShieldHitFlash(false), 300);

          setLives((prev) => {
            const next = prev - 1;
            if (next <= 0) {
              // Trigger Game Over
              setIsPlaying(false);
              const acc = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 100;
              onGameOver({
                score,
                accuracy: acc,
                maxCombo,
                wordsDestroyed,
              });
            }
            return next;
          });

          // Reset combo
          setCombo(0);
          continue;
        }

        survivingMeteors.push(meteor);

        // Draw Meteor
        ctx.save();
        ctx.translate(px, py);

        // Meteor Rock Graphic
        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = meteor.color;

        // Rock polygon
        ctx.beginPath();
        const r = 24;
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        const rockGrad = ctx.createRadialGradient(-6, -6, 2, 0, 0, r);
        rockGrad.addColorStop(0, '#334155');
        rockGrad.addColorStop(0.7, '#1e293b');
        rockGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = rockGrad;
        ctx.fill();

        // Glowing outer border
        ctx.strokeStyle = meteor.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // Fire tail behind meteor
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-12, -r + 4);
        ctx.quadraticCurveTo(0, -r - 28 - Math.random() * 10, 12, -r + 4);
        ctx.fillStyle = ctx.createLinearGradient(0, -r, 0, -r - 35);
        ctx.fillStyle.addColorStop?.(0, meteor.color);
        ctx.fillStyle.addColorStop?.(1, 'rgba(0,0,0,0)');
        ctx.fill();
        ctx.restore();

        // Text Badge Plate
        const text = meteor.word.text;
        ctx.font = 'bold 19px "Pretendard", "Noto Sans KR", sans-serif';
        const textMetrics = ctx.measureText(text);
        const paddingX = 18;
        const boxWidth = textMetrics.width + paddingX * 2;
        const boxHeight = 36;
        const boxY = r + 10;

        // Draw Badge Background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = meteor.color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.roundRect(-boxWidth / 2, boxY, boxWidth, boxHeight, 10);
        ctx.fill();
        ctx.stroke();

        // Highlight matching prefix if student typed part of it
        const currentInput = inputText.trim();
        const isPrefix = currentInput.length > 0 && text.startsWith(currentInput);

        if (isPrefix) {
          ctx.fillStyle = '#fef08a'; // Glowing yellow for typed prefix
        } else {
          ctx.fillStyle = '#ffffff';
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Custom render to clearly indicate spacing for elementary students
        // Replace spaces with small visible spacer dot for readability
        const displaySpaced = text.split('').map((char) => (char === ' ' ? '·' : char)).join('');
        ctx.fillText(displaySpaced, 0, boxY + boxHeight / 2);

        // Category Tag
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = meteor.color;
        ctx.fillText(meteor.word.category, 0, boxY - 7);

        ctx.restore();
      }
      meteorsRef.current = survivingMeteors;

      // 3. Update and Draw Laser Beams
      const survivingLasers: LaserBeam[] = [];
      for (const laser of lasersRef.current) {
        laser.progress += dt * 6.5; // Fast travel
        const sx = (laser.startX / 100) * width;
        const sy = (laser.startY / 100) * height;
        const tx = (laser.targetX / 100) * width;
        const ty = (laser.targetY / 100) * height;

        ctx.save();
        ctx.strokeStyle = laser.color;
        ctx.lineWidth = 5;
        ctx.shadowBlur = 18;
        ctx.shadowColor = laser.color;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        const curX = sx + (tx - sx) * Math.min(1, laser.progress);
        const curY = sy + (ty - sy) * Math.min(1, laser.progress);
        ctx.lineTo(curX, curY);
        ctx.stroke();

        // Inner bright core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        if (laser.progress < 1) {
          survivingLasers.push(laser);
        }
      }
      lasersRef.current = survivingLasers;

      // 4. Update and Draw Explosion Particles
      const survivingParticles: ExplosionParticle[] = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= dt * 2.2;

        if (p.alpha > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.restore();
          survivingParticles.push(p);
        }
      }
      particlesRef.current = survivingParticles;

      // 5. Draw Protective Shield Line
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, shieldY);
      ctx.lineTo(width, shieldY);
      ctx.strokeStyle = shieldHitFlash ? '#f43f5e' : 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = shieldHitFlash ? 4 : 2;
      ctx.shadowBlur = shieldHitFlash ? 20 : 8;
      ctx.shadowColor = shieldHitFlash ? '#f43f5e' : '#38bdf8';
      ctx.stroke();
      ctx.restore();

      // 6. Draw Player Spaceship at Bottom Center
      const shipX = width * 0.5;
      const shipY = height * 0.88;

      ctx.save();
      ctx.translate(shipX, shipY);
      ctx.rotate(shipAngleRef.current);

      // Spaceship Body
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = combo >= 20 ? '#ec4899' : '#38bdf8';

      // Wings
      ctx.beginPath();
      ctx.moveTo(0, -32);
      ctx.lineTo(26, 20);
      ctx.lineTo(0, 8);
      ctx.lineTo(-26, 20);
      ctx.closePath();
      const shipGrad = ctx.createLinearGradient(0, -32, 0, 20);
      shipGrad.addColorStop(0, '#e0f2fe');
      shipGrad.addColorStop(0.5, '#0284c7');
      shipGrad.addColorStop(1, '#0369a1');
      ctx.fillStyle = shipGrad;
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cockpit dome
      ctx.beginPath();
      ctx.arc(0, -10, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      // Thruster Flame
      ctx.beginPath();
      ctx.moveTo(-8, 12);
      ctx.lineTo(0, 24 + Math.random() * 8);
      ctx.lineTo(8, 12);
      ctx.fillStyle = '#f97316';
      ctx.fill();

      ctx.restore();
      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isPaused, wordsDestroyed, spawnMeteor, totalAttempts, correctAttempts, score, maxCombo, onGameOver, inputText, combo]);

  // Handle Target Typing Submission
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = inputText.trim();
    if (!cleanInput) return;

    setTotalAttempts((prev) => prev + 1);

    // Find the lowest falling meteor that matches cleanInput
    let matchedMeteorIndex = -1;
    let maxY = -999;

    for (let i = 0; i < meteorsRef.current.length; i++) {
      const m = meteorsRef.current[i];
      if (m.word.text.trim() === cleanInput && m.y > maxY) {
        maxY = m.y;
        matchedMeteorIndex = i;
      }
    }

    if (matchedMeteorIndex !== -1) {
      // SUCCESS HIT!
      const target = meteorsRef.current[matchedMeteorIndex];
      target.isHit = true;

      // Update aim angle toward target
      const canvas = canvasRef.current;
      if (canvas) {
        const sx = canvas.width * 0.5;
        const sy = canvas.height * 0.88;
        const tx = (target.x / 100) * canvas.width;
        const ty = (target.y / 100) * canvas.height;
        shipAngleRef.current = Math.atan2(tx - sx, -(ty - sy));
      }

      // Calculate new combo
      const newCombo = combo + 1;
      setCombo(newCombo);
      if (newCombo > maxCombo) {
        setMaxCombo(newCombo);
      }

      // Play laser sound and fire beam
      sound.playLaser(newCombo);
      fireLaser(target.x, target.y, newCombo);

      // Explode after slight laser delay
      setTimeout(() => {
        sound.playExplosion();
        if (canvasRef.current) {
          const px = (target.x / 100) * canvasRef.current.width;
          const py = (target.y / 100) * canvasRef.current.height;
          createExplosion(px, py, target.color);
        }
      }, 70);

      // Score calculation
      const mult = getComboMultiplier(newCombo);
      let basePoints = 100;
      if (target.word.difficulty === 'normal') basePoints = 150;
      if (target.word.difficulty === 'hard') basePoints = 250;

      // Bonus points for shooting earlier (higher up)
      const heightBonus = Math.max(0, Math.round((70 - target.y) * 1.5));
      const gainedScore = Math.round((basePoints + heightBonus) * mult);

      setScore((prev) => prev + gainedScore);
      setWordsDestroyed((prev) => prev + 1);
      setCorrectAttempts((prev) => prev + 1);

      // Combo milestone chime
      if (newCombo > 0 && newCombo % 5 === 0) {
        sound.playCombo();
      }

      // Set active hint if word has one
      if (target.word.hint) {
        setActiveHint(`💡 [${target.word.text}] ${target.word.hint}`);
        setTimeout(() => setActiveHint(null), 4000);
      }

      // Remove the meteor
      meteorsRef.current.splice(matchedMeteorIndex, 1);
      setInputText('');

      // Slightly increase game speed
      speedMultiplierRef.current = Math.min(2.5, initialFallSpeed + (wordsDestroyed + 1) * 0.02);
    } else {
      // TYPO OR MISMATCH!
      sound.playTypo();
      setCombo(0);
      setIsInputShaking(true);
      setTimeout(() => setIsInputShaking(false), 300);
    }
  };

  // Toggle Sound Mute
  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  // Toggle Pause
  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const comboMultiplier = getComboMultiplier(combo);
  const isFever = combo >= 20;

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none">
      {/* Top HUD Bar */}
      <div className="relative z-20 px-4 sm:px-6 py-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between text-white">
        {/* Left: Player Profile & Lives */}
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm sm:text-base text-cyan-300">대원: {studentName}</span>
          </div>

          {/* Life Hearts */}
          <div className="flex items-center gap-1">
            {Array.from({ length: initialLives }).map((_, i) => (
              <Heart
                key={i}
                className={`w-6 h-6 transition-all duration-300 ${
                  i < lives
                    ? 'text-rose-500 fill-rose-500 filter drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                    : 'text-slate-600 fill-slate-800 scale-90 opacity-40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Center: Score & Combo */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-center">
            <div className="text-[10px] sm:text-xs font-semibold text-slate-400">점수</div>
            <div className="text-xl sm:text-2xl font-black text-amber-300 tracking-wider">
              {score.toLocaleString()}
            </div>
          </div>

          {/* Combo badge */}
          {combo > 1 && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-xs sm:text-sm animate-pulse shadow-lg ${
                isFever
                  ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white shadow-pink-500/50'
                  : combo >= 10
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-amber-500/40'
                  : 'bg-indigo-600 text-white shadow-indigo-500/30'
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>{combo} COMBO ({comboMultiplier}x)</span>
            </div>
          )}
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSound}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition"
            title={isMuted ? '소리 켜기' : '소리 끄기'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>
          <button
            onClick={handleTogglePause}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition"
            title={isPaused ? '계속하기' : '일시정지'}
          >
            {isPaused ? <Play className="w-5 h-5 text-amber-400" /> : <Pause className="w-5 h-5 text-slate-300" />}
          </button>
          <button
            onClick={onOpenLeaderboard}
            className="hidden sm:flex px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-200 transition items-center gap-1"
          >
            명예의 전당
          </button>
          <button
            onClick={onOpenTeacher}
            className="px-2.5 py-2 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-xs text-indigo-300 font-semibold border border-indigo-500/30 transition"
          >
            교사 모드
          </button>
          <button
            onClick={onLogout}
            className="px-2.5 py-2 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 rounded-xl text-xs font-semibold transition"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 w-full overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

        {/* Active Spelling / Meaning Hint banner */}
        {activeHint && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-indigo-950/90 border border-indigo-400/50 rounded-2xl text-indigo-200 text-sm font-semibold shadow-xl shadow-indigo-500/20 backdrop-blur-md animate-bounce">
            {activeHint}
          </div>
        )}

        {/* Paused Overlay */}
        {isPaused && (
          <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <div className="p-8 bg-slate-900 border border-slate-700 rounded-3xl text-center max-w-sm">
              <Pause className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h3 className="text-2xl font-bold mb-2">잠시 멈춤</h3>
              <p className="text-sm text-slate-400 mb-6">숨을 고르고 준비되면 계속하기를 눌러주세요!</p>
              <button
                onClick={handleTogglePause}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-bold rounded-xl text-base shadow-lg transition"
              >
                계속하기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control & Input Bar */}
      <div className="relative z-20 p-4 sm:p-6 bg-slate-900/90 backdrop-blur-md border-t border-slate-800">
        <div className="max-w-2xl mx-auto">
          {/* Spacing & Typing Guide for Students */}
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
            <span className="flex items-center gap-1">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              떨어지는 단어를 타이핑하고 <strong className="text-cyan-300">Enter(엔터)</strong>를 누르세요!
            </span>
            <span className="text-indigo-300">
              💡 띄어쓰기는 <span className="text-amber-300 font-bold">·</span> 기호로 표시돼요
            </span>
          </div>

          {/* Typing Input Box */}
          <form onSubmit={handleInputSubmit} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="여기에 단어를 입력하고 엔터를 치세요!"
              disabled={isPaused}
              autoFocus
              className={`w-full py-4 px-6 bg-slate-800/95 border-2 rounded-2xl text-xl sm:text-2xl font-black text-white placeholder-slate-500 focus:outline-none transition-all shadow-2xl ${
                isInputShaking
                  ? 'border-rose-500 bg-rose-950/40 animate-shake'
                  : isFever
                  ? 'border-pink-500 focus:border-pink-400 focus:ring-4 focus:ring-pink-500/20 shadow-pink-500/20'
                  : 'border-indigo-500/60 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20 shadow-indigo-500/20'
              }`}
            />
            <button
              type="submit"
              disabled={isPaused || !inputText.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 disabled:opacity-40 text-white font-bold rounded-xl text-sm shadow transition"
            >
              발사! 🚀
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
