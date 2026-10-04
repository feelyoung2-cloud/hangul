import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { LeaderboardEntry } from '../types';
import { Trophy, Medal, Sparkles, X, ArrowLeft } from 'lucide-react';

interface LeaderboardViewProps {
  currentStudentId?: string;
  onClose: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ currentStudentId, onClose }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTop = async () => {
      try {
        const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(30));
        const snap = await getDocs(q);
        const list: LeaderboardEntry[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<LeaderboardEntry, 'id'>),
        }));
        setEntries(list);
      } catch (err) {
        console.error('Leaderboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTop();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                우주 명예의 전당 <Sparkles className="w-4 h-4 text-amber-300" />
              </h2>
              <p className="text-xs text-slate-400">우리 반 친구들의 최고 타자 방어 점수예요</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p>순위를 불러오고 있어요...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-300">아직 등록된 기록이 없어요.</p>
              <p className="text-xs text-slate-500 mt-1">게임을 플레이하고 1등의 주인공이 되어 보세요!</p>
            </div>
          ) : (
            entries.map((entry, idx) => {
              const isMe = currentStudentId && entry.studentId === currentStudentId;
              return (
                <div
                  key={entry.id}
                  className={`p-3 sm:p-4 rounded-2xl flex items-center justify-between transition border ${
                    idx === 0
                      ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
                      : idx === 1
                      ? 'bg-gradient-to-r from-slate-400/20 to-slate-500/10 border-slate-400/40'
                      : idx === 2
                      ? 'bg-gradient-to-r from-amber-700/20 to-amber-800/10 border-amber-700/40'
                      : isMe
                      ? 'bg-indigo-900/40 border-indigo-500/60'
                      : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Rank Badge */}
                    <div className="w-10 text-center font-black">
                      {idx === 0 ? (
                        <span className="text-2xl">🥇</span>
                      ) : idx === 1 ? (
                        <span className="text-2xl">🥈</span>
                      ) : idx === 2 ? (
                        <span className="text-2xl">🥉</span>
                      ) : (
                        <span className="text-base text-slate-400 font-bold">{idx + 1}위</span>
                      )}
                    </div>

                    {/* Student Name */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-base sm:text-lg">
                          {entry.studentName}
                        </span>
                        {isMe && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500 text-white shadow">
                            나
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>격추 {entry.wordsDestroyed}개</span>
                        <span>•</span>
                        <span>정확도 {entry.accuracy}%</span>
                        <span>•</span>
                        <span>최대 {entry.maxCombo}콤보</span>
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <div className="text-xl sm:text-2xl font-black text-amber-300">
                      {entry.score.toLocaleString()} <span className="text-xs font-semibold text-slate-400">점</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800/60 border-t border-slate-700/80 text-center">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            게임으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};
