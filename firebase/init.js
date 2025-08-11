// Firebase initialization (placeholder). Replace config with your own project credentials.
// Usage: import { app, auth, db, signInWithGoogle, signOutUser } from './firebase/init.js';

// CDN modular imports (can be swapped for npm modules in a build step later)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc, query, where, orderBy, limit, getDocs, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Inject your config via a global window.FB_CFG = {...}; before loading this, or edit below.
const cfg = window.FB_CFG || {
  apiKey: 'MISSING_KEY',
  authDomain: 'MISSING_DOMAIN',
  projectId: 'MISSING_PROJECT',
  appId: 'MISSING_APP_ID'
};
if(cfg.apiKey === 'MISSING_KEY') {
  console.warn('[AstroBackend] Firebase config missing. Create firebase/config.js with your real keys (see config.example.js).');
}

export const app = initializeApp(cfg);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle(){
  const res = await signInWithPopup(auth, provider);
  await ensureUserDoc(res.user);
  return res.user;
}
export function signOutUser(){ return signOut(auth); }

export function onUserChanged(cb){ return onAuthStateChanged(auth, cb); }

// --- User & Game Data Helpers ---
export async function ensureUserDoc(user){
  if(!user) return;
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      displayName: user.displayName || 'Player',
      photoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      streakCount: 0,
      lastDailyDate: '',
      bestScore_global: 0,
      bestScore_daily: 0,
      unlockedPalettes: ['base'],
      unlockedTrails: ['default'],
      lifetime: { runs:0, orbs:0, perfects:0, playSeconds:0 }
    });
  } else {
    await updateDoc(ref, { lastLoginAt: serverTimestamp() });
  }
}

export async function updateStreak(uid, todayISO){
  const ref = doc(db, 'users', uid);
  await runTransaction(db, async(tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists()) return;
    const d = snap.data();
    const last = d.lastDailyDate || '';
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    let streak = d.streakCount || 0;
    if(last === yesterday) streak += 1; else if (last !== todayISO) streak = 1;
    if(last !== todayISO){
      tx.update(ref, { streakCount: streak, lastDailyDate: todayISO });
    }
  });
}

export async function submitRun(uid, run){
  // run: { gameId, mode, score, timeSurvived, multiplierMax, orbs, perfectDashes, seed }
  if(!uid) return;
  const runsCol = collection(db, 'runs');
  const safe = { ...run, uid, createdAt: serverTimestamp(), version: 1 };
  await addDoc(runsCol, safe);
  await maybeUpdateBest(uid, run);
  if(run.mode === 'daily') await submitDailyScore(uid, run.score, run.timeSurvived, run.gameId);
}

async function maybeUpdateBest(uid, run){
  const ref = doc(db, 'users', uid);
  await runTransaction(db, async(tx)=>{
    const snap = await tx.get(ref); if(!snap.exists()) return;
    const d = snap.data();
    const updates = {};
    if(run.score > (d.bestScore_global||0)) updates.bestScore_global = run.score;
    if(run.mode === 'daily' && run.score > (d.bestScore_daily||0)) updates.bestScore_daily = run.score;
    if(Object.keys(updates).length) tx.update(ref, updates);
  });
}

export async function submitDailyScore(uid, score, timeSurvived, gameId){
  const today = new Date().toISOString().slice(0,10);
  const ref = doc(db, 'dailyScores', today, 'entries', uid);
  await runTransaction(db, async(tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists()){
      tx.set(ref, { uid, gameId, score, timeSurvived, updatedAt: serverTimestamp() });
    } else {
      const d = snap.data();
      if(score > d.score){ tx.update(ref, { score, timeSurvived, updatedAt: serverTimestamp() }); }
    }
  });
}

export async function fetchDailyTop(limitN = 10){
  const today = new Date().toISOString().slice(0,10);
  const entries = collection(db, 'dailyScores', today, 'entries');
  const q = query(entries, orderBy('score','desc'), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map(d=> ({ id:d.id, ...d.data() }));
}

export async function incrementLifetime(uid, delta){
  // delta: { runs?, orbs?, perfects?, playSeconds? }
  const ref = doc(db, 'users', uid);
  await runTransaction(db, async(tx)=>{
    const snap = await tx.get(ref); if(!snap.exists()) return;
    const d = snap.data();
    const life = d.lifetime || { runs:0, orbs:0, perfects:0, playSeconds:0 };
    const nl = { ...life };
    for(const k of ['runs','orbs','perfects','playSeconds']) if(delta[k]) nl[k] = (nl[k]||0) + delta[k];
    tx.update(ref, { lifetime: nl });
  });
}

// Utility to expose minimal state for UI binding
export async function getUserDoc(uid){
  if(!uid) return null; const snap = await getDoc(doc(db,'users',uid)); return snap.exists()? { id:uid, ...snap.data() }: null;
}

window.AstroBackend = {
  signInWithGoogle, signOutUser, onUserChanged,
  submitRun, updateStreak, fetchDailyTop, incrementLifetime, getUserDoc
};
