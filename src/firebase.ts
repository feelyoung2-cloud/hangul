import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates real Firestore connection by executing full CRUD:
 * 1. Create test doc
 * 2. Read test doc
 * 3. Update test doc
 * 4. Delete test doc
 * Returns true ONLY if all 4 operations succeed on the live Firestore instance.
 */
export async function testLiveFirestoreConnection(): Promise<{ success: boolean; error?: string }> {
  const testId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const testDocRef = doc(db, 'test_connection', testId);

  try {
    // 1. Create
    await setDoc(testDocRef, {
      test: true,
      timestamp: new Date().toISOString(),
    });

    // 2. Read
    const snap = await getDoc(testDocRef);
    if (!snap.exists()) {
      return { success: false, error: '테스트 문서 생성 후 조회에 실패했습니다.' };
    }

    // 3. Update
    await updateDoc(testDocRef, {
      test: false,
      timestamp: new Date().toISOString(),
    });

    // 4. Delete
    await deleteDoc(testDocRef);

    return { success: true };
  } catch (err: any) {
    console.error('Live Firestore CRUD test failed:', err);
    return {
      success: false,
      error: err?.message || 'Firestore 통신 중 오류가 발생했습니다.',
    };
  }
}
