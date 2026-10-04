export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Word {
  id: string;
  text: string;
  category: string;
  hint?: string;
  difficulty: Difficulty;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  passwordHash: string;
  salt?: string;
  needsPasswordReset?: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LeaderboardEntry {
  id: string;
  studentId: string;
  studentName: string;
  score: number;
  accuracy: number;
  maxCombo: number;
  wordsDestroyed: number;
  achievedAt: string;
}

export interface SystemSettings {
  isInitialized: boolean;
  adminPasswordHash?: string;
  adminSalt?: string;
  initialLives?: number;
  initialFallSpeed?: number;
  updatedAt: string;
}

export interface ActiveMeteor {
  id: string;
  word: Word;
  x: number; // percentage (10% ~ 90%)
  y: number; // percentage (0% at top, 85% at bottom)
  speed: number;
  size: number;
  color: string;
  isHit?: boolean;
}

export interface LaserBeam {
  id: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  color: string;
}

export interface ExplosionParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}
