import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query
} from 'firebase/firestore';
import { db } from '../firebase';
import { Word, Student, LeaderboardEntry, SystemSettings } from '../types';
import { DEFAULT_ELEMENTARY_WORDS } from '../utils/defaultWords';
import { generateSalt, hashPassword, verifyPassword } from '../utils/crypto';
import {
  ShieldAlert,
  BookOpen,
  Users,
  Trophy,
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  X,
  Sparkles,
  CheckCircle,
  AlertCircle,
  KeyRound,
  Lock,
  Download
} from 'lucide-react';

interface TeacherDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWordsUpdated?: () => void;
}

export const TeacherDashboardModal: React.FC<TeacherDashboardModalProps> = ({
  isOpen,
  onClose,
  onWordsUpdated,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFirstSetup, setIsFirstSetup] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [settingsDoc, setSettingsDoc] = useState<SystemSettings | null>(null);

  // Auth Inputs
  const [inputPassword, setInputPassword] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'words' | 'students' | 'leaderboard' | 'settings'>('words');

  // Words State
  const [words, setWords] = useState<Word[]>([]);
  const [wordFilter, setWordFilter] = useState<'all' | '맞춤법' | '띄어쓰기' | '속담'>('all');
  const [wordSearch, setWordSearch] = useState('');
  const [isEditingWord, setIsEditingWord] = useState<Word | null>(null);
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [newWordText, setNewWordText] = useState('');
  const [newWordCategory, setNewWordCategory] = useState('맞춤법');
  const [newWordDifficulty, setNewWordDifficulty] = useState<'easy' | 'normal' | 'hard'>('easy');
  const [newWordHint, setNewWordHint] = useState('');

  // Students State
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Action status message
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // 1. Fetch System Settings on Open
  useEffect(() => {
    if (!isOpen) {
      setIsAuthenticated(false);
      setInputPassword('');
      setAuthError(null);
      return;
    }

    const loadSettings = async () => {
      setLoadingConfig(true);
      try {
        const settingsSnap = await getDocs(collection(db, 'settings'));
        if (settingsSnap.empty) {
          setIsFirstSetup(true);
        } else {
          const docData = settingsSnap.docs[0].data() as SystemSettings;
          setSettingsDoc(docData);
          if (!docData.adminPasswordHash) {
            setIsFirstSetup(true);
          } else {
            setIsFirstSetup(false);
          }
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoadingConfig(false);
      }
    };

    loadSettings();
  }, [isOpen]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ text, type });
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Handle Initial Password Setup
  const handleInitialSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (setupPassword.length < 4) {
      setAuthError('비밀번호를 4자리 이상으로 입력해 주세요.');
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setAuthError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    try {
      const salt = generateSalt(16);
      const hash = await hashPassword(setupPassword, salt);
      const newSettings: SystemSettings = {
        isInitialized: true,
        adminPasswordHash: hash,
        adminSalt: salt,
        initialLives: 3,
        initialFallSpeed: 1,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'settings', 'global_config'), newSettings);
      setSettingsDoc(newSettings);
      setIsFirstSetup(false);
      setIsAuthenticated(true);
      showToast('선생님 관리자 비밀번호가 성공적으로 설정되었습니다!');
      loadAllDashboardData();
    } catch (err) {
      console.error(err);
      setAuthError('설정 저장 중 오류가 발생했습니다.');
    }
  };

  // Handle Login to Dashboard
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!settingsDoc?.adminPasswordHash || !settingsDoc?.adminSalt) {
      setAuthError('설정 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      return;
    }

    const isValid = await verifyPassword(inputPassword, settingsDoc.adminSalt, settingsDoc.adminPasswordHash);
    if (!isValid) {
      setAuthError('관리자 비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsAuthenticated(true);
    loadAllDashboardData();
  };

  // Load Words, Students, Leaderboard
  const loadAllDashboardData = async () => {
    loadWords();
    loadStudents();
    loadLeaderboard();
  };

  const loadWords = async () => {
    try {
      const snap = await getDocs(collection(db, 'words'));
      const list: Word[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Word, 'id'>),
      }));
      setWords(list);
    } catch (err) {
      console.error('Error fetching words:', err);
    }
  };

  const loadStudents = async () => {
    try {
      const snap = await getDocs(collection(db, 'students'));
      const list: Student[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Student, 'id'>),
      }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setStudents(list);
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'));
      const snap = await getDocs(q);
      const list: LeaderboardEntry[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LeaderboardEntry, 'id'>),
      }));
      setLeaderboard(list);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    }
  };

  // Auto-seed 50 Elementary Words
  const handleSeedDefaultWords = async () => {
    if (!window.confirm('초등 3~4학년 맞춤법/띄어쓰기/속담 추천 단어 50개를 단어장에 추가하시겠습니까?')) {
      return;
    }

    setIsSeeding(true);
    try {
      let count = 0;
      for (const item of DEFAULT_ELEMENTARY_WORDS) {
        // Check duplicate by text
        const exists = words.some((w) => w.text === item.text);
        if (!exists) {
          const newDocRef = doc(collection(db, 'words'));
          await setDoc(newDocRef, {
            ...item,
            createdAt: new Date().toISOString(),
          });
          count++;
        }
      }
      await loadWords();
      if (onWordsUpdated) onWordsUpdated();
      showToast(`${count}개의 추천 단어 및 문장이 추가되었습니다!`);
    } catch (err) {
      console.error(err);
      showToast('단어 추가 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  // Save / Edit Word
  const handleSaveWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWordText.trim()) {
      alert('단어나 문장을 입력해 주세요.');
      return;
    }

    try {
      if (isEditingWord) {
        await updateDoc(doc(db, 'words', isEditingWord.id), {
          text: newWordText.trim(),
          category: newWordCategory,
          difficulty: newWordDifficulty,
          hint: newWordHint.trim() || undefined,
        });
        showToast('단어가 성공적으로 수정되었습니다.');
      } else {
        const newDocRef = doc(collection(db, 'words'));
        await setDoc(newDocRef, {
          text: newWordText.trim(),
          category: newWordCategory,
          difficulty: newWordDifficulty,
          hint: newWordHint.trim() || undefined,
          createdAt: new Date().toISOString(),
        });
        showToast('새 단어가 추가되었습니다.');
      }

      setShowAddWordModal(false);
      setIsEditingWord(null);
      setNewWordText('');
      setNewWordHint('');
      await loadWords();
      if (onWordsUpdated) onWordsUpdated();
    } catch (err) {
      console.error(err);
      showToast('단어 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // Delete Word
  const handleDeleteWord = async (id: string, text: string) => {
    if (!window.confirm(`'${text}' 단어를 정말 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'words', id));
      showToast(`'${text}' 단어가 삭제되었습니다.`);
      await loadWords();
      if (onWordsUpdated) onWordsUpdated();
    } catch (err) {
      console.error(err);
      showToast('단어 삭제 실패', 'error');
    }
  };

  // Reset Student Password (Flag)
  const handleResetStudentPassword = async (student: Student) => {
    if (!window.confirm(`[${student.name}] 학생의 비밀번호를 초기화하시겠습니까?\n초기화 시 학생이 로그인할 때 새로운 비밀번호를 설정할 수 있습니다.`)) {
      return;
    }

    try {
      await updateDoc(doc(db, 'students', student.id), {
        needsPasswordReset: true,
      });
      showToast(`${student.name} 학생의 비밀번호가 초기화 상태로 설정되었습니다.`);
      await loadStudents();
    } catch (err) {
      console.error(err);
      showToast('학생 비밀번호 초기화 실패', 'error');
    }
  };

  // Delete Student
  const handleDeleteStudent = async (student: Student) => {
    if (!window.confirm(`[${student.name}] 학생 계정을 완전히 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'students', student.id));
      showToast(`${student.name} 학생 계정이 삭제되었습니다.`);
      await loadStudents();
    } catch (err) {
      console.error(err);
      showToast('학생 삭제 실패', 'error');
    }
  };

  // Delete Leaderboard Entry
  const handleDeleteLeaderboard = async (entry: LeaderboardEntry) => {
    if (!window.confirm(`[${entry.studentName}] 학생의 ${entry.score.toLocaleString()}점 기록을 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'leaderboard', entry.id));
      showToast('랭킹 기록이 삭제되었습니다.');
      await loadLeaderboard();
    } catch (err) {
      console.error(err);
      showToast('기록 삭제 실패', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white relative">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                교사용 우주 사령부 <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">관리자</span>
              </h2>
              <p className="text-xs text-slate-400">단어장 편집, 학생 계정 관리 및 비밀번호 초기화, 학급 리더보드</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Action Notice Toast */}
        {actionNotice && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
              actionNotice.type === 'success'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
            }`}
          >
            {actionNotice.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{actionNotice.text}</span>
          </div>
        )}

        {/* Content Area */}
        {loadingConfig ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p>관리자 설정을 확인하는 중입니다...</p>
          </div>
        ) : !isAuthenticated ? (
          /* Authentication Screen */
          <div className="p-8 sm:p-12 max-w-md mx-auto w-full my-auto">
            {isFirstSetup ? (
              <div>
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 bg-amber-500/20 text-amber-400 rounded-2xl mb-3">
                    <KeyRound className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold">선생님 비밀번호 최초 설정</h3>
                  <p className="text-sm text-slate-400 mt-1">단어장과 학생 관리에 사용할 비밀번호를 정해 주세요.</p>
                </div>

                {authError && (
                  <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-sm rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleInitialSetup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">관리자 비밀번호 (4자리 이상)</label>
                    <input
                      type="password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="비밀번호 입력"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">비밀번호 확인</label>
                    <input
                      type="password"
                      value={setupConfirmPassword}
                      onChange={(e) => setSetupConfirmPassword(e.target.value)}
                      placeholder="비밀번호 재입력"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition"
                  >
                    관리자 비밀번호 설정 및 입장
                  </button>
                </form>
              </div>
            ) : (
              <div>
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl mb-3">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold">교사 인증</h3>
                  <p className="text-sm text-slate-400 mt-1">대시보드에 접근하려면 관리자 비밀번호를 입력해 주세요.</p>
                </div>

                {authError && (
                  <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-sm rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleTeacherLogin} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      value={inputPassword}
                      onChange={(e) => setInputPassword(e.target.value)}
                      placeholder="관리자 비밀번호 입력"
                      className="w-full px-4 py-3.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 text-lg"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition"
                  >
                    대시보드 열기
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Navigation Tabs */}
            <div className="px-6 pt-3 bg-slate-800/40 border-b border-slate-700 flex gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('words')}
                className={`px-4 py-2.5 font-bold text-sm rounded-t-xl transition flex items-center gap-2 border-b-2 ${
                  activeTab === 'words'
                    ? 'border-indigo-400 text-indigo-300 bg-slate-800'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                단어장 관리 ({words.length})
              </button>
              <button
                onClick={() => setActiveTab('students')}
                className={`px-4 py-2.5 font-bold text-sm rounded-t-xl transition flex items-center gap-2 border-b-2 ${
                  activeTab === 'students'
                    ? 'border-indigo-400 text-indigo-300 bg-slate-800'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                학생 계정 관리 ({students.length})
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`px-4 py-2.5 font-bold text-sm rounded-t-xl transition flex items-center gap-2 border-b-2 ${
                  activeTab === 'leaderboard'
                    ? 'border-indigo-400 text-indigo-300 bg-slate-800'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Trophy className="w-4 h-4" />
                명예의 전당 ({leaderboard.length})
              </button>
            </div>

            {/* TAB 1: WORDS MANAGEMENT */}
            {activeTab === 'words' && (
              <div className="flex-1 p-6 overflow-y-auto flex flex-col space-y-4">
                {/* Word Actions Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-800/70 p-4 rounded-2xl border border-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setWordFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        wordFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      전체 ({words.length})
                    </button>
                    <button
                      onClick={() => setWordFilter('맞춤법')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        wordFilter === '맞춤법' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      맞춤법
                    </button>
                    <button
                      onClick={() => setWordFilter('띄어쓰기')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        wordFilter === '띄어쓰기' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      띄어쓰기
                    </button>
                    <button
                      onClick={() => setWordFilter('속담')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        wordFilter === '속담' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      속담
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="단어 검색..."
                      value={wordSearch}
                      onChange={(e) => setWordSearch(e.target.value)}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 w-36 sm:w-44"
                    />
                    <button
                      onClick={handleSeedDefaultWords}
                      disabled={isSeeding}
                      className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                      title="초등 3~4학년 추천 단어 50개를 추가합니다"
                    >
                      <Download className="w-3.5 h-3.5" />
                      추천 50단어 채우기
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingWord(null);
                        setNewWordText('');
                        setNewWordHint('');
                        setNewWordCategory('맞춤법');
                        setNewWordDifficulty('easy');
                        setShowAddWordModal(true);
                      }}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      새 단어 추가
                    </button>
                  </div>
                </div>

                {/* Words Table */}
                <div className="flex-1 overflow-x-auto border border-slate-700/80 rounded-2xl bg-slate-900/60">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/90 text-slate-400 text-xs uppercase font-semibold border-b border-slate-700">
                      <tr>
                        <th className="px-4 py-3">단어 / 문장</th>
                        <th className="px-4 py-3">분류</th>
                        <th className="px-4 py-3">난이도</th>
                        <th className="px-4 py-3">도움말 (힌트)</th>
                        <th className="px-4 py-3 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {words
                        .filter((w) => wordFilter === 'all' || w.category === wordFilter)
                        .filter((w) => !wordSearch || w.text.includes(wordSearch) || (w.hint && w.hint.includes(wordSearch)))
                        .map((w) => (
                          <tr key={w.id} className="hover:bg-slate-800/40 transition">
                            <td className="px-4 py-3 font-bold text-white text-base">
                              {w.text}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-indigo-300">
                                {w.category}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  w.difficulty === 'easy'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : w.difficulty === 'normal'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {w.difficulty === 'easy' ? '쉬움' : w.difficulty === 'normal' ? '보통' : '어려움'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">
                              {w.hint || '-'}
                            </td>
                            <td className="px-4 py-3 text-right space-x-1">
                              <button
                                onClick={() => {
                                  setIsEditingWord(w);
                                  setNewWordText(w.text);
                                  setNewWordCategory(w.category);
                                  setNewWordDifficulty(w.difficulty);
                                  setNewWordHint(w.hint || '');
                                  setShowAddWordModal(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition"
                                title="수정"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteWord(w.id, w.text)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      {words.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            등록된 단어가 없습니다. 위의 <strong className="text-amber-300">"추천 50단어 채우기"</strong>를 눌러 시작해 보세요!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: STUDENTS MANAGEMENT */}
            {activeTab === 'students' && (
              <div className="flex-1 p-6 overflow-y-auto flex flex-col space-y-4">
                <div className="flex items-center justify-between bg-slate-800/70 p-4 rounded-2xl border border-slate-700">
                  <div>
                    <h4 className="font-bold text-sm text-white">가입된 학생 목록</h4>
                    <p className="text-xs text-slate-400">학생이 비밀번호를 잊어버렸을 경우 '비밀번호 초기화'를 클릭하세요.</p>
                  </div>
                  <input
                    type="text"
                    placeholder="학생 이름 검색..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 w-44"
                  />
                </div>

                <div className="flex-1 overflow-x-auto border border-slate-700/80 rounded-2xl bg-slate-900/60">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/90 text-slate-400 text-xs uppercase font-semibold border-b border-slate-700">
                      <tr>
                        <th className="px-4 py-3">학생 이름</th>
                        <th className="px-4 py-3">상태</th>
                        <th className="px-4 py-3">가입 일시</th>
                        <th className="px-4 py-3">최근 접속</th>
                        <th className="px-4 py-3 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {students
                        .filter((s) => !studentSearch || s.name.includes(studentSearch))
                        .map((s) => (
                          <tr key={s.id} className="hover:bg-slate-800/40 transition">
                            <td className="px-4 py-3 font-bold text-white text-base">
                              {s.name}
                            </td>
                            <td className="px-4 py-3">
                              {s.needsPasswordReset ? (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  비밀번호 초기화 대기 중
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  정상
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs">
                              {s.createdAt ? new Date(s.createdAt).toLocaleDateString('ko-KR') : '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs">
                              {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString('ko-KR') : '-'}
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => handleResetStudentPassword(s)}
                                className="px-3 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition"
                              >
                                비밀번호 초기화
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(s)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                                title="학생 계정 삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      {students.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            아직 등록된 학생이 없습니다. 학생들이 로그인 화면에서 첫 계정을 생성하면 여기에 나타납니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: LEADERBOARD MANAGEMENT */}
            {activeTab === 'leaderboard' && (
              <div className="flex-1 p-6 overflow-y-auto flex flex-col space-y-4">
                <div className="flex items-center justify-between bg-slate-800/70 p-4 rounded-2xl border border-slate-700">
                  <div>
                    <h4 className="font-bold text-sm text-white">학급 랭킹 명예의 전당</h4>
                    <p className="text-xs text-slate-400">학생들의 최고 기록을 확인하고 부적절한 테스트 점수를 정리할 수 있습니다.</p>
                  </div>
                  <button
                    onClick={loadLeaderboard}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    새로고침
                  </button>
                </div>

                <div className="flex-1 overflow-x-auto border border-slate-700/80 rounded-2xl bg-slate-900/60">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/90 text-slate-400 text-xs uppercase font-semibold border-b border-slate-700">
                      <tr>
                        <th className="px-4 py-3">순위</th>
                        <th className="px-4 py-3">학생 이름</th>
                        <th className="px-4 py-3">점수</th>
                        <th className="px-4 py-3">격추 단어 수</th>
                        <th className="px-4 py-3">정확도</th>
                        <th className="px-4 py-3">최대 콤보</th>
                        <th className="px-4 py-3">달성 일시</th>
                        <th className="px-4 py-3 text-right">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {leaderboard.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3 font-bold text-indigo-300">
                            {idx === 0 ? '🥇 1위' : idx === 1 ? '🥈 2위' : idx === 2 ? '🥉 3위' : `${idx + 1}위`}
                          </td>
                          <td className="px-4 py-3 font-bold text-white text-base">
                            {item.studentName}
                          </td>
                          <td className="px-4 py-3 font-black text-amber-300 text-base">
                            {item.score.toLocaleString()}점
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {item.wordsDestroyed}개
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {item.accuracy}%
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {item.maxCombo}연속
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {item.achievedAt ? new Date(item.achievedAt).toLocaleString('ko-KR') : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteLeaderboard(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                              title="기록 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {leaderboard.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            아직 등록된 랭킹 기록이 없습니다. 학생들이 게임을 플레이하면 최고 점수가 기록됩니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: Add / Edit Word */}
        {showAddWordModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-white">
              <h3 className="text-lg font-bold mb-4">
                {isEditingWord ? '단어 수정' : '새 단어 / 문장 등록'}
              </h3>
              <form onSubmit={handleSaveWord} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">단어 또는 문장</label>
                  <input
                    type="text"
                    value={newWordText}
                    onChange={(e) => setNewWordText(e.target.value)}
                    placeholder="예: 깨끗이, 할 수 있다, 시작이 반이다"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 text-base"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">분류</label>
                    <select
                      value={newWordCategory}
                      onChange={(e) => setNewWordCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-400"
                    >
                      <option value="맞춤법">맞춤법</option>
                      <option value="띄어쓰기">띄어쓰기</option>
                      <option value="속담">속담</option>
                      <option value="교과서 어휘">교과서 어휘</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">난이도</label>
                    <select
                      value={newWordDifficulty}
                      onChange={(e) => setNewWordDifficulty(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-400"
                    >
                      <option value="easy">쉬움 (짧은 단어)</option>
                      <option value="normal">보통 (일반 어휘)</option>
                      <option value="hard">어려움 (긴 문장)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">학습 힌트 / 맞춤법 해설 (선택)</label>
                  <input
                    type="text"
                    value={newWordHint}
                    onChange={(e) => setNewWordHint(e.target.value)}
                    placeholder="예: '깨끗하다'에서 파생된 부사는 '-이'로 적어요."
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddWordModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow transition"
                  >
                    저장하기
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
