import React, { useState } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { generateSalt, hashPassword, verifyPassword } from '../utils/crypto';
import { Student } from '../types';
import { Rocket, KeyRound, User, Sparkles, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

interface StudentLoginModalProps {
  onLoginSuccess: (student: Student) => void;
  onClose?: () => void;
}

export const StudentLoginModal: React.FC<StudentLoginModalProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password reset state
  const [resettingStudent, setResettingStudent] = useState<Student | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('이름을 2글자 이상 정확히 입력해 주세요.');
      return;
    }
    if (!password) {
      setErrorMessage('비밀번호를 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('name', '==', cleanName));
      const querySnap = await getDocs(q);

      if (querySnap.empty) {
        setErrorMessage('등록되지 않은 이름이에요. 처음 오셨다면 위의 "처음 왔어요(새 등록)"를 눌러주세요!');
        setLoading(false);
        return;
      }

      const studentDoc = querySnap.docs[0];
      const studentData = studentDoc.data() as Student;
      const studentWithId: Student = { ...studentData, id: studentDoc.id };

      // Check if teacher flagged password reset
      if (studentWithId.needsPasswordReset) {
        setResettingStudent(studentWithId);
        setLoading(false);
        return;
      }

      // Verify password
      const isMatch = await verifyPassword(password, studentWithId.salt || '', studentWithId.passwordHash);
      if (!isMatch) {
        setErrorMessage('비밀번호가 맞지 않아요. 기억이 안 나면 선생님께 초기화를 부탁해 보세요!');
        setLoading(false);
        return;
      }

      // Update last login
      try {
        await updateDoc(doc(db, 'students', studentWithId.id), {
          lastLoginAt: new Date().toISOString(),
        });
      } catch {
        // Non-critical
      }

      onLoginSuccess(studentWithId);
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage('접속에 일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('이름을 2글자 이상 입력해 주세요.');
      return;
    }
    if (password.length < 4) {
      setErrorMessage('비밀번호는 4자리 이상으로 설정해 주세요.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('비밀번호 확인이 일치하지 않아요.');
      return;
    }

    setLoading(true);
    try {
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('name', '==', cleanName));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        setErrorMessage('이미 같은 이름의 학생이 등록되어 있어요. "로그인하기"로 들어가거나 이름을 구분해 주세요!');
        setLoading(false);
        return;
      }

      const salt = generateSalt(16);
      const passwordHash = await hashPassword(password, salt);
      const studentId = 'std_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

      const newStudentData = {
        name: cleanName,
        passwordHash,
        salt,
        needsPasswordReset: false,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'students', studentId), newStudentData);

      const createdStudent: Student = {
        id: studentId,
        ...newStudentData,
      };

      onLoginSuccess(createdStudent);
    } catch (err) {
      console.error('Register error:', err);
      setErrorMessage('새 학생 등록 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Reset by Student
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingStudent) return;
    setErrorMessage(null);

    if (newPassword.length < 4) {
      setErrorMessage('새 비밀번호는 4자리 이상으로 정해주세요.');
      return;
    }
    if (newPassword !== newConfirmPassword) {
      setErrorMessage('새 비밀번호 확인이 일치하지 않아요.');
      return;
    }

    setLoading(true);
    try {
      const salt = generateSalt(16);
      const passwordHash = await hashPassword(newPassword, salt);

      await updateDoc(doc(db, 'students', resettingStudent.id), {
        passwordHash,
        salt,
        needsPasswordReset: false,
        lastLoginAt: new Date().toISOString(),
      });

      const updatedStudent: Student = {
        ...resettingStudent,
        passwordHash,
        salt,
        needsPasswordReset: false,
      };

      onLoginSuccess(updatedStudent);
    } catch (err) {
      console.error('Password reset error:', err);
      setErrorMessage('비밀번호 변경 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border-2 border-indigo-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-500/20 text-white relative overflow-hidden">
        {/* Decorative Space Aura */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Password Reset Modal when student has reset flag */}
        {resettingStudent ? (
          <div>
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/40">
                <Lock className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold">비밀번호 새로 정하기</h2>
                <p className="text-sm text-slate-300">{resettingStudent.name} 학생, 선생님이 초기화해 주셨어요!</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-6 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              앞으로 로그인할 때 사용할 <span className="text-amber-300 font-semibold">새로운 비밀번호</span>를 정해 주세요.
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">새 비밀번호 (4자리 이상)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새로운 비밀번호 입력"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 text-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">새 비밀번호 한 번 더 입력</label>
                <input
                  type="password"
                  value={newConfirmPassword}
                  onChange={(e) => setNewConfirmPassword(e.target.value)}
                  placeholder="비밀번호 확인"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 text-lg"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold rounded-xl text-lg shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-2"
              >
                {loading ? '변경 중...' : '새 비밀번호로 시작하기'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl mb-3 shadow-inner">
                <Rocket className="w-9 h-9 text-indigo-400 animate-bounce" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white">우주 방어 대원 출동!</h2>
              <p className="text-sm text-indigo-200/80 mt-1">이름과 나만의 비밀번호로 시작해 보세요</p>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-800/90 rounded-2xl mb-6 border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                로그인하기
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                }}
                className={`py-2.5 rounded-xl font-bold text-sm transition-all ${
                  mode === 'register'
                    ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                처음 왔어요 (새 등록)
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-sm flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-400" /> 학생 이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 김하늘 또는 하늘이"
                  className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 text-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-indigo-400" /> 나만의 비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? '4자리 이상 (기억하기 쉬운 것)' : '비밀번호 입력'}
                  className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 text-lg"
                  required
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 비밀번호 확인
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호를 한 번 더 적어주세요"
                    className="w-full px-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 text-lg"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:via-purple-400 hover:to-pink-400 text-white font-bold rounded-xl text-lg shadow-lg shadow-indigo-500/30 transition transform active:scale-98 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>{mode === 'login' ? '우주선 탑승하기!' : '새 대원으로 등록하기!'}</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 text-center">
              <p className="text-xs text-slate-400">
                💡 비밀번호를 잊어버렸다면 교실의 <span className="text-indigo-300 font-medium">선생님께 초기화를 요청</span>하면 바로 다시 설정할 수 있어요.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
