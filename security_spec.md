# Security Specification: Space Defense Typing Practice Game

## 1. Data Invariants
- `words`: Must have valid `text` (1-100 chars), `category` (<= 50 chars), `difficulty` in ['easy', 'normal', 'hard'].
- `students`: Must have unique `name` (2-30 chars), `passwordHash` (32-128 chars), no plain-text passwords ever stored.
- `leaderboard`: Must have valid `studentId`, `studentName`, `score` (>= 0), `accuracy` (0-100), `maxCombo` (>= 0), `wordsDestroyed` (>= 0).
- `settings`: Holds `adminPasswordHash`, `isInitialized` flag, game settings.
- `test_connection`: Disposable test documents used strictly for verifying real Firestore connectivity on app boot.

## 2. Dirty Dozen Threat Vectors & Mitigations
1. **Plaintext Password Storage**: Blocked by client-side Web Crypto API SHA-256 with salt; only hash string (min 32 chars) accepted.
2. **Infinite String Injection (Denial of Wallet)**: Enforced size limits on every string (`text <= 100`, `hint <= 200`, `name <= 30`).
3. **Negative Score Exploit**: Enforced `incoming().score >= 0` and `incoming().accuracy <= 100`.
4. **Invalid Difficulty Injection**: Enum check for `difficulty` ('easy', 'normal', 'hard').
5. **Score Overwrite from Non-Owner**: Leaderboard entries keyed by studentId or verified with studentId.
6. **Setting Tampering**: Settings mutation validates required configuration fields.
7. **Ghost Keys Injection**: `keys().hasOnly()` guards on all document schemas.
8. **Negative Combo Count**: `maxCombo >= 0` check.
9. **Fake Test Pollution**: `test_connection` documents are deleted immediately upon CRUD verification.
10. **Name Spoofing with 0 Chars**: Enforced `name.size() >= 2`.
11. **Word Text Blank Exploit**: Enforced `text.size() >= 1`.
12. **Malicious Document ID**: Valid ID format constraints `^[a-zA-Z0-9_\\-]+$`.
