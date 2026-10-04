import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Award, Zap, Crosshair, Star, CheckCircle } from 'lucide-react';
import { sound } from '../utils/sound';

interface GameOverModalProps {
  score: number;
  accuracy: number;
  maxCombo: number;
  wordsDestroyed: number;
  isNewHighScore: boolean;
  studentName: string;
  onRestart: () => void;
  onOpenLeaderboard: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  accuracy,
  maxCombo,
  wordsDestroyed,
  isNewHighScore,
  studentName,
  onRestart,
  onOpenLeaderboard,
}) => {
  useEffect(() => {
    if (isNewHighScore && score > 0) {
      sound.playFanfare();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#818cf8', '#c084fc', '#facc15', '#34d399'],
      });
    } else {
      sound.playGameOver();
    }
  }, [isNewHighScore, score]);

  // Rank title for 3-4th graders
  const getRankBadge = () => {
    if (score >= 5000) return { title: '은하계 최고 수호신 👑', color: 'from-amber-400 to-yellow-500' };
    if (score >= 3000) return { title: '우주방어 특등 사령관 🌟', color: 'from-purple-400 to-indigo-500' };
    if (score >= 1500) return { title: '빛의 광속 파일럿 🚀', color: 'from-cyan-400 to-blue-500' };
    if (score >= 500) return { title: '지구 방어 든든 요원 🛡️', color: 'from-emerald-400 to-teal-500' };
    return { title: '우주 탐험 수습 대원 🛸', color: 'from-slate-400 to-slate-500' };
  };

  const badge = getRankBadge();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-indigo-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-white text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-24 -left-24 w-52 h-52 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-52 h-52 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Badge Ribbon */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-sm font-bold mb-4 shadow">
          <Award className="w-4 h-4 text-amber-400" />
          <span className={`bg-gradient-to-r ${badge.color} bg-clip-text text-transparent font-black text-base`}>
            {badge.title}
          </span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-1">
          우주 방어 임무 완료!
        </h2>
        <p className="text-sm text-slate-300 mb-6">
          <span className="font-bold text-indigo-300">{studentName}</span> 대원, 지구를 지키느라 수고했어요!
        </p>

        {isNewHighScore && (
          <div className="mb-5 py-2 px-4 bg-amber-500/20 border border-amber-400/40 rounded-2xl flex items-center justify-center gap-2 text-amber-300 font-bold text-sm animate-pulse">
            <Star className="w-5 h-5 fill-amber-300 text-amber-300" />
            <span>🎉 내 최고 점수를 갱신했어요!</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col items-center">
            <div className="text-slate-400 text-xs font-semibold flex items-center gap-1 mb-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" /> 획득 점수
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-300">
              {score.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col items-center">
            <div className="text-slate-400 text-xs font-semibold flex items-center gap-1 mb-1">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" /> 격추한 운석
            </div>
            <div className="text-2xl sm:text-3xl font-black text-cyan-300">
              {wordsDestroyed} <span className="text-base font-normal text-slate-400">개</span>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col items-center">
            <div className="text-slate-400 text-xs font-semibold flex items-center gap-1 mb-1">
              <Zap className="w-3.5 h-3.5 text-purple-400" /> 최고 콤보
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-300">
              {maxCombo} <span className="text-sm font-normal text-slate-400">연속</span>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col items-center">
            <div className="text-slate-400 text-xs font-semibold flex items-center gap-1 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> 타자 정확도
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-300">
              {accuracy}%
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onRestart}
            className="flex-1 py-3.5 px-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white font-black rounded-2xl text-base shadow-lg shadow-indigo-500/25 transition flex items-center justify-center gap-2 transform active:scale-98"
          >
            <RotateCcw className="w-5 h-5" />
            한 번 더 도전하기!
          </button>
          <button
            onClick={onOpenLeaderboard}
            className="py-3.5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-2xl text-base transition flex items-center justify-center gap-2"
          >
            <Trophy className="w-5 h-5 text-amber-400" />
            학급 랭킹 보기
          </button>
        </div>
      </div>
    </div>
  );
};
