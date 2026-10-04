import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { db, testLiveFirestoreConnection } from './firebase';
import { Word, Student, SystemSettings, LeaderboardEntry } from './types';
import { DEFAULT_ELEMENTARY_WORDS } from './utils/defaultWords';
import { SpaceBackground } from './components/SpaceBackground';
import { StudentLoginModal } from './components/StudentLoginModal';
import { GameCanvas } from './components/GameCanvas';
import { GameOverModal } from './components/GameOverModal';
import { LeaderboardView } from './components/LeaderboardView';
import { TeacherDashboardModal } from './components/TeacherDashboardModal';
import { Rocket, Sparkles, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';

export default function App() {
  // Connection & Initialization State
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'error'>('testing');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Student Session
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Data & Settings
  const [words, setWords] = useState<Word[]>([]);
  const [gameSettings, setGameSettings] = useState<SystemSettings>({
    isInitialized: false,
    initialLives: 3,
    initialFallSpeed: 1,
    updatedAt: new Date().toISOString(),
  });

  // Game UI States
  const [gameKey, setGameKey] = useState<number>(1);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showTeacherDashboard, setShowTeacherDashboard] = useState<boolean>(false);
  const [gameOverStats, setGameOverStats] = useState<{
    score: number;
    accuracy: number;
    maxCombo: number;
    wordsDestroyed: number;
    isNewHighScore: boolean;
  } | null>(null);

  // 1. Verify Firestore Connection on App Boot
  const checkConnection = useCallback(async () => {
    setConnectionStatus('testing');
    setConnectionError(null);

    const result = await testLiveFirestoreConnection();
    if (result.success) {
      setConnectionStatus('connected');
      loadInitialData();
    } else {
      setConnectionStatus('error');
      setConnectionError(result.error || 'Firestore 데이터베이스 연결에 실패했습니다.');
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // 2. Load Words & Settings from Firestore
  const loadInitialData = async () => {
    try {
      // Load Settings
      const settingsSnap = await getDocs(collection(db, 'settings'));
      if (!settingsSnap.empty) {
        const conf = settingsSnap.docs[0].data() as SystemSettings;
        setGameSettings(conf);
      }

      // Load Words
      const wordsSnap = await getDocs(collection(db, 'words'));
      if (wordsSnap.empty) {
        // Auto-seed initial 50 words so the game is immediately playable!
        console.log('Seeding initial elementary words to Firestore...');
        const initialList: Word[] = [];
        for (const item of DEFAULT_ELEMENTARY_WORDS) {
          const docRef = doc(collection(db, 'words'));
          const wordObj: Word = {
            id: docRef.id,
            ...item,
            createdAt: new Date().toISOString(),
          };
          await setDoc(docRef, {
            text: wordObj.text,
            category: wordObj.category,
            difficulty: wordObj.difficulty,
            hint: wordObj.hint || undefined,
            createdAt: wordObj.createdAt,
          });
          initialList.push(wordObj);
        }
        setWords(initialList);
      } else {
        const loaded: Word[] = wordsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Word, 'id'>),
        }));
        setWords(loaded);
      }

      // Check Saved Student Session in localStorage
      const savedStudentStr = localStorage.getItem('space_defense_active_student');
      if (savedStudentStr) {
        try {
          const parsed = JSON.parse(savedStudentStr) as Student;
          // Verify with Firestore
          const studentDoc = await getDoc(doc(db, 'students', parsed.id));
          if (studentDoc.exists()) {
            const data = studentDoc.data() as Student;
            if (data.needsPasswordReset) {
              // If flagged for reset, force login modal
              setCurrentStudent(null);
              setShowLoginModal(true);
            } else {
              setCurrentStudent({ ...data, id: studentDoc.id });
              setShowLoginModal(false);
            }
          } else {
            setShowLoginModal(true);
          }
        } catch {
          setShowLoginModal(true);
        }
      } else {
        setShowLoginModal(true);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  // Handle Student Login
  const handleStudentLoginSuccess = (student: Student) => {
    setCurrentStudent(student);
    localStorage.setItem('space_defense_active_student', JSON.stringify(student));
    setShowLoginModal(false);
  };

  // Handle Student Logout
  const handleStudentLogout = () => {
    localStorage.removeItem('space_defense_active_student');
    setCurrentStudent(null);
    setShowLoginModal(true);
    setGameOverStats(null);
  };

  // Handle Game Over & Save Score to Firestore Leaderboard
  const handleGameOver = async (stats: {
    score: number;
    accuracy: number;
    maxCombo: number;
    wordsDestroyed: number;
  }) => {
    let isNewHighScore = false;

    if (currentStudent && stats.score > 0) {
      try {
        const leaderboardDocRef = doc(db, 'leaderboard', `leader_${currentStudent.id}`);
        const existingSnap = await getDoc(leaderboardDocRef);

        if (!existingSnap.exists()) {
          // First score
          isNewHighScore = true;
          await setDoc(leaderboardDocRef, {
            studentId: currentStudent.id,
            studentName: currentStudent.name,
            score: stats.score,
            accuracy: stats.accuracy,
            maxCombo: stats.maxCombo,
            wordsDestroyed: stats.wordsDestroyed,
            achievedAt: new Date().toISOString(),
          });
        } else {
          const oldData = existingSnap.data() as LeaderboardEntry;
          if (stats.score > oldData.score) {
            isNewHighScore = true;
            await setDoc(leaderboardDocRef, {
              studentId: currentStudent.id,
              studentName: currentStudent.name,
              score: stats.score,
              accuracy: stats.accuracy,
              maxCombo: stats.maxCombo,
              wordsDestroyed: stats.wordsDestroyed,
              achievedAt: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error('Failed to save score to leaderboard:', err);
      }
    }

    setGameOverStats({
      ...stats,
      isNewHighScore,
    });
  };

  // Restart Game
  const handleRestartGame = () => {
    setGameOverStats(null);
    setGameKey((prev) => prev + 1);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Dynamic Animated Starfield Background */}
      <SpaceBackground />

      {/* 1. Loading & Connection Check Screen */}
      {connectionStatus === 'testing' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-slate-950/90 text-white text-center">
          <div className="p-4 bg-indigo-500/20 border border-indigo-400/30 rounded-3xl mb-4 animate-bounce">
            <Rocket className="w-12 h-12 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-black mb-2">우주 방어 사령부 연결 중...</h2>
          <p className="text-sm text-slate-400 max-w-sm mb-6">
            실시간 데이터베이스(Firestore)를 안전하게 확인하고 있습니다. 잠시만 기다려 주세요.
          </p>
          <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      )}

      {/* 2. Connection Error Screen */}
      {connectionStatus === 'error' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-slate-950/95 text-white text-center">
          <div className="p-4 bg-rose-500/20 border border-rose-400/30 rounded-3xl mb-4">
            <AlertCircle className="w-12 h-12 text-rose-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">데이터베이스 연결 실패</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            서버와의 연결이 일시적으로 원활하지 않습니다. 인터넷 연결을 확인하신 후 다시 시도해 주세요.
          </p>
          <button
            onClick={checkConnection}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center gap-2 shadow-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도하기
          </button>
        </div>
      )}

      {/* 3. Main Gameplay when connected */}
      {connectionStatus === 'connected' && currentStudent && (
        <div className="relative z-10 w-full h-full flex flex-col">
          <GameCanvas
            key={gameKey}
            words={words}
            studentName={currentStudent.name}
            initialLives={gameSettings.initialLives || 3}
            initialFallSpeed={gameSettings.initialFallSpeed || 1}
            onGameOver={handleGameOver}
            onOpenLeaderboard={() => setShowLeaderboard(true)}
            onOpenTeacher={() => setShowTeacherDashboard(true)}
            onLogout={handleStudentLogout}
          />
        </div>
      )}

      {/* 4. Student Login Modal */}
      {connectionStatus === 'connected' && showLoginModal && (
        <StudentLoginModal onLoginSuccess={handleStudentLoginSuccess} />
      )}

      {/* 5. Game Over Modal */}
      {gameOverStats && currentStudent && (
        <GameOverModal
          score={gameOverStats.score}
          accuracy={gameOverStats.accuracy}
          maxCombo={gameOverStats.maxCombo}
          wordsDestroyed={gameOverStats.wordsDestroyed}
          isNewHighScore={gameOverStats.isNewHighScore}
          studentName={currentStudent.name}
          onRestart={handleRestartGame}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      )}

      {/* 6. Leaderboard View Modal */}
      {showLeaderboard && (
        <LeaderboardView
          currentStudentId={currentStudent?.id}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {/* 7. Teacher Dashboard Modal */}
      {showTeacherDashboard && (
        <TeacherDashboardModal
          isOpen={showTeacherDashboard}
          onClose={() => setShowTeacherDashboard(false)}
          onWordsUpdated={() => loadInitialData()}
        />
      )}
    </div>
  );
}
