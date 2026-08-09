import React, { useState, useEffect, useMemo, useCallback, useContext } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  Utensils, Car, Home, Zap, Film, HeartPulse, ShoppingBag, ShoppingCart, BookOpen, Plane,
  MoreHorizontal, Plus, Trash2, Pencil, LogOut, X, Check,
  ChevronLeft, ChevronRight, Receipt, Target, AlertTriangle, Send, Download, Users, Mail, FileSpreadsheet,
  Banknote, CreditCard, Landmark, Wallet, ChevronDown, BookMarked, Settings, KeyRound,
  TrendingUp, Repeat, Search, RotateCcw, BarChart3, History, ShieldCheck, Camera, WifiOff, ImageOff, Upload, PiggyBank, CalendarDays,
} from "lucide-react";
import Papa from "papaparse";
import { supabase } from "./supabaseClient";
import {
  pingDatabase, ensureLedger, fetchLedgerData, fetchUserLedgers, createLedger,
  saveCategoriesRemote, saveBudgetsRemote, savePaymentMethodsRemote, fetchExpenses,
  insertExpenseRemote, updateExpenseRemote, deleteExpenseRemote,
  fetchMembers, fetchPendingInvites, inviteMember, cancelInvite,
  fetchIncome, insertIncomeRemote, deleteIncomeRemote,
  fetchRecurringExpenses, createRecurringExpense, deleteRecurringExpense, markRecurringGenerated,
  logActivity, fetchActivityLog, saveCurrencyRemote, uploadReceipt, getReceiptUrl, deleteReceipt,
  deleteLedger, updateMemberDisplayName,
  fetchSavings, insertSavingsRemote, deleteSavingsRemote,
  fetchRecurringIncome, createRecurringIncome, deleteRecurringIncome, markRecurringIncomeGenerated,
} from "./store";

/* ---------------------------------------------------------------
   TOKENS
   forest    #16302A  page background
   parchment #EDE6D3  card / paper surface
   ink       #1B2A24  primary text
   gold      #C9A227  signature accent / highlight
   brick     #A63446  expense emphasis
   sage      #5E8C61  secondary accent / positive
------------------------------------------------------------------ */
const T = {
  forest: "#16302A",
  forestDeep: "#0F231F",
  parchment: "#EDE6D3",
  parchmentDim: "#E1D8BE",
  ink: "#1B2A24",
  gold: "#C9A227",
  brick: "#A63446",
  sage: "#5E8C61",
};

const CATEGORY_PALETTE = ["#C9A227", "#A63446", "#5E8C61", "#3E6B5C", "#6B4C7A", "#2F6E73"];

const DEFAULT_CATEGORIES = [
  { name: "Food & Drink", icon: Utensils },
  { name: "Grocery", icon: ShoppingCart },
  { name: "Transport", icon: Car },
  { name: "Housing", icon: Home },
  { name: "Utilities", icon: Zap },
  { name: "Entertainment", icon: Film },
  { name: "Health", icon: HeartPulse },
  { name: "Shopping", icon: ShoppingBag },
  { name: "Education", icon: BookOpen },
  { name: "Travel", icon: Plane },
  { name: "Remittance", icon: Send },
  { name: "Other", icon: MoreHorizontal },
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const SUGGESTED_PAYMENT_METHODS = ["Cash", "Credit card 1", "Credit card 2", "Debit card", "Bank transfer"];
const SUGGESTED_INCOME_SOURCES = ["Salary", "Freelance", "Gift", "Interest", "Refund", "Other"];

const CURRENCIES = [
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee" },
  { code: "SAR", symbol: "SAR", name: "Saudi Riyal" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
];

const CurrencyContext = React.createContext({ code: "AED", symbol: "AED" });

// A practical, commonly-used country list rather than an exhaustive ISO
// list — United Arab Emirates is first since it's this app's default and
// primary audience; the rest are alphabetical.
const COUNTRIES = [
  "United Arab Emirates",
  "Afghanistan", "Albania", "Algeria", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahrain", "Bangladesh", "Belgium", "Bhutan", "Bosnia and Herzegovina",
  "Brazil", "Brunei", "Bulgaria", "Cambodia", "Cameroon", "Canada", "Chile", "China",
  "Colombia", "Croatia", "Cyprus", "Czechia", "Denmark", "Egypt", "Estonia", "Ethiopia",
  "Finland", "France", "Georgia", "Germany", "Ghana", "Greece", "Hong Kong", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Japan",
  "Jordan", "Kazakhstan", "Kenya", "Kuwait", "Kyrgyzstan", "Latvia", "Lebanon", "Libya",
  "Lithuania", "Luxembourg", "Malaysia", "Maldives", "Malta", "Mauritius", "Mexico",
  "Mongolia", "Morocco", "Myanmar", "Nepal", "Netherlands", "New Zealand", "Nigeria",
  "North Macedonia", "Norway", "Oman", "Pakistan", "Palestine", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Saudi Arabia", "Serbia", "Singapore",
  "Slovakia", "Slovenia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sudan",
  "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand",
  "Tunisia", "Turkey", "Turkmenistan", "Uganda", "Ukraine", "United Kingdom",
  "United States", "Uzbekistan", "Vietnam", "Yemen", "Other",
];

// A real dropdown of states/provinces for every country isn't practical
// here — this covers the app's default/primary market (UAE's seven
// emirates) properly; any other country falls back to a free-text field
// in the UI instead of a dropdown.
const STATE_OPTIONS = {
  "United Arab Emirates": ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"],
};

const AGE_RANGES = ["18-25", "26-35", "36-50", "50+"];
const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtNumber(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoney(n) {
  // Plain-string fallback for contexts that can't render an inline icon (chart tooltips, alert text).
  return `AED ${fmtNumber(n)}`;
}

function DirhamSymbol({ size = 13, color = "currentColor", style }) {
  // Approximation of the UAE Dirham symbol: a solid Latin "D" with two horizontal,
  // round-ended strokes through it (representing the UAE flag stripes), per the
  // Central Bank's published description. Unicode U+20C3 is reserved for this symbol
  // but isn't rendered by fonts/OSes yet, so this is drawn as inline SVG for reliable
  // display now. It is a close approximation, not the official vector artwork.
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      style={{ display: "inline-block", flexShrink: 0, verticalAlign: "-0.08em", ...style }}
      aria-label="AED"
    >
      <path d="M7.6 3.2v17.6" stroke={color} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M7.6 4.6c5.6-0.3 9.2 2.9 9.2 7.4s-3.6 7.7-9.2 7.4" stroke={color} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M4.6 9.3h14" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M4.6 14.7h14" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Money({ amount, size = 13, color, style }) {
  const { code, symbol } = useContext(CurrencyContext);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", lineHeight: 1, gap: 4, ...style }}>
      {code === "AED" ? (
        <DirhamSymbol size={size} color={color} style={{ transform: "translateY(0.02em)" }} />
      ) : (
        <span style={{ fontSize: size, color, lineHeight: 1 }}>{symbol}</span>
      )}
      <span style={{ lineHeight: 1 }}>{fmtNumber(amount)}</span>
    </span>
  );
}

function catColor(index) {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}

// Picks a small icon based on keywords in the nickname, so "Amex", "Credit
// card 1", "Visa 1234" etc. all still get a sensible symbol without needing
// the user to pick one manually.
function paymentMethodIcon(name) {
  const n = (name || "").toLowerCase();
  if (!n || n === "not specified") return Wallet;
  if (n.includes("cash")) return Banknote;
  if (n.includes("bank") || n.includes("transfer") || n.includes("wire")) return Landmark;
  if (n.includes("card") || n.includes("credit") || n.includes("debit") || n.includes("visa") || n.includes("amex") || n.includes("mastercard")) return CreditCard;
  return Wallet;
}

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
  ]);
}

/* ---------------------------------------------------------------
   Offline support
   - A snapshot of the last successfully-loaded ledger data is cached in
     localStorage so the app has something to show if you open it with no
     connection at all.
   - New expenses/income added while offline go into a queue (also in
     localStorage, so it survives a reload) and sync automatically once
     back online. Edits, deletes of already-synced items, and anything
     that touches shared ledger-level fields (categories, payment
     methods, budgets, currency) are deliberately NOT allowed offline —
     those carry real conflict risk if two people change the same shared
     data while apart, whereas "add a new item" from one person doesn't
     collide with anything.
------------------------------------------------------------------ */
function cacheKey(uid) { return `trackit-cache-${uid}`; }
function queueKey(uid) { return `trackit-offline-queue-${uid}`; }

function saveOfflineCache(uid, snapshot) {
  try { localStorage.setItem(cacheKey(uid), JSON.stringify(snapshot)); } catch { /* storage full/unavailable — offline viewing just won't have a cache this time */ }
}
function loadOfflineCache(uid) {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function loadOfflineQueue(uid) {
  try { return JSON.parse(localStorage.getItem(queueKey(uid)) || "[]"); } catch { return []; }
}
function saveOfflineQueue(uid, queue) {
  try { localStorage.setItem(queueKey(uid), JSON.stringify(queue)); } catch { /* best effort */ }
}

function buildDemoData() {
  const now = new Date();
  const iso = (y, m, d) => {
    const dd = new Date(y, m, d);
    return dd.toISOString().slice(0, 10);
  };
  const thisY = now.getFullYear();
  const thisM = now.getMonth();
  const lastM = new Date(thisY, thisM - 1, 1);

  const rows = [
    // this month
    ["Food & Drink", 42.5, 6, "farmers market", "Cash"],
    ["Food & Drink", 18.2, 12, "coffee run", "Debit card"],
    ["Transport", 55, 3, "gas", "Credit card 1"],
    ["Transport", 14, 15, "parking", "Cash"],
    ["Housing", 1450, 1, "rent", "Bank transfer"],
    ["Utilities", 96.3, 4, "electric bill", "Bank transfer"],
    ["Entertainment", 32, 10, "movie night", "Credit card 1"],
    ["Health", 25, 8, "pharmacy", "Debit card"],
    ["Shopping", 64.99, 14, "new shoes", "Credit card 2"],
    ["Streaming", 15.99, 2, "monthly plan", "Credit card 1"],
    // last month
    ["Food & Drink", 51.4, 5, "groceries", "Debit card"],
    ["Food & Drink", 22.75, 19, "takeout", "Cash"],
    ["Transport", 60, 2, "gas", "Credit card 1"],
    ["Housing", 1450, 1, "rent", "Bank transfer"],
    ["Utilities", 88.1, 3, "electric bill", "Bank transfer"],
    ["Entertainment", 12, 21, "arcade", "Cash"],
    ["Travel", 210, 24, "train tickets", "Credit card 2"],
    ["Shopping", 39.5, 11, "gift", "Credit card 1"],
    ["Streaming", 15.99, 2, "monthly plan", "Credit card 1"],
  ];

  const expenses = rows.map(([category, amount, day, note, paymentMethod], i) => {
    const isLastMonth = i >= 10;
    const y = isLastMonth ? lastM.getFullYear() : thisY;
    const m = isLastMonth ? lastM.getMonth() : thisM;
    return {
      id: `demo-${i}`,
      amount,
      category,
      date: iso(y, m, Math.min(day, 28)),
      note,
      paymentMethod,
      createdAt: Date.now() - (rows.length - i) * 100000,
    };
  });

  return { expenses, categories: ["Streaming"], paymentMethods: ["Cash", "Credit card 1", "Credit card 2", "Debit card", "Bank transfer"] };
}

/* ================================================================
   ERROR BOUNDARY
================================================================= */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ ...styles.centerFill, color: T.parchment }}>
          <div style={{ ...styles.loginCard, textAlign: "center" }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", marginTop: 0 }}>Something broke</h2>
            <p style={{ fontSize: 13.5, opacity: 0.7, wordBreak: "break-word" }}>
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button style={styles.primaryBtn} onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ================================================================
   ROOT APP
================================================================= */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking, null = signed out
  const [demoProfile, setDemoProfile] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ledgerList, setLedgerList] = useState([]);
  const [profileError, setProfileError] = useState("");
  const [storageStatus, setStorageStatus] = useState("checking"); // checking | ok | broken
  const [storageCheckNonce, setStorageCheckNonce] = useState(0);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaChecked, setMfaChecked] = useState(false);

  useEffect(() => {
    // Without this timeout, a genuinely offline device (not just a slow
    // connection) can leave this promise neither resolved nor rejected —
    // `session` would stay stuck at undefined forever, and the boot screen
    // would spin indefinitely with no way to recover even once
    // connectivity returns. Bounding it means the app always reaches a
    // real state (signed-in or signed-out) within a few seconds.
    withTimeout(supabase.auth.getSession(), 6000)
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      // Supabase fires this specific event when the session came from a
      // password-reset email link, so we can route to the reset screen
      // instead of dropping the person straight into their ledger.
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, [storageCheckNonce]);

  // A session can exist at "aal1" (password only) even for an account with
  // 2FA turned on — Supabase doesn't block the session itself, it just
  // reports that a higher assurance level is required. Checking this before
  // loading any ledger data is what actually enforces the second factor,
  // rather than just decorating the sign-in screen with it.
  useEffect(() => {
    if (!session) { setMfaPending(false); setMfaChecked(true); return; }
    setMfaChecked(false);
    (async () => {
      try {
        const { data, error } = await withTimeout(supabase.auth.mfa.getAuthenticatorAssuranceLevel(), 6000);
        if (error) throw error;
        setMfaPending(data.nextLevel === "aal2" && data.currentLevel !== "aal2");
      } catch {
        setMfaPending(false);
      } finally {
        setMfaChecked(true);
      }
    })();
  }, [session]);

  // Once a real session exists, make sure this user is attached to at least
  // one ledger (claiming an invite, joining an existing membership, or
  // creating one as owner), then load every ledger they belong to so the
  // switcher has the full list. The active one is remembered per-browser
  // so returning users land back where they left off.
  //
  // If this fails while offline, fall back to whichever ledger list was
  // last successfully resolved on this device (cached below) instead of
  // dead-ending — this is what lets someone open the installed app with no
  // connection at all and still land in their ledger via Dashboard's own
  // offline-aware loading, rather than getting stuck before Dashboard ever
  // mounts.
  useEffect(() => {
    if (!session || mfaPending || !mfaChecked) {
      if (!session) { setProfile(null); setLedgerList([]); }
      return;
    }
    (async () => {
      setProfileError("");
      const ledgerCacheKey = `trackit-ledgerlist-${session.user.id}`;
      try {
        const first = await withTimeout(ensureLedger(session.user), 8000);
        const list = await withTimeout(fetchUserLedgers(session.user.id), 8000);
        const finalList = list.length > 0 ? list : [{ id: first.id, name: first.name }];
        setLedgerList(finalList);

        const storedId = localStorage.getItem(`trackit-active-ledger-${session.user.id}`);
        const active = finalList.find((l) => l.id === storedId) || finalList.find((l) => l.id === first.id) || finalList[0];
        setProfile({ id: active.id, name: active.name });
        try { localStorage.setItem(ledgerCacheKey, JSON.stringify({ list: finalList, activeId: active.id })); } catch { /* best effort */ }
      } catch {
        if (!navigator.onLine) {
          try {
            const cached = JSON.parse(localStorage.getItem(ledgerCacheKey) || "null");
            if (cached && cached.list?.length > 0) {
              setLedgerList(cached.list);
              const storedId = localStorage.getItem(`trackit-active-ledger-${session.user.id}`);
              const active = cached.list.find((l) => l.id === storedId) || cached.list.find((l) => l.id === cached.activeId) || cached.list[0];
              setProfile({ id: active.id, name: active.name });
              return;
            }
          } catch { /* fall through to the error below */ }
          setProfileError("You're offline, and Track It hasn't loaded on this device before — connect once to get started, then it'll work offline after that.");
          return;
        }
        setProfileError("Couldn't set up your ledger. Try reloading, or sign out and back in.");
      }
    })();
  }, [session, mfaPending, mfaChecked]);

  useEffect(() => {
    (async () => {
      setStorageStatus("checking");
      try {
        await withTimeout(pingDatabase(), 8000);
        setStorageStatus("ok");
      } catch {
        setStorageStatus("broken");
      }
    })();
  }, [storageCheckNonce]);

  const activeProfile = demoProfile || profile;
  const booting = session === undefined || (session && !mfaChecked) || (session && mfaChecked && !mfaPending && !activeProfile && !profileError);
  // Applies retroactively too — anyone who signed up before this feature
  // existed gets asked for their name the next time they log in, not just
  // brand-new sign-ups.
  const needsProfileCompletion = !demoProfile && !!session && !mfaPending && mfaChecked && !session.user?.user_metadata?.full_name;

  const handleLogout = async () => {
    if (demoProfile) {
      setDemoProfile(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const handleSwitchLedger = (ledgerId) => {
    const target = ledgerList.find((l) => l.id === ledgerId);
    if (!target) return;
    if (session?.user?.id) localStorage.setItem(`trackit-active-ledger-${session.user.id}`, target.id);
    setProfile({ id: target.id, name: target.name });
  };

  const handleCreateLedger = async (name) => {
    if (!session?.user?.id) return;
    const personName = session.user.user_metadata?.full_name || session.user.user_metadata?.display_name || session.user.email?.split("@")[0];
    const created = await createLedger(session.user.id, name, personName);
    setLedgerList((prev) => [...prev, created]);
    localStorage.setItem(`trackit-active-ledger-${session.user.id}`, created.id);
    setProfile({ id: created.id, name: created.name });
  };

  const handleDeleteLedger = async (ledgerId) => {
    if (!session?.user?.id) return;
    await deleteLedger(ledgerId);
    const remaining = ledgerList.filter((l) => l.id !== ledgerId);

    if (remaining.length === 0) {
      // Never leave the account with zero ledgers — the rest of the app
      // assumes there's always at least one.
      const created = await createLedger(session.user.id, "My ledger", session.user.user_metadata?.full_name || session.user.user_metadata?.display_name);
      setLedgerList([created]);
      localStorage.setItem(`trackit-active-ledger-${session.user.id}`, created.id);
      setProfile({ id: created.id, name: created.name });
      return;
    }

    setLedgerList(remaining);
    if (profile?.id === ledgerId) {
      const next = remaining[0];
      localStorage.setItem(`trackit-active-ledger-${session.user.id}`, next.id);
      setProfile({ id: next.id, name: next.name });
    }
  };

  const handleProfileSaved = (fullName) => {
    // Fire-and-forget: Dashboard's own member list will show the updated
    // name the moment it next loads regardless, this just makes any
    // ledgers the person already belongs to reflect it immediately too,
    // rather than showing their old placeholder name until they're edited
    // again.
    if (session?.user?.id) {
      ledgerList.forEach((l) => {
        updateMemberDisplayName(l.id, session.user.id, fullName).catch(() => {});
      });
    }
  };

  return (
    <ErrorBoundary>
      <div style={styles.appShell}>
        <style>{GLOBAL_CSS}</style>
        {storageStatus === "broken" && (
          <div style={styles.storageWarningBanner}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              Can't reach the database right now — check that your Supabase project is running and that
              VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env are correct.
            </span>
            <button
              onClick={() => setStorageCheckNonce((n) => n + 1)}
              style={{ ...styles.errorDismiss, textDecoration: "underline", whiteSpace: "nowrap", opacity: 1 }}
            >
              Retry
            </button>
          </div>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {booting ? (
            <BootScreen />
          ) : mfaPending ? (
            <MfaChallengeScreen
              onVerified={() => setMfaPending(false)}
              onCancel={() => supabase.auth.signOut()}
            />
          ) : passwordRecovery ? (
            <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />
          ) : needsProfileCompletion ? (
            <CompleteProfileModal onSaved={handleProfileSaved} />
          ) : activeProfile ? (
            <Dashboard
              profile={activeProfile}
              currentUserId={session?.user?.id || null}
              userEmail={session?.user?.email || null}
              onLogout={handleLogout}
              ledgerList={demoProfile ? [] : ledgerList}
              onSwitchLedger={handleSwitchLedger}
              onCreateLedger={handleCreateLedger}
              onDeleteLedger={handleDeleteLedger}
            />
          ) : profileError ? (
            <div style={{ ...styles.centerFill, color: T.parchment, textAlign: "center", padding: 24 }}>
              <p>{profileError}</p>
              <button style={styles.primaryBtn} onClick={() => supabase.auth.signOut()}>Sign out</button>
            </div>
          ) : (
            <AuthScreen onLogin={setDemoProfile} />
          )}
        </div>
        <Footer />
      </div>
    </ErrorBoundary>
  );
}

function BootScreen() {
  return (
    <div style={{ ...styles.centerFill, color: T.parchment }}>
      <DirhamSymbol size={26} color={T.parchment} style={{ opacity: 0.6 }} />
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, marginTop: 10, letterSpacing: 0.5 }}>
        Opening Track It…
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer style={styles.footer}>
      <a href="mailto:trackituae.com@gmail.com" style={styles.footerLink}>Contact us</a>
      <span style={styles.footerDivider}>·</span>
      <span>© {new Date().getFullYear()} Track It. All rights reserved.</span>
    </footer>
  );
}

/* ================================================================
   AUTH
================================================================= */
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSignIn = async (e) => {
    e?.preventDefault?.();
    setError(""); setNotice("");
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    try {
      const { error: err } = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password }), 8000
      );
      if (err) throw err;
      // onAuthStateChange in the root App picks up the new session from here.
    } catch (err) {
      setError(err?.message || "Couldn't sign in. Check your email and password.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e?.preventDefault?.();
    setError(""); setNotice("");
    if (!email.trim()) return setError("Enter the email on your account.");
    setBusy(true);
    try {
      const { error: err } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/?reset=1`,
        }),
        8000
      );
      if (err) throw err;
      setNotice("Check your email for a link to reset your password.");
    } catch (err) {
      setError(err?.message || "Couldn't send that reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e) => {
    e?.preventDefault?.();
    setError(""); setNotice("");
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Tell us what to call your ledger.");
    if (!email.trim()) return setError("Enter your email.");
    if (password.length < 6) return setError("Password needs to be at least 6 characters.");
    setBusy(true);
    try {
      const { data, error: err } = await withTimeout(
        supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: trimmedName } },
        }),
        8000
      );
      if (err) throw err;
      if (!data.session) {
        // Email confirmation is required by this project's auth settings.
        setNotice("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
      // If a session came back immediately, onAuthStateChange in App handles the rest.
    } catch (err) {
      setError(err?.message || "Couldn't create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.centerFill}>
      <div style={styles.loginCardOuter}>
        <div style={styles.loginCard}>
          <div style={styles.loginCardAccent} />
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={styles.brandMarkRing}>
              <div style={styles.brandMarkInner}>
                <DirhamSymbol size={24} color={T.gold} />
              </div>
            </div>
            <h1 style={styles.wordmark}>Track It</h1>
            <p style={styles.tagline}>A running tally of where it went</p>
            <div style={styles.wordDivider} />
          </div>

          {notice && <p style={{ ...styles.errorText, color: T.sage }}>{notice}</p>}

          {mode === "signin" ? (
            <div>
              <label style={styles.label}>Email</label>
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn(e)}
                style={styles.textInput}
                placeholder="you@example.com"
              />
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn(e)}
                style={styles.textInput}
                placeholder="••••••••"
              />
              {error && <p style={styles.errorText}>{error}</p>}
              <button type="button" className="btn-lift" style={styles.primaryBtn} disabled={busy} onClick={handleSignIn}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <button type="button" style={styles.textBtn} onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>
                New here? Create an account
              </button>
              <button type="button" style={styles.textBtn} onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}>
                Forgot password?
              </button>
            </div>
          ) : mode === "forgot" ? (
            <div>
              <label style={styles.label}>Email</label>
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleForgotPassword(e)}
                style={styles.textInput}
                placeholder="you@example.com"
              />
              {error && <p style={styles.errorText}>{error}</p>}
              <button type="button" className="btn-lift" style={styles.primaryBtn} disabled={busy} onClick={handleForgotPassword}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
              <button type="button" style={styles.textBtn} onClick={() => { setMode("signin"); setError(""); setNotice(""); }}>
                ← back to sign in
              </button>
            </div>
          ) : (
            <div>
              <label style={styles.label}>Name this ledger</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.textInput}
                placeholder="e.g. Sam, or Household"
                maxLength={24}
              />
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.textInput}
                placeholder="you@example.com"
              />
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignUp(e)}
                style={styles.textInput}
                placeholder="at least 6 characters"
              />
              {error && <p style={styles.errorText}>{error}</p>}
              <button type="button" className="btn-lift" style={styles.primaryBtn} disabled={busy} onClick={handleSignUp}>
                {busy ? "Creating…" : "Create account"}
              </button>
              <button type="button" style={styles.textBtn} onClick={() => { setMode("signin"); setError(""); setNotice(""); }}>
                ← back to sign in
              </button>
            </div>
          )}

          <button className="btn-lift" style={styles.demoBtn} onClick={() => onLogin({ name: "Demo", isDemo: true, id: "demo" })}>
            Skip login — try the demo
          </button>

          <p style={styles.privacyNote}>
            Your ledger is only visible to you and anyone you invite — you can invite people once you're in.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   RESET PASSWORD (landing screen for the emailed reset link)
================================================================= */
function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (password.length < 6) return setError("Password needs to be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      const { error: err } = await withTimeout(supabase.auth.updateUser({ password }), 8000);
      if (err) throw err;
      onDone();
    } catch (err) {
      setError(err?.message || "Couldn't update your password. The link may have expired — request a new one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.centerFill}>
      <div style={styles.loginCardOuter}>
        <div style={styles.loginCard}>
          <div style={styles.loginCardAccent} />
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={styles.brandMarkRing}>
              <div style={styles.brandMarkInner}>
                <DirhamSymbol size={24} color={T.gold} />
              </div>
            </div>
            <h1 style={styles.wordmark}>Set a new password</h1>
            <div style={styles.wordDivider} />
          </div>
          <label style={styles.label}>New password</label>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.textInput}
            placeholder="at least 6 characters"
          />
          <label style={styles.label}>Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
            style={styles.textInput}
            placeholder="repeat password"
          />
          {error && <p style={styles.errorText}>{error}</p>}
          <button type="button" className="btn-lift" style={styles.primaryBtn} disabled={busy} onClick={handleSubmit}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   COMPLETE PROFILE (mandatory full name, first login — including
   retroactively for anyone who signed up before this existed)
================================================================= */
function CompleteProfileModal({ onSaved }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("United Arab Emirates");
  const [state, setState] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [consent, setConsent] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const stateOptions = STATE_OPTIONS[country];

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first) return setError("First name is required.");
    if (!last) return setError("Last name is required.");
    if (!country) return setError("Country is required.");
    if (!ageRange) return setError("Please select your age range.");
    if (!consent) return setError("Please check the box to agree before continuing.");
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({
        data: {
          first_name: first,
          last_name: last,
          full_name: `${first} ${last}`,
          country,
          state: state.trim() || null,
          age_range: ageRange,
          gender: gender || null,
          profile_consent_at: new Date().toISOString(),
        },
      });
      if (err) throw err;
      // The auth listener in App picks up the updated session from here,
      // which is what actually moves past this screen — this callback just
      // handles the follow-up work (syncing the name to existing ledgers).
      onSaved?.(`${first} ${last}`);
    } catch (err) {
      setError(err?.message || "Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.centerFill}>
      <div style={styles.loginCardOuter}>
        <div style={styles.loginCard}>
          <div style={styles.loginCardAccent} />
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={styles.brandMarkRing}>
              <div style={styles.brandMarkInner}>
                <DirhamSymbol size={24} color={T.gold} />
              </div>
            </div>
            <h1 style={styles.wordmark}>A few quick things</h1>
            <p style={styles.tagline}>let's finish setting up your account</p>
            <div style={styles.wordDivider} />
          </div>

          <label style={styles.label}>First name</label>
          <input
            autoFocus
            style={styles.textInput}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Sam"
            maxLength={40}
          />

          <label style={styles.label}>Last name</label>
          <input
            style={styles.textInput}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="e.g. Rivera"
            maxLength={40}
          />

          <label style={styles.label}>Country</label>
          <select
            style={styles.select}
            value={country}
            onChange={(e) => { setCountry(e.target.value); setState(""); }}
          >
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label style={styles.label}>State / Emirate (optional)</label>
          {stateOptions ? (
            <select style={styles.select} value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Select</option>
              {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input
              style={styles.textInput}
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. California"
              maxLength={40}
            />
          )}

          <label style={styles.label}>Age range</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {AGE_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                style={{ ...styles.chip, borderColor: ageRange === r ? T.gold : "transparent" }}
                onClick={() => setAgeRange(r)}
              >
                {r}
              </button>
            ))}
          </div>

          <label style={styles.label}>Gender (optional)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {GENDER_OPTIONS.map((g) => (
              <button
                key={g}
                type="button"
                style={{ ...styles.chip, borderColor: gender === g ? T.gold : "transparent" }}
                onClick={() => setGender(g)}
              >
                {g}
              </button>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 18, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ fontSize: 12.5, opacity: 0.75, lineHeight: 1.4, textAlign: "left" }}>
              I agree to the collection of this information as described in the{" "}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setPolicyOpen(true); }}
                style={{ background: "none", border: "none", padding: 0, color: T.ink, fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontSize: "inherit" }}
              >
                Data & Privacy Policy
              </button>.
            </span>
          </label>

          {error && <p style={styles.errorText}>{error}</p>}
          <button type="button" className="btn-lift" style={styles.primaryBtn} disabled={busy} onClick={handleSubmit}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>

      {policyOpen && <DataPolicyModal onClose={() => setPolicyOpen(false)} />}
    </div>
  );
}

/* ================================================================
   DATA & PRIVACY POLICY (linked from the consent checkbox above)
================================================================= */
function DataPolicyModal({ onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, margin: 0 }}>Data & Privacy Policy</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.85, marginTop: 8 }}>
          <p><strong>What we collect.</strong> Your name, country, state/emirate, age range, and gender if you
          choose to share it (collected once, at sign-up), your email address, and the expense, income, and budget
          data you choose to enter.</p>
          <p><strong>Why.</strong> Your name identifies you to anyone you share a ledger with. Country, state, age
          range, and gender help us understand our users in aggregate — they're never required to use any specific feature
          of the app. Your financial entries are used only to run the app for you and anyone you've shared a ledger
          with.</p>
          <p><strong>Storage.</strong> Data is stored with Supabase and never sold or shared with third parties for
          marketing.</p>
          <p><strong>Your rights.</strong> Under the UAE's Personal Data Protection Law (Federal Decree-Law No. 45
          of 2021), you can access, correct, or delete your personal data, and withdraw this consent, at any time —
          from Settings, or by contacting us using the link in the footer. Withdrawing consent doesn't affect the
          lawfulness of anything already processed beforehand.</p>
        </div>
        <button type="button" className="btn-lift" style={{ ...styles.primaryBtn, marginTop: 14 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   MFA CHALLENGE (login-time 2FA prompt)
================================================================= */
function MfaChallengeScreen({ onVerified, onCancel }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleVerify = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (code.length !== 6) return setError("Enter the 6-digit code from your authenticator app.");
    setBusy(true);
    try {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const factor = factors?.totp?.[0];
      if (!factor) throw new Error("No authenticator app is set up on this account.");
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
      if (verifyErr) throw verifyErr;
      onVerified();
    } catch (err) {
      setError(err?.message || "That code didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.centerFill}>
      <div style={styles.loginCardOuter}>
        <div style={styles.loginCard}>
          <div style={styles.loginCardAccent} />
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={styles.brandMarkRing}>
              <div style={styles.brandMarkInner}>
                <ShieldCheck size={22} color={T.gold} />
              </div>
            </div>
            <h1 style={styles.wordmark}>Enter your code</h1>
            <p style={styles.tagline}>from your authenticator app</p>
            <div style={styles.wordDivider} />
          </div>
          <input
            autoFocus
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleVerify(e)}
            style={styles.pinInput}
            placeholder="••••••"
          />
          {error && <p style={styles.errorText}>{error}</p>}
          <button type="button" className="btn-lift" style={styles.primaryBtn} disabled={busy} onClick={handleVerify}>
            {busy ? "Verifying…" : "Verify"}
          </button>
          <button type="button" style={styles.textBtn} onClick={onCancel}>
            ← sign in with a different account
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   DASHBOARD
================================================================= */
function Dashboard({ profile, currentUserId, userEmail, onLogout, ledgerList, onSwitchLedger, onCreateLedger, onDeleteLedger }) {
  const [expenses, setExpenses] = useState(null);
  const [customCategories, setCustomCategories] = useState([]);
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [justAddedId, setJustAddedId] = useState(null);
  const [error, setError] = useState("");
  const [budgets, setBudgets] = useState({ overall: null, categories: {} });
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [ledgerSwitcherOpen, setLedgerSwitcherOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [income, setIncome] = useState([]);
  const [incomeFormOpen, setIncomeFormOpen] = useState(false);
  const [savings, setSavings] = useState([]);
  const [savingsFormOpen, setSavingsFormOpen] = useState(false);
  const [monthEndPromptOpen, setMonthEndPromptOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null); // "YYYY-MM-DD" or null for the whole month
  const [monthEndNet, setMonthEndNet] = useState(0);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringTemplates, setRecurringTemplates] = useState([]);
  const [recurringIncomeTemplates, setRecurringIncomeTemplates] = useState([]);
  const [recurringNotice, setRecurringNotice] = useState("");
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [currency, setCurrency] = useState("AED");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null); // { item, timeoutId } for undo
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [receiptViewerUrl, setReceiptViewerUrl] = useState("");
  const [receiptViewerLoading, setReceiptViewerLoading] = useState(false);
  const [budgetAlert, setBudgetAlert] = useState(null);
  const [memberNames, setMemberNames] = useState({}); // user_id -> display_name, for "added by" labels
  const [isLedgerOwner, setIsLedgerOwner] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentSetupOpen, setPaymentSetupOpen] = useState(false);
  const [gettingStartedOpen, setGettingStartedOpen] = useState(false);
  const [chainToBudgetAfterIncome, setChainToBudgetAfterIncome] = useState(false);

  const uid = profile.id;

  const categories = useMemo(() => {
    const custom = customCategories.map((name, i) => ({ name, icon: MoreHorizontal }));
    return [...DEFAULT_CATEGORIES, ...custom];
  }, [customCategories]);

  const categoryColorIndex = useMemo(() => {
    const map = {};
    categories.forEach((c, i) => (map[c.name] = i));
    return map;
  }, [categories]);

  useEffect(() => {
    (async () => {
      try {
        // Demo mode never touches Supabase — it's a local-only sandbox that
        // resets every time you open it, so nothing gets written to the shared
        // database just from clicking "try the demo".
        if (profile.isDemo) {
          const seeded = buildDemoData();
          setExpenses(seeded.expenses);
          setCustomCategories(seeded.categories);
          setBudgets({ overall: 2200, categories: { "Food & Drink": 250, Transport: 120 } });
          setPaymentMethods(seeded.paymentMethods);
          return;
        }

        const queuedItems = loadOfflineQueue(uid);
        const pendingExpenses = queuedItems.filter((q) => q.type === "expense").map((q) => ({ id: q.localId, createdAt: q.createdAt, ...q.payload, pendingSync: true, receiptPath: "" }));
        const pendingIncome = queuedItems.filter((q) => q.type === "income").map((q) => ({ id: q.localId, createdAt: q.createdAt, ...q.payload, pendingSync: true }));
        setPendingSyncCount(queuedItems.length);

        if (!navigator.onLine) {
          // No connection at all right now — fall back to whatever was cached
          // from the last successful load, plus anything still queued from an
          // earlier offline session, so the app still shows something real.
          const cached = loadOfflineCache(uid);
          if (cached) {
            setCustomCategories(cached.categories || []);
            setBudgets(cached.budgets || { overall: null, categories: {} });
            setPaymentMethods(cached.paymentMethods || []);
            setCurrency(cached.currency || "AED");
            setMemberNames(cached.memberNames || {});
            setRecurringTemplates(cached.recurringTemplates || []);
            setIncome([...pendingIncome, ...(cached.income || [])]);
            setExpenses([...pendingExpenses, ...(cached.expenses || [])]);
          } else {
            setExpenses(pendingExpenses);
            setIncome(pendingIncome);
            setError("No connection yet, and nothing cached from a previous visit — showing what's queued so far.");
          }
          return;
        }

        const [profileData, expenseRows, members, incomeRows, recurringRows, savingsRows, recurringIncomeRows] = await withTimeout(
          Promise.all([
            fetchLedgerData(uid), fetchExpenses(uid), fetchMembers(uid).catch(() => []),
            fetchIncome(uid).catch(() => []), fetchRecurringExpenses(uid).catch(() => []),
            fetchSavings(uid).catch(() => []), fetchRecurringIncome(uid).catch(() => []),
          ]),
          8000
        );
        let finalExpenses = expenseRows;
        let finalIncome = incomeRows;
        setCustomCategories(profileData.categories);
        setBudgets(profileData.budgets);
        setPaymentMethods(profileData.paymentMethods);
        setCurrency(profileData.currency || "AED");
        setSavings(savingsRows);
        const names = {};
        (members || []).forEach((m) => { names[m.user_id] = m.display_name; });
        setMemberNames(names);
        setIsLedgerOwner((members || []).some((m) => m.user_id === currentUserId && m.role === "owner"));

        // Recurring expenses have no server-side cron — generate anything due
        // for the current month right now, the first time anyone opens this
        // ledger this month. last_generated_month stops it firing twice.
        const nowMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        const due = recurringRows.filter((r) => r.lastGeneratedMonth !== nowMonthStr);
        let finalRecurring = recurringRows;
        if (due.length > 0) {
          const generated = [];
          const succeededIds = new Set();
          for (const template of due) {
            try {
              const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
              const day = Math.min(template.dayOfMonth || 1, daysInMonth);
              const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const saved = await insertExpenseRemote(uid, currentUserId, {
                category: template.category, note: template.note, amount: template.amount,
                date: dateStr, paymentMethod: template.paymentMethod,
              });
              await markRecurringGenerated(template.id, nowMonthStr);
              generated.push(saved);
              succeededIds.add(template.id);
            } catch {
              // If one template fails to generate, skip it silently rather than blocking the rest — it'll retry next load.
            }
          }
          if (generated.length > 0) {
            finalExpenses = [...generated, ...finalExpenses];
            setRecurringNotice(`Added ${generated.length} recurring expense${generated.length > 1 ? "s" : ""} for this month.`);
          }
          finalRecurring = recurringRows.map((r) => (
            succeededIds.has(r.id) ? { ...r, lastGeneratedMonth: nowMonthStr } : r
          ));
          setRecurringTemplates(finalRecurring);
        } else {
          setRecurringTemplates(finalRecurring);
        }

        // Same lazy generation, for recurring income.
        const dueIncome = recurringIncomeRows.filter((r) => r.lastGeneratedMonth !== nowMonthStr);
        let finalRecurringIncome = recurringIncomeRows;
        if (dueIncome.length > 0) {
          const generatedIncome = [];
          const succeededIncomeIds = new Set();
          for (const template of dueIncome) {
            try {
              const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
              const day = Math.min(template.dayOfMonth || 1, daysInMonth);
              const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const saved = await insertIncomeRemote(uid, currentUserId, {
                source: template.source, note: template.note, amount: template.amount, date: dateStr,
              });
              await markRecurringIncomeGenerated(template.id, nowMonthStr);
              generatedIncome.push(saved);
              succeededIncomeIds.add(template.id);
            } catch {
              // Skip a failed template rather than blocking the rest — it'll retry next load.
            }
          }
          if (generatedIncome.length > 0) {
            finalIncome = [...generatedIncome, ...finalIncome];
            setRecurringNotice((prev) => {
              const msg = `Added ${generatedIncome.length} recurring income entr${generatedIncome.length > 1 ? "ies" : "y"} for this month.`;
              return prev ? `${prev} ${msg}` : msg;
            });
          }
          finalRecurringIncome = recurringIncomeRows.map((r) => (
            succeededIncomeIds.has(r.id) ? { ...r, lastGeneratedMonth: nowMonthStr } : r
          ));
        }
        setRecurringIncomeTemplates(finalRecurringIncome);
        setIncome([...pendingIncome, ...finalIncome]);
        setExpenses([...pendingExpenses, ...finalExpenses]);

        saveOfflineCache(uid, {
          categories: profileData.categories, budgets: profileData.budgets,
          paymentMethods: profileData.paymentMethods, currency: profileData.currency || "AED",
          memberNames: names, recurringTemplates: finalRecurring,
          expenses: finalExpenses, income: finalIncome,
        });

        if (queuedItems.length > 0) flushQueue();

        // Offer the suggested payment-method setup once, the first time a
        // ledger has none saved yet. Skipping it is remembered locally so it
        // doesn't nag again — an empty list on the server just means "not
        // set up", not "explicitly none".
        const seenKey = `trackit-payment-setup-seen-${uid}`;
        if (profileData.paymentMethods.length === 0 && !localStorage.getItem(seenKey)) {
          setPaymentSetupOpen(true);
        } else {
          maybeShowGettingStarted();
        }
      } catch (err) {
        console.error("Track It: failed to load ledger data —", err);
        setExpenses([]);
        setCustomCategories([]);
        setError("Couldn't load saved data. If this keeps happening, check that every migration in the project's SQL files has been run in Supabase — starting fresh for now.");
      }
    })();
  }, [uid, profile.isDemo]);

  // Checked once data has loaded — not tied to whichever month the person
  // happens to be viewing in the picker, always the real current month,
  // since that's the one actually ending today.
  useEffect(() => {
    if (profile.isDemo || expenses === null) return;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (now.getDate() !== daysInMonth) return;
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (localStorage.getItem(`trackit-month-end-${uid}-${monthKey}`)) return;

    const inThisMonth = (dateStr) => {
      const d = new Date(dateStr + "T00:00:00");
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    const spent = expenses.filter((x) => inThisMonth(x.date)).reduce((s, x) => s + Number(x.amount), 0);
    const earned = income.filter((x) => inThisMonth(x.date)).reduce((s, x) => s + Number(x.amount), 0);
    const saved = savings.filter((x) => inThisMonth(x.date)).reduce((s, x) => s + Number(x.amount), 0);
    const net = earned - spent - saved;
    if (net > 0) {
      setMonthEndNet(net);
      setMonthEndPromptOpen(true);
    }
  }, [expenses, income, savings, profile.isDemo, uid]);

  const persistCategories = useCallback(async (list) => {
    if (!profile.isDemo && !isOnline) { setError("Changing categories needs an internet connection."); return; }
    setCustomCategories(list);
    if (profile.isDemo) return;
    try {
      await withTimeout(saveCategoriesRemote(uid, list), 8000);
    } catch {
      setError("Category saved locally, but syncing failed.");
    }
  }, [uid, profile.isDemo, isOnline]);

  const persistBudgets = useCallback(async (next) => {
    if (!profile.isDemo && !isOnline) { setError("Changing budgets needs an internet connection."); return; }
    setBudgets(next);
    if (profile.isDemo) return;
    try {
      await withTimeout(saveBudgetsRemote(uid, next), 8000);
    } catch {
      setError("Budget saved locally, but syncing failed.");
    }
  }, [uid, profile.isDemo, isOnline]);

  const persistPaymentMethods = useCallback(async (next) => {
    if (!profile.isDemo && !isOnline) { setError("Changing payment methods needs an internet connection."); return; }
    setPaymentMethods(next);
    if (profile.isDemo) return;
    try {
      await withTimeout(savePaymentMethodsRemote(uid, next), 8000);
    } catch {
      setError("Payment methods saved locally, but syncing failed.");
    }
  }, [uid, profile.isDemo, isOnline]);

  const persistCurrency = useCallback(async (code) => {
    if (!profile.isDemo && !isOnline) { setError("Changing currency needs an internet connection."); return; }
    setCurrency(code);
    if (profile.isDemo) return;
    try {
      await withTimeout(saveCurrencyRemote(uid, code), 8000);
    } catch {
      setError("Currency saved locally, but syncing failed.");
    }
  }, [uid, profile.isDemo, isOnline]);

  const maybeShowGettingStarted = useCallback(() => {
    if (profile.isDemo) return;
    if (!localStorage.getItem(`trackit-onboarding-seen-${uid}`)) {
      setGettingStartedOpen(true);
    }
  }, [uid, profile.isDemo]);

  // Ask once, quietly, so a budget-exceeded moment can also show as a browser
  // notification (only while this tab/app is open — real background push
  // would need server infrastructure this app doesn't have).
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const flushQueue = useCallback(async () => {
    if (profile.isDemo || !navigator.onLine) return;
    const queue = loadOfflineQueue(uid);
    if (queue.length === 0) { setPendingSyncCount(0); return; }
    setSyncing(true);
    const remaining = [];
    for (const item of queue) {
      try {
        if (item.type === "expense") {
          const saved = await insertExpenseRemote(uid, currentUserId, item.payload);
          setExpenses((cur) => cur.map((x) => (x.id === item.localId ? saved : x)));
        } else {
          const saved = await insertIncomeRemote(uid, currentUserId, item.payload);
          setIncome((cur) => cur.map((x) => (x.id === item.localId ? saved : x)));
        }
      } catch {
        remaining.push(item); // still offline, or a transient failure — keep it queued and retry next time
      }
    }
    saveOfflineQueue(uid, remaining);
    setPendingSyncCount(remaining.length);
    setSyncing(false);
    if (remaining.length === 0 && queue.length > 0) {
      setRecurringNotice(`Synced ${queue.length} item${queue.length > 1 ? "s" : ""} added while offline.`);
    }
  }, [uid, currentUserId, profile.isDemo]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); flushQueue(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushQueue]);

  useEffect(() => {
    if (!profile.isDemo) setPendingSyncCount(loadOfflineQueue(uid).length);
  }, [uid, profile.isDemo]);

  const currencySymbol = useMemo(() => CURRENCIES.find((c) => c.code === currency)?.symbol || currency, [currency]);
  const fmtMoneyLocal = useCallback((n) => `${currencySymbol} ${fmtNumber(n)}`, [currencySymbol]);

  const checkBudgets = useCallback((fullList, dateStr, category, currentBudgets) => {
    const d = new Date(dateStr + "T00:00:00");
    const monthList = fullList.filter((x) => {
      const xd = new Date(x.date + "T00:00:00");
      return xd.getFullYear() === d.getFullYear() && xd.getMonth() === d.getMonth();
    });
    const total = monthList.reduce((s, x) => s + Number(x.amount), 0);
    const catTotal = monthList.filter((x) => x.category === category).reduce((s, x) => s + Number(x.amount), 0);

    const lines = [];
    if (currentBudgets.overall && total > currentBudgets.overall) {
      lines.push(`Total spending this month is ${fmtMoneyLocal(total)} — over your ${fmtMoneyLocal(currentBudgets.overall)} monthly budget.`);
    }
    const catBudget = currentBudgets.categories?.[category];
    if (catBudget && catTotal > catBudget) {
      lines.push(`${category} spending is ${fmtMoneyLocal(catTotal)} — over your ${fmtMoneyLocal(catBudget)} budget for this category.`);
    }
    if (lines.length > 0) {
      setBudgetAlert({ title: "Limit exceeded", lines });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("Track It — budget alert", { body: lines.join(" "), icon: "/icon-192.png" });
        } catch {
          // Notification construction can fail on some platforms (e.g. iOS Safari) — the in-app modal above still covers it.
        }
      }
    }
  }, []);

  const myDisplayName = memberNames[currentUserId] || "Someone";

  const handleSaveExpense = async (payload) => {
    if (editingExpense && !isOnline) {
      setError("Editing needs an internet connection.");
      return;
    }
    if (payload.newCategory && !categories.some((c) => c.name === payload.newCategory)) {
      if (!isOnline) { setError("Adding a new category needs an internet connection — pick an existing one for now."); return; }
      await persistCategories([...customCategories, payload.newCategory]);
    }
    if (payload.newPaymentMethod && !paymentMethods.includes(payload.newPaymentMethod)) {
      if (!isOnline) { setError("Adding a new payment method needs an internet connection — pick an existing one for now."); return; }
      await persistPaymentMethods([...paymentMethods, payload.newPaymentMethod]);
    }
    const { receiptFile, removeReceipt, ...rest } = payload;
    let finalList;

    if (!isOnline && !profile.isDemo) {
      // Queue it — synced automatically once back online (see flushQueue).
      // Receipt photos can't be queued (they'd need to survive a reload as
      // raw file data), so they're simply not offered while offline — see
      // the disabled state in ExpenseForm.
      const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const entry = { id: localId, createdAt: Date.now(), ...rest, receiptPath: "", pendingSync: true };
      finalList = [entry, ...expenses];
      setExpenses(finalList);
      const queue = loadOfflineQueue(uid);
      queue.push({ localId, type: "expense", payload: rest, createdAt: Date.now() });
      saveOfflineQueue(uid, queue);
      setPendingSyncCount(queue.length);
      checkBudgets(finalList, payload.date, payload.category, budgets);
      setFormOpen(false);
      setEditingExpense(null);
      return;
    }

    try {
      if (editingExpense) {
        let receiptPath = editingExpense.receiptPath;
        if (removeReceipt && editingExpense.receiptPath) {
          try { await deleteReceipt(editingExpense.receiptPath); } catch { /* best effort */ }
          receiptPath = "";
        } else if (receiptFile && !profile.isDemo) {
          if (editingExpense.receiptPath) { try { await deleteReceipt(editingExpense.receiptPath); } catch { /* best effort */ } }
          receiptPath = await uploadReceipt(uid, editingExpense.id, receiptFile);
        }
        const updated = { ...editingExpense, ...rest, receiptPath };
        finalList = expenses.map((x) => (x.id === editingExpense.id ? updated : x));
        setExpenses(finalList);
        if (!profile.isDemo) await withTimeout(updateExpenseRemote(editingExpense.id, { ...rest, receiptPath }), 8000);
        logActivity(uid, currentUserId, myDisplayName, `edited "${rest.category}" (${fmtMoneyLocal(rest.amount)})`).catch(() => {});
      } else {
        const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const entry = { id: tempId, createdAt: Date.now(), ...rest, receiptPath: "" };
        finalList = [entry, ...expenses];
        setExpenses(finalList);
        setJustAddedId(tempId);
        setTimeout(() => setJustAddedId(null), 900);
        if (!profile.isDemo) {
          // The database assigns the real id — swap the temp one out once it comes back
          // so later edits/deletes of this row target the row that actually exists remotely.
          let saved = await withTimeout(insertExpenseRemote(uid, currentUserId, entry), 8000);
          if (receiptFile) {
            try {
              const receiptPath = await uploadReceipt(uid, saved.id, receiptFile);
              await updateExpenseRemote(saved.id, { ...rest, receiptPath });
              saved = { ...saved, receiptPath };
            } catch {
              setError("Saved, but the receipt photo didn't upload.");
            }
          }
          finalList = finalList.map((x) => (x.id === tempId ? saved : x));
          setExpenses((cur) => cur.map((x) => (x.id === tempId ? saved : x)));
          logActivity(uid, currentUserId, myDisplayName, `added "${rest.category}" (${fmtMoneyLocal(rest.amount)})`).catch(() => {});
        }
      }
    } catch {
      setError("Saved locally, but syncing failed.");
    }
    checkBudgets(finalList, payload.date, payload.category, budgets);
    setFormOpen(false);
    setEditingExpense(null);
  };

  const commitDelete = async (item) => {
    if (profile.isDemo) return;
    if (item.pendingSync) {
      // Never made it to the server yet — just drop it from the local queue,
      // no network round trip (and nothing there to conflict with) needed.
      const queue = loadOfflineQueue(uid).filter((q) => q.localId !== item.id);
      saveOfflineQueue(uid, queue);
      setPendingSyncCount(queue.length);
      return;
    }
    try {
      await withTimeout(deleteExpenseRemote(item.id), 8000);
      if (item.receiptPath) { try { await deleteReceipt(item.receiptPath); } catch { /* best effort */ } }
      logActivity(uid, currentUserId, myDisplayName, `deleted "${item.category}" (${fmtMoneyLocal(item.amount)})`).catch(() => {});
    } catch {
      setError("Removed locally, but syncing the delete failed.");
    }
  };

  const handleDelete = (id) => {
    const item = expenses.find((x) => x.id === id);
    if (!item) return;
    if (!item.pendingSync && !isOnline) {
      setError("Deleting needs an internet connection.");
      return;
    }
    setExpenses((cur) => cur.filter((x) => x.id !== id));
    if (pendingDelete) {
      // Only one undo slot at a time — committing the previous pending item
      // now (rather than just cancelling its timer) is what actually
      // deletes it remotely; clearing the timer alone would have silently
      // left it undeleted in the database forever.
      clearTimeout(pendingDelete.timeoutId);
      commitDelete(pendingDelete.item);
    }
    const timeoutId = setTimeout(() => {
      setPendingDelete(null);
      commitDelete(item);
    }, 5000);
    setPendingDelete({ item, timeoutId });
  };

  const handleUndoDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timeoutId);
    setExpenses((cur) => [pendingDelete.item, ...cur]);
    setPendingDelete(null);
  };

  const finishIncomeForm = () => {
    setIncomeFormOpen(false);
    if (chainToBudgetAfterIncome) {
      setChainToBudgetAfterIncome(false);
      setBudgetFormOpen(true);
    }
  };

  const handleAddIncome = async (payload) => {
    const { repeatMonthly, dayOfMonth, ...entryFields } = payload;
    const localId = `${isOnline ? "tmp" : "offline"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry = { id: localId, createdAt: Date.now(), ...entryFields, ...(isOnline ? {} : { pendingSync: true }) };
    setIncome((cur) => [entry, ...cur]);
    if (profile.isDemo) { finishIncomeForm(); return; }
    if (!isOnline) {
      const queue = loadOfflineQueue(uid);
      queue.push({ localId, type: "income", payload: entryFields, createdAt: Date.now() });
      saveOfflineQueue(uid, queue);
      setPendingSyncCount(queue.length);
      finishIncomeForm();
      return;
    }
    try {
      const saved = await withTimeout(insertIncomeRemote(uid, currentUserId, entry), 8000);
      setIncome((cur) => cur.map((x) => (x.id === localId ? saved : x)));
      logActivity(uid, currentUserId, myDisplayName, `logged income "${payload.source}" (${fmtMoneyLocal(payload.amount)})`).catch(() => {});
      // One recurring template per source is enough — skip creating another
      // if checking the box again just re-confirms an existing one.
      if (repeatMonthly && !recurringIncomeTemplates.some((t) => t.source === payload.source)) {
        try {
          const template = await createRecurringIncome(uid, currentUserId, {
            source: payload.source, note: payload.note, amount: payload.amount, dayOfMonth,
          });
          setRecurringIncomeTemplates((cur) => [...cur, template]);
        } catch {
          // Non-critical — the one-off entry above already succeeded either way.
        }
      }
    } catch {
      setError("Saved locally, but syncing failed.");
    }
    finishIncomeForm();
  };

  const handleDeleteIncome = async (id) => {
    const item = income.find((x) => x.id === id);
    if (item && !item.pendingSync && !isOnline) {
      setError("Deleting needs an internet connection.");
      return;
    }
    setIncome((cur) => cur.filter((x) => x.id !== id));
    if (profile.isDemo) return;
    if (item?.pendingSync) {
      const queue = loadOfflineQueue(uid).filter((q) => q.localId !== id);
      saveOfflineQueue(uid, queue);
      setPendingSyncCount(queue.length);
      return;
    }
    try {
      await withTimeout(deleteIncomeRemote(id), 8000);
      if (item) logActivity(uid, currentUserId, myDisplayName, `deleted income "${item.source}" (${fmtMoneyLocal(item.amount)})`).catch(() => {});
    } catch {
      setError("Removed locally, but syncing the delete failed.");
    }
  };

  const handleAddSavings = async (payload) => {
    if (!isOnline) { setError("Logging savings needs an internet connection."); return; }
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry = { id: tempId, createdAt: Date.now(), ...payload };
    setSavings((cur) => [entry, ...cur]);
    if (profile.isDemo) { setSavingsFormOpen(false); return; }
    try {
      const saved = await withTimeout(insertSavingsRemote(uid, currentUserId, entry), 8000);
      setSavings((cur) => cur.map((x) => (x.id === tempId ? saved : x)));
      const verb = Number(payload.amount) < 0 ? "took" : "added";
      logActivity(uid, currentUserId, myDisplayName, `${verb} ${fmtMoneyLocal(Math.abs(payload.amount))} ${Number(payload.amount) < 0 ? "from" : "to"} savings`).catch(() => {});
    } catch {
      setError("Saved locally, but syncing failed.");
    }
    setSavingsFormOpen(false);
  };

  const handleDeleteSavings = async (id) => {
    if (!isOnline) { setError("Deleting needs an internet connection."); return; }
    setSavings((cur) => cur.filter((x) => x.id !== id));
    if (profile.isDemo) return;
    try {
      await withTimeout(deleteSavingsRemote(id), 8000);
    } catch {
      setError("Removed locally, but syncing the delete failed.");
    }
  };

  const markMonthEndDecided = () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (!profile.isDemo) localStorage.setItem(`trackit-month-end-${uid}-${monthKey}`, "1");
  };

  const handleMoveNetToSavings = async () => {
    setMonthEndPromptOpen(false);
    if (profile.isDemo) { markMonthEndDecided(); return; }
    if (!isOnline) { setError("This needs an internet connection — reopen the app once you're back online to decide."); return; }
    try {
      const saved = await withTimeout(insertSavingsRemote(uid, currentUserId, { date: todayISO(), note: "End of month carry-over", amount: monthEndNet }), 8000);
      setSavings((cur) => [saved, ...cur]);
      logActivity(uid, currentUserId, myDisplayName, `moved ${fmtMoneyLocal(monthEndNet)} to savings at month end`).catch(() => {});
      markMonthEndDecided();
    } catch {
      setError("Couldn't move that to savings. Please try again.");
    }
  };

  const handleCarryForwardNet = async () => {
    setMonthEndPromptOpen(false);
    if (profile.isDemo) { markMonthEndDecided(); return; }
    if (!isOnline) { setError("This needs an internet connection — reopen the app once you're back online to decide."); return; }
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const dateStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
    try {
      const saved = await withTimeout(insertIncomeRemote(uid, currentUserId, {
        date: dateStr, source: "Carried over", note: `From ${MONTHS[now.getMonth()]}`, amount: monthEndNet,
      }), 8000);
      setIncome((cur) => [saved, ...cur]);
      logActivity(uid, currentUserId, myDisplayName, `carried ${fmtMoneyLocal(monthEndNet)} forward to next month`).catch(() => {});
      markMonthEndDecided();
    } catch {
      setError("Couldn't carry that forward. Please try again.");
    }
  };

  const handleAddRecurring = async (template) => {
    if (profile.isDemo) return;
    if (!isOnline) throw new Error("This needs an internet connection.");
    const created = await createRecurringExpense(uid, currentUserId, template);
    setRecurringTemplates((cur) => [...cur, created]);
    logActivity(uid, currentUserId, myDisplayName, `set up a recurring "${template.category}" expense (${fmtMoneyLocal(template.amount)}/month)`).catch(() => {});
  };

  const handleDeleteRecurring = async (id) => {
    if (!isOnline) { setError("Removing a recurring expense needs an internet connection."); return; }
    setRecurringTemplates((cur) => cur.filter((x) => x.id !== id));
    if (profile.isDemo) return;
    try {
      await deleteRecurringExpense(id);
    } catch {
      setError("Couldn't remove that recurring expense. Please try again.");
    }
  };

  const handleAddRecurringIncome = async (template) => {
    if (profile.isDemo) return;
    if (!isOnline) throw new Error("This needs an internet connection.");
    const created = await createRecurringIncome(uid, currentUserId, template);
    setRecurringIncomeTemplates((cur) => [...cur, created]);
    logActivity(uid, currentUserId, myDisplayName, `set up recurring income "${template.source}" (${fmtMoneyLocal(template.amount)}/month)`).catch(() => {});
  };

  const handleDeleteRecurringIncome = async (id) => {
    if (!isOnline) { setError("Removing recurring income needs an internet connection."); return; }
    setRecurringIncomeTemplates((cur) => cur.filter((x) => x.id !== id));
    if (profile.isDemo) return;
    try {
      await deleteRecurringIncome(id);
    } catch {
      setError("Couldn't remove that recurring income. Please try again.");
    }
  };

  // rows: [{ date, category, note, amount }, ...] — already parsed and
  // validated by CsvImportModal. Inserted one at a time (same pattern as
  // recurring-expense generation) so one bad row can't block the rest.
  const handleImportExpenses = async (rows) => {
    if (profile.isDemo || !isOnline) throw new Error("Importing needs an internet connection.");
    const newCats = rows.map((r) => r.category).filter((c) => !categories.some((cc) => cc.name === c));
    if (newCats.length > 0) {
      const uniqueNew = [...new Set(newCats)];
      await persistCategories([...customCategories, ...uniqueNew]);
    }
    let imported = 0;
    let failed = 0;
    const savedRows = [];
    for (const row of rows) {
      try {
        const saved = await insertExpenseRemote(uid, currentUserId, { category: row.category, date: row.date, note: row.note, amount: row.amount, paymentMethod: "" });
        savedRows.push(saved);
        imported++;
      } catch {
        failed++;
      }
    }
    if (savedRows.length > 0) {
      setExpenses((cur) => [...savedRows, ...cur]);
      logActivity(uid, currentUserId, myDisplayName, `imported ${imported} expense${imported > 1 ? "s" : ""} from a CSV`).catch(() => {});
    }
    setRecurringNotice(`Imported ${imported} expense${imported === 1 ? "" : "s"}${failed > 0 ? `, ${failed} failed` : ""}.`);
    return { imported, failed };
  };

  const monthExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter((x) => {
      const d = new Date(x.date + "T00:00:00");
      return d.getFullYear() === monthCursor.getFullYear() && d.getMonth() === monthCursor.getMonth();
    });
  }, [expenses, monthCursor]);

  const monthTotal = useMemo(() => monthExpenses.reduce((s, x) => s + Number(x.amount), 0), [monthExpenses]);

  const breakdown = useMemo(() => {
    const map = {};
    monthExpenses.forEach((x) => { map[x.category] = (map[x.category] || 0) + Number(x.amount); });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, color: catColor(categoryColorIndex[name] ?? 0) }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses, categoryColorIndex]);

  const categoryOverview = useMemo(() => {
    const spentMap = {};
    monthExpenses.forEach((x) => { spentMap[x.category] = (spentMap[x.category] || 0) + Number(x.amount); });
    return categories
      .map((c, i) => ({
        name: c.name,
        value: spentMap[c.name] || 0,
        budget: budgets.categories?.[c.name] || null,
        color: catColor(i),
      }))
      .sort((a, b) => {
        if (a.budget && !b.budget) return -1;
        if (!a.budget && b.budget) return 1;
        return b.value - a.value;
      });
  }, [categories, monthExpenses, budgets]);

  // Categories with no spending and no budget this month are just noise in
  // the list — tucked behind "show all" instead of always taking up space.
  const categoryOverviewActive = useMemo(() => categoryOverview.filter((c) => c.value > 0 || c.budget), [categoryOverview]);
  const categoryOverviewHiddenCount = categoryOverview.length - categoryOverviewActive.length;
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [showAllIncome, setShowAllIncome] = useState(false);
  const [showAllPaymentMethods, setShowAllPaymentMethods] = useState(false);
  useEffect(() => { setShowAllExpenses(false); setShowAllIncome(false); }, [monthCursor, selectedDate, activeFilters, searchQuery]);

  const paymentBreakdown = useMemo(() => {
    const map = {};
    monthExpenses.forEach((x) => {
      const key = x.paymentMethod && x.paymentMethod.trim() ? x.paymentMethod : "Not specified";
      map[key] = (map[key] || 0) + Number(x.amount);
    });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value, color: catColor(i) }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses]);

  const monthIncome = useMemo(() => {
    return income.filter((x) => {
      const d = new Date(x.date + "T00:00:00");
      return d.getFullYear() === monthCursor.getFullYear() && d.getMonth() === monthCursor.getMonth();
    });
  }, [income, monthCursor]);

  const monthIncomeTotal = useMemo(() => monthIncome.reduce((s, x) => s + Number(x.amount), 0), [monthIncome]);

  const monthSavings = useMemo(() => {
    return savings.filter((x) => {
      const d = new Date(x.date + "T00:00:00");
      return d.getFullYear() === monthCursor.getFullYear() && d.getMonth() === monthCursor.getMonth();
    });
  }, [savings, monthCursor]);

  const monthSavingsTotal = useMemo(() => monthSavings.reduce((s, x) => s + Number(x.amount), 0), [monthSavings]);

  // The running savings balance to date — entries can be negative (a "Take
  // from savings" withdrawal reduces this), so this is a simple running
  // sum of everything ever logged, not scoped to any one month.
  const savingsCumulativeTotal = useMemo(() => savings.reduce((s, x) => s + Number(x.amount), 0), [savings]);

  // Money moved to savings counts against available cash the same way an
  // expense does — it's tracked in its own area so it's visible separately,
  // but it still reduces what's actually left over this month. A withdrawal
  // (negative amount) works in reverse, correctly adding back to Net.
  const monthNet = monthIncomeTotal - monthTotal - monthSavingsTotal;

  const trendData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}`, spent: 0, income: 0 });
    }
    const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
    (expenses || []).forEach((x) => {
      const key = x.date.slice(0, 7);
      if (byKey[key]) byKey[key].spent += Number(x.amount);
    });
    (income || []).forEach((x) => {
      const key = x.date.slice(0, 7);
      if (byKey[key]) byKey[key].income += Number(x.amount);
    });
    return months;
  }, [expenses, income]);

  // Which days in the currently viewed month have expense/income activity —
  // used to draw dots on the calendar grid. Independent of any date filter
  // currently applied, since the calendar should always show the full
  // month's picture.
  const dayActivity = useMemo(() => {
    const map = {};
    monthExpenses.forEach((x) => {
      map[x.date] = map[x.date] || { expense: false, income: false };
      map[x.date].expense = true;
    });
    monthIncome.forEach((x) => {
      map[x.date] = map[x.date] || { expense: false, income: false };
      map[x.date].income = true;
    });
    return map;
  }, [monthExpenses, monthIncome]);

  const visibleList = useMemo(() => {
    let list = activeFilters.size === 0 ? monthExpenses : monthExpenses.filter((x) => activeFilters.has(x.category));
    if (selectedDate) list = list.filter((x) => x.date === selectedDate);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((x) =>
        x.category.toLowerCase().includes(q) ||
        (x.note && x.note.toLowerCase().includes(q)) ||
        (x.paymentMethod && x.paymentMethod.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  }, [monthExpenses, activeFilters, searchQuery, selectedDate]);

  const visibleIncome = useMemo(() => {
    return selectedDate ? monthIncome.filter((x) => x.date === selectedDate) : monthIncome;
  }, [monthIncome, selectedDate]);

  const recentTape = useMemo(() => {
    return [...(expenses || [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  }, [expenses]);

  const toggleFilter = (name) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleExportCSV = () => {
    const escapeCsv = (val) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [["Date", "Category", "Note", "Payment method", "Amount"]];
    visibleList.forEach((x) => rows.push([x.date, x.category, x.note || "", x.paymentMethod || "", x.amount]));
    const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `track-it-${MONTHS[monthCursor.getMonth()].toLowerCase()}-${monthCursor.getFullYear()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (expenses === null) {
    return <div style={{ ...styles.centerFill, color: T.parchment }}>Loading your tracker…</div>;
  }

  return (
    <CurrencyContext.Provider value={{ code: currency, symbol: CURRENCIES.find((c) => c.code === currency)?.symbol || currency }}>
    <div style={styles.dashboardWrap}>
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <DirhamSymbol size={20} color={T.gold} />
          <h1 style={styles.wordmarkSmall}>Track It</h1>
        </div>
        <div style={styles.headerToolbar}>
          {!profile.isDemo && ledgerList && ledgerList.length > 0 ? (
            <button
              className="icon-btn-hover"
              style={{ ...styles.iconGhostBtn, gap: 6, padding: "6px 10px" }}
              onClick={() => setLedgerSwitcherOpen(true)}
              title="Switch ledger"
            >
              <BookMarked size={14} />
              <span style={{ color: T.parchment, opacity: 0.85, fontSize: 14 }}>{profile.name}</span>
              <ChevronDown size={13} />
            </button>
          ) : (
            <span style={{ color: T.parchment, opacity: 0.85, fontSize: 14 }}>{profile.name}</span>
          )}
          {!profile.isDemo && (
            <button className="icon-btn-hover" style={styles.iconGhostBtn} onClick={() => setMembersOpen(true)} title="Invite people to this ledger">
              <Users size={16} />
            </button>
          )}
          <div style={{ position: "relative" }}>
            <button className="icon-btn-hover" style={styles.iconGhostBtn} onClick={() => setExportMenuOpen((v) => !v)} title="Export month">
              <Download size={16} />
            </button>
            {exportMenuOpen && (
              <>
                <div style={styles.exportMenuBackdrop} onClick={() => setExportMenuOpen(false)} />
                <div style={styles.exportMenu}>
                  <button
                    type="button"
                    style={styles.exportMenuItem}
                    onClick={() => { setExportMenuOpen(false); window.print(); }}
                  >
                    <Download size={14} /> PDF
                  </button>
                  <button
                    type="button"
                    style={styles.exportMenuItem}
                    onClick={() => { setExportMenuOpen(false); handleExportCSV(); }}
                  >
                    <FileSpreadsheet size={14} /> CSV
                  </button>
                </div>
              </>
            )}
          </div>
          <button className="icon-btn-hover" style={styles.iconGhostBtn} onClick={() => setBudgetFormOpen(true)} title="Set budgets">
            <Target size={16} />
          </button>
          <button className="icon-btn-hover" style={styles.iconGhostBtn} onClick={() => setTrendsOpen(true)} title="Spending trends">
            <BarChart3 size={16} />
          </button>
          {!profile.isDemo && (
            <button className="icon-btn-hover" style={styles.iconGhostBtn} onClick={() => setActivityOpen(true)} title="Activity log">
              <History size={16} />
            </button>
          )}
          {!profile.isDemo && (
            <button className="icon-btn-hover" style={styles.iconGhostBtn} onClick={() => setSettingsOpen(true)} title="Account settings">
              <Settings size={16} />
            </button>
          )}
          <button className="icon-btn-hover" style={styles.iconGhostBtn} onClick={onLogout} title={profile.isDemo ? "Exit demo" : "Sign out"}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {membersOpen && (
        <MembersModal
          ledgerId={uid}
          currentUserId={currentUserId}
          ledgerName={profile.name}
          inviterName={myDisplayName}
          onClose={() => setMembersOpen(false)}
        />
      )}

      {ledgerSwitcherOpen && (
        <LedgerSwitcherModal
          ledgerList={ledgerList}
          activeId={uid}
          isOwner={isLedgerOwner}
          onSwitch={(id) => { onSwitchLedger(id); setLedgerSwitcherOpen(false); }}
          onCreate={async (name) => { await onCreateLedger(name); setLedgerSwitcherOpen(false); }}
          onDelete={async () => { await onDeleteLedger(uid); setLedgerSwitcherOpen(false); }}
          onClose={() => setLedgerSwitcherOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          userEmail={userEmail}
          ledgerName={profile.name}
          currency={currency}
          onChangeCurrency={persistCurrency}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {trendsOpen && (
        <TrendsModal data={trendData} currencySymbol={currencySymbol} onClose={() => setTrendsOpen(false)} />
      )}

      {activityOpen && (
        <ActivityLogModal ledgerId={uid} onClose={() => setActivityOpen(false)} />
      )}

      <div className="print-only" style={styles.printReport}>
        <div style={styles.printHeader}>
          <h1 style={styles.printTitle}>Track It</h1>
          <div style={{ fontSize: 13 }}>{profile.name}</div>
        </div>
        <div style={styles.printMeta}>
          <span>{MONTHS[monthCursor.getMonth()]} {monthCursor.getFullYear()}</span>
          <span>Generated {new Date().toLocaleDateString()}</span>
        </div>
        <div style={styles.printTotalRow}>
          <span>Total spent</span>
          <span style={{ fontWeight: 700 }}><Money amount={monthTotal} size={16} /></span>
        </div>

        {breakdown.length > 0 && (
          <>
            <h2 style={styles.printSectionTitle}>By category</h2>
            <table style={styles.printTable}>
              <tbody>
                {breakdown.map((c) => (
                  <tr key={c.name}>
                    <td style={styles.printTdLabel}>{c.name}</td>
                    <td style={styles.printTdAmount}><Money amount={c.value} size={13} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h2 style={styles.printSectionTitle}>
          {activeFilters.size > 0 ? "Filtered transactions" : "All transactions"}
        </h2>
        {visibleList.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.7 }}>No expenses this month.</div>
        ) : (
          <table style={styles.printTable}>
            <thead>
              <tr>
                <th style={styles.printTh}>Date</th>
                <th style={styles.printTh}>Category</th>
                <th style={styles.printTh}>Note</th>
                <th style={styles.printTh}>Payment</th>
                <th style={{ ...styles.printTh, textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {visibleList.map((x) => (
                <tr key={x.id}>
                  <td style={styles.printTd}>{new Date(x.date).toLocaleDateString()}</td>
                  <td style={styles.printTd}>{x.category}</td>
                  <td style={styles.printTd}>{x.note || ""}</td>
                  <td style={styles.printTd}>{x.paymentMethod || ""}</td>
                  <td style={{ ...styles.printTd, textAlign: "right" }}><Money amount={x.amount} size={13} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TapeStrip entries={recentTape} categoryColorIndex={categoryColorIndex} justAddedId={justAddedId} />

      {!isOnline && !profile.isDemo && (
        <div style={{ ...styles.errorBanner, background: `${T.ink}`, border: "none" }}>
          <WifiOff size={14} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            You're offline — you can still add expenses and income; they'll sync once you're back.
            {pendingSyncCount > 0 ? ` ${pendingSyncCount} item${pendingSyncCount > 1 ? "s" : ""} waiting to sync.` : ""}
          </span>
        </div>
      )}

      {isOnline && pendingSyncCount > 0 && !profile.isDemo && (
        <div style={{ ...styles.errorBanner, background: `${T.sage}22`, border: `1px solid ${T.sage}55` }}>
          <span style={{ flex: 1 }}>
            {syncing ? "Syncing…" : `${pendingSyncCount} item${pendingSyncCount > 1 ? "s" : ""} still waiting to sync.`}
          </span>
          {!syncing && (
            <button onClick={flushQueue} style={{ ...styles.errorDismiss, textDecoration: "underline", opacity: 1, whiteSpace: "nowrap" }}>
              Sync now
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button onClick={() => setError("")} style={styles.errorDismiss}><X size={14} /></button>
        </div>
      )}

      {recurringNotice && (
        <div style={{ ...styles.errorBanner, background: `${T.sage}22`, border: `1px solid ${T.sage}55` }}>
          <Repeat size={14} /> {recurringNotice}
          <button onClick={() => setRecurringNotice("")} style={styles.errorDismiss}><X size={14} /></button>
        </div>
      )}

      {pendingDelete && (
        <div style={styles.undoToast}>
          <span>Deleted "{pendingDelete.item.category}"</span>
          <button style={styles.undoBtn} onClick={handleUndoDelete}>
            <RotateCcw size={13} /> Undo
          </button>
        </div>
      )}

      <main className="main-grid" style={styles.mainGrid}>
        <section style={styles.leftCol}>
          <div style={{ ...styles.card, padding: "16px 18px" }}>
            <div style={{ ...styles.monthNav, marginBottom: 6 }}>
              <button style={styles.iconGhostBtnDark} onClick={() => { setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1)); setSelectedDate(null); }}>
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setCalendarOpen(true)}
                style={{ ...styles.monthLabel, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                title="View calendar"
              >
                {MONTHS[monthCursor.getMonth()]} {monthCursor.getFullYear()}
                <CalendarDays size={15} style={{ opacity: 0.5 }} />
              </button>
              <button style={styles.iconGhostBtnDark} onClick={() => { setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1)); setSelectedDate(null); }}>
                <ChevronRight size={18} />
              </button>
            </div>
            {selectedDate && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  style={{ ...styles.chip, display: "flex", alignItems: "center", gap: 6, borderColor: T.gold }}
                >
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  <X size={12} />
                </button>
              </div>
            )}
            <div style={{ ...styles.totalRow, marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, opacity: 0.6 }}>Spent this month</span>
              <span style={{ ...styles.totalNumber, fontSize: 28 }}><Money amount={monthTotal} size={22} /></span>
              {budgets.overall > 0 ? (
                <div style={{ width: "100%", marginTop: 6 }}>
                  <div style={styles.progressTrack}>
                    <div style={{
                      ...styles.progressFill,
                      width: `${Math.min(100, (monthTotal / budgets.overall) * 100)}%`,
                      background: monthTotal > budgets.overall ? T.brick : T.sage,
                    }} />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setBudgetFormOpen(true)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    width: "100%", marginTop: 8, padding: "8px 10px", borderRadius: 10,
                    border: `1.5px dashed ${T.parchmentDim}`, background: "transparent",
                    color: T.ink, opacity: 0.75, fontSize: 12, cursor: "pointer",
                  }}
                >
                  <Target size={13} /> No budget set yet — tap to set one
                </button>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, width: "100%", marginTop: 12 }}>
                {budgets.overall > 0 && (
                  <div style={{ ...styles.statPill, background: T.forestDeep }}>
                    <span style={{ ...styles.statPillLabel, color: T.parchment, opacity: 0.75 }}><Target size={11} /> Budget</span>
                    <span style={{ ...styles.statPillValue, color: T.parchment }}><Money amount={budgets.overall} size={15} color={T.parchment} /></span>
                  </div>
                )}
                {(monthIncomeTotal > 0 || income.length > 0) && (
                  <div style={{ ...styles.statPill, background: "#1E3E28" }}>
                    <span style={{ ...styles.statPillLabel, color: "#8FCB94" }}><TrendingUp size={11} /> Income</span>
                    <span style={{ ...styles.statPillValue, color: "#8FCB94" }}><Money amount={monthIncomeTotal} size={15} color="#8FCB94" /></span>
                  </div>
                )}
                {savings.length > 0 && (
                  <div style={{ ...styles.statPill, background: "#4A3814" }}>
                    <span style={{ ...styles.statPillLabel, color: "#E8C766" }}><PiggyBank size={11} /> Savings</span>
                    <span style={{ ...styles.statPillValue, color: "#E8C766" }}><Money amount={savingsCumulativeTotal} size={15} color="#E8C766" /></span>
                  </div>
                )}
                {(monthIncomeTotal > 0 || income.length > 0 || savingsCumulativeTotal !== 0 || savings.length > 0) && (
                  <div style={{ ...styles.statPill, background: monthNet >= 0 ? T.ink : "#4A1E24" }}>
                    <span style={{ ...styles.statPillLabel, color: monthNet >= 0 ? T.parchment : "#E89AA3", opacity: 0.75 }}>
                      <Wallet size={11} /> Net balance
                    </span>
                    <span style={{ ...styles.statPillValue, color: monthNet >= 0 ? T.parchment : "#E89AA3" }}>
                      <Money amount={monthNet} size={15} color={monthNet >= 0 ? T.parchment : "#E89AA3"} />
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ height: 150, marginTop: 6 }}>
              {breakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={36} outerRadius={60} paddingAngle={2}>
                      {breakdown.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtMoneyLocal(v)} contentStyle={{ background: T.ink, border: "none", borderRadius: 8, color: T.parchment, fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={styles.emptyRingWrap}>
                  <div style={{ ...styles.emptyRing, width: 100, height: 100 }}>
                    <span style={{ fontSize: 11, opacity: 0.5, textAlign: "center", padding: "0 10px" }}>
                      no spending logged yet
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4, maxHeight: 200, overflowY: "auto" }}>
              {(showAllCategories ? categoryOverview : categoryOverviewActive).map((b) => {
                return (
                  <div key={b.name}>
                    <div style={styles.legendRow}>
                      <span style={{ ...styles.legendDot, background: b.color }} />
                      <span style={{ flex: 1, fontSize: 13 }}>{b.name}</span>
                      <span style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <Money amount={b.value} size={12} />{b.budget > 0 ? <> / <Money amount={b.budget} size={12} /></> : ""}
                      </span>
                    </div>
                    {b.budget > 0 && (
                      <div style={{ ...styles.progressTrack, height: 4, marginTop: 3 }}>
                        <div style={{
                          ...styles.progressFill,
                          width: `${Math.min(100, (b.value / b.budget) * 100)}%`,
                          background: b.value > b.budget ? T.brick : b.color,
                        }} />
                      </div>
                    )}
                  </div>
                );
              })}
              {categoryOverviewHiddenCount > 0 && (
                <button
                  type="button"
                  style={{ ...styles.textBtn, marginTop: 0, textAlign: "left", fontSize: 12.5 }}
                  onClick={() => setShowAllCategories((v) => !v)}
                >
                  {showAllCategories ? "Show less" : `+${categoryOverviewHiddenCount} more categor${categoryOverviewHiddenCount > 1 ? "ies" : "y"}`}
                </button>
              )}
            </div>
          </div>

          <button style={styles.addBtn} onClick={() => { setEditingExpense(null); setFormOpen(true); }}>
            <Plus size={18} /> Log an expense
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...styles.addBtnSecondary, flex: 1 }} onClick={() => setIncomeFormOpen(true)}>
              <TrendingUp size={17} /> Log an income
            </button>
            <button style={{ ...styles.addBtnSecondary, flex: 1, background: T.ink }} onClick={() => setBudgetFormOpen(true)}>
              <Target size={17} /> Set budget
            </button>
          </div>

          {!profile.isDemo && (
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...styles.secondaryIconBtn, flex: 1 }} onClick={() => setRecurringOpen(true)} title="Recurring expenses & income">
                <Repeat size={16} /> <span style={{ fontSize: 12.5, fontWeight: 600 }}>Recurring</span>
              </button>
              <button
                style={{ ...styles.secondaryIconBtn, flex: 1, ...(isOnline ? {} : { opacity: 0.4, cursor: "not-allowed" }) }}
                onClick={() => isOnline ? setCsvImportOpen(true) : setError("Importing needs an internet connection.")}
                title="Import from a bank CSV"
              >
                <Upload size={16} /> <span style={{ fontSize: 12.5, fontWeight: 600 }}>Import CSV</span>
              </button>
            </div>
          )}

          <div style={{ ...styles.card, padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, opacity: 0.6, display: "flex", alignItems: "center", gap: 6 }}>
                <PiggyBank size={14} /> Total savings
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 15 }}>
                <Money amount={savingsCumulativeTotal} size={14} color={T.gold} />
              </span>
            </div>
            <p style={{ fontSize: 11.5, opacity: 0.55, margin: "4px 0 10px" }}>
              Your running balance to date. Money added here counts against your available cash for that month,
              alongside expenses — it's subtracted from Net. Taking money back out adds it back to Net.
            </p>
            {savings.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10, maxHeight: 160, overflowY: "auto" }}>
                {savings.slice(0, 20).map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <span style={{ flex: 1, opacity: 0.75 }}>
                      {s.date} {s.note ? `· ${s.note}` : Number(s.amount) < 0 ? "· Taken from savings" : ""}
                    </span>
                    <Money amount={s.amount} size={12} color={Number(s.amount) < 0 ? T.brick : T.gold} />
                    <button className="row-icon-hover" style={{ ...styles.rowIconBtn, width: 22, height: 22 }} onClick={() => handleDeleteSavings(s.id)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={{ ...styles.secondaryBtnSmall, flex: 1, justifyContent: "center" }} onClick={() => setSavingsFormOpen("add")}>
                <Plus size={14} /> Log savings
              </button>
              <button type="button" style={{ ...styles.secondaryBtnSmall, flex: 1, justifyContent: "center" }} onClick={() => setSavingsFormOpen("withdraw")}>
                <RotateCcw size={14} /> Take from savings
              </button>
            </div>
          </div>

          {(paymentMethods.length > 0 || (paymentBreakdown.length > 1 || (paymentBreakdown.length === 1 && paymentBreakdown[0].name !== "Not specified"))) && (
            <div style={{ ...styles.card, padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12.5, opacity: 0.6 }}>By payment method this month</span>
                <button className="row-icon-hover" style={styles.rowIconBtn} onClick={() => setPaymentSetupOpen(true)} title="Edit payment methods">
                  <Pencil size={13} />
                </button>
              </div>

              <div style={{ height: 110, marginTop: 4 }}>
                {paymentBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentBreakdown} dataKey="value" nameKey="name" innerRadius={28} outerRadius={46} paddingAngle={2}>
                        {paymentBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtMoneyLocal(v)} contentStyle={{ background: T.ink, border: "none", borderRadius: 8, color: T.parchment, fontSize: 13 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={styles.emptyRingWrap}>
                    <div style={{ ...styles.emptyRing, width: 80, height: 80 }}>
                      <span style={{ fontSize: 10.5, opacity: 0.5, textAlign: "center", padding: "0 8px" }}>No spending yet</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
                {(showAllPaymentMethods ? paymentBreakdown : paymentBreakdown.slice(0, 6)).map((b) => (
                  <div key={b.name} style={styles.legendRow}>
                    <span style={{ ...styles.legendDot, background: b.color }} />
                    <span style={{ flex: 1, fontSize: 13 }}>{b.name}</span>
                    <span style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
                      <Money amount={b.value} size={12} />
                    </span>
                  </div>
                ))}
                {paymentBreakdown.length > 6 && (
                  <button
                    type="button"
                    style={{ ...styles.textBtn, marginTop: 0, textAlign: "left", fontSize: 12.5 }}
                    onClick={() => setShowAllPaymentMethods((v) => !v)}
                  >
                    {showAllPaymentMethods ? "Show less" : `+${paymentBreakdown.length - 6} more`}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section style={styles.rightCol}>
          <div style={styles.searchRow}>
            <Search size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
            <input
              style={styles.searchInput}
              placeholder="Search notes, categories, payment method"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button style={styles.chipClear} onClick={() => setSearchQuery("")}>Clear</button>
            )}
          </div>

          <div style={styles.filterRow}>
            {categories.map((c, i) => {
              const active = activeFilters.has(c.name);
              return (
                <button
                  key={c.name}
                  onClick={() => toggleFilter(c.name)}
                  style={{
                    ...styles.chip,
                    borderColor: active ? catColor(i) : "transparent",
                    background: active ? `${catColor(i)}22` : T.parchmentDim,
                    color: active ? T.ink : T.ink,
                  }}
                >
                  {c.name}
                </button>
              );
            })}
            {activeFilters.size > 0 && (
              <button style={styles.chipClear} onClick={() => setActiveFilters(new Set())}>Clear</button>
            )}
          </div>

          <div style={styles.listCard}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "14px 18px 10px", fontSize: 12.5, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.55,
              borderBottom: `1px solid ${T.parchmentDim}`,
            }}>
              <Receipt size={13} /> {selectedDate ? "Expenses that day" : "Expenses this month"}
            </div>
            {visibleList.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", opacity: 0.55 }}>
                <Receipt size={26} style={{ marginBottom: 8 }} />
                <p>No expenses match here yet — log one, or clear filters.</p>
              </div>
            ) : (
              (showAllExpenses ? visibleList : visibleList.slice(0, 8)).map((x) => {
                const idx = categoryColorIndex[x.category] ?? 0;
                const addedByName = x.addedBy && x.addedBy !== currentUserId ? memberNames[x.addedBy] : null;
                return (
                  <div key={x.id} className="row-hover" style={styles.expenseRow}>
                    <span style={{ ...styles.rowDot, background: catColor(idx) }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{x.category}</div>
                      <div style={{ fontSize: 12.5, opacity: 0.6 }}>
                        {x.date} {x.note ? `· ${x.note}` : ""} {addedByName ? `· added by ${addedByName}` : ""} {x.pendingSync ? "· syncing…" : ""}
                      </div>
                    </div>
                    <div style={styles.rowAmount}><Money amount={Number(x.amount)} size={13.5} /></div>
                    <div style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {x.receiptPath && (
                        <button
                          className="row-icon-hover" style={styles.rowIconBtn}
                          title="View receipt"
                          onClick={async () => {
                            setReceiptViewerLoading(true);
                            setReceiptViewerOpen(true);
                            try {
                              const url = await getReceiptUrl(x.receiptPath);
                              setReceiptViewerUrl(url);
                            } catch {
                              setReceiptViewerOpen(false);
                              setError("Couldn't open that receipt right now.");
                            } finally {
                              setReceiptViewerLoading(false);
                            }
                          }}
                        >
                          <Camera size={14} />
                        </button>
                      )}
                    </div>
                    <button className="row-icon-hover" style={styles.rowIconBtn} onClick={() => { setEditingExpense(x); setFormOpen(true); }}>
                      <Pencil size={14} />
                    </button>
                    <button className="row-icon-hover" style={{ ...styles.rowIconBtn, color: T.brick }} onClick={() => handleDelete(x.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
            {visibleList.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAllExpenses((v) => !v)}
                style={{
                  width: "100%", textAlign: "center", padding: "12px 18px", fontSize: 12.5, fontWeight: 700,
                  border: "none", background: "transparent", color: T.ink, opacity: 0.6, cursor: "pointer",
                  borderTop: `1px solid ${T.parchmentDim}`,
                }}
              >
                {showAllExpenses ? "Show less" : `Show all ${visibleList.length}`}
              </button>
            )}
          </div>

          {visibleIncome.length > 0 && (
            <div style={{ ...styles.listCard, marginTop: 16 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "14px 18px 10px", fontSize: 12.5, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.55,
                borderBottom: `1px solid ${T.parchmentDim}`,
              }}>
                <TrendingUp size={13} /> {selectedDate ? "Income that day" : "Income this month"}
              </div>
              {(showAllIncome ? visibleIncome : visibleIncome.slice(0, 8)).map((x) => (
                <div key={x.id} className="row-hover" style={styles.expenseRow}>
                  <span style={{ ...styles.rowDot, background: T.sage }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{x.source}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.6 }}>{x.date} {x.note ? `· ${x.note}` : ""} {x.pendingSync ? "· syncing…" : ""}</div>
                  </div>
                  <div style={styles.rowAmount}><Money amount={Number(x.amount)} size={13.5} color={T.sage} /></div>
                  <button className="row-icon-hover" style={{ ...styles.rowIconBtn, color: T.brick }} onClick={() => handleDeleteIncome(x.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {visibleIncome.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllIncome((v) => !v)}
                  style={{
                    width: "100%", textAlign: "center", padding: "12px 18px", fontSize: 12.5, fontWeight: 700,
                    border: "none", background: "transparent", color: T.ink, opacity: 0.6, cursor: "pointer",
                    borderTop: `1px solid ${T.parchmentDim}`,
                  }}
                >
                  {showAllIncome ? "Show less" : `Show all ${visibleIncome.length}`}
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      {formOpen && (
        <ExpenseForm
          categories={categories}
          paymentMethods={paymentMethods}
          initial={editingExpense}
          isOnline={isOnline}
          isEditing={!!editingExpense}
          onCancel={() => { setFormOpen(false); setEditingExpense(null); }}
          onSave={handleSaveExpense}
        />
      )}

      {incomeFormOpen && (
        <IncomeForm
          onCancel={() => { setIncomeFormOpen(false); setChainToBudgetAfterIncome(false); }}
          onSave={handleAddIncome}
        />
      )}

      {savingsFormOpen && (
        <SavingsForm
          mode={savingsFormOpen}
          currentBalance={savingsCumulativeTotal}
          onCancel={() => setSavingsFormOpen(false)}
          onSave={handleAddSavings}
        />
      )}

      {recurringOpen && (
        <RecurringModal
          categories={categories}
          paymentMethods={paymentMethods}
          templates={recurringTemplates}
          onAdd={handleAddRecurring}
          onDelete={handleDeleteRecurring}
          incomeTemplates={recurringIncomeTemplates}
          onAddIncome={handleAddRecurringIncome}
          onDeleteIncome={handleDeleteRecurringIncome}
          onClose={() => setRecurringOpen(false)}
        />
      )}

      {csvImportOpen && (
        <CsvImportModal
          categories={categories}
          onImport={handleImportExpenses}
          onClose={() => setCsvImportOpen(false)}
        />
      )}

      {receiptViewerOpen && (
        <div style={styles.modalOverlay} onClick={() => { setReceiptViewerOpen(false); setReceiptViewerUrl(""); }}>
          <div style={{ ...styles.modalCard, maxWidth: 480, padding: 16, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...styles.modalHeader, marginBottom: 10 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, margin: 0 }}>Receipt</h2>
              <button
                type="button" style={styles.iconGhostBtnDark}
                onClick={() => { setReceiptViewerOpen(false); setReceiptViewerUrl(""); }}
              >
                <X size={18} />
              </button>
            </div>
            {receiptViewerLoading ? (
              <p style={{ fontSize: 13.5, opacity: 0.6, padding: "30px 0" }}>Loading…</p>
            ) : receiptViewerUrl ? (
              <img
                src={receiptViewerUrl}
                alt="Receipt"
                style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 10, display: "block" }}
              />
            ) : (
              <p style={{ fontSize: 13.5, opacity: 0.6, padding: "30px 0" }}>Couldn't load this receipt.</p>
            )}
          </div>
        </div>
      )}

      {budgetFormOpen && (
        <BudgetForm
          categories={categories}
          budgets={budgets}
          onCancel={() => setBudgetFormOpen(false)}
          onSave={async (next) => { await persistBudgets(next); setBudgetFormOpen(false); }}
        />
      )}

      {paymentSetupOpen && (
        <PaymentMethodsSetupModal
          existing={paymentMethods}
          onSave={async (next) => {
            await persistPaymentMethods(next);
            if (!profile.isDemo) localStorage.setItem(`trackit-payment-setup-seen-${uid}`, "1");
            setPaymentSetupOpen(false);
            maybeShowGettingStarted();
          }}
          onSkip={() => {
            if (!profile.isDemo) localStorage.setItem(`trackit-payment-setup-seen-${uid}`, "1");
            setPaymentSetupOpen(false);
            maybeShowGettingStarted();
          }}
        />
      )}

      {gettingStartedOpen && (
        <GettingStartedModal
          onClose={() => {
            if (!profile.isDemo) localStorage.setItem(`trackit-onboarding-seen-${uid}`, "1");
            setGettingStartedOpen(false);
          }}
          onOpenBudget={() => {
            if (!profile.isDemo) localStorage.setItem(`trackit-onboarding-seen-${uid}`, "1");
            setGettingStartedOpen(false);
            setBudgetFormOpen(true);
          }}
          onOpenIncome={() => {
            if (!profile.isDemo) localStorage.setItem(`trackit-onboarding-seen-${uid}`, "1");
            setGettingStartedOpen(false);
            setChainToBudgetAfterIncome(true);
            setIncomeFormOpen(true);
          }}
        />
      )}

      {budgetAlert && (
        <BudgetAlertModal alert={budgetAlert} onClose={() => setBudgetAlert(null)} />
      )}

      {monthEndPromptOpen && (
        <MonthEndModal
          amount={monthEndNet}
          monthName={MONTHS[new Date().getMonth()]}
          onMoveToSavings={handleMoveNetToSavings}
          onCarryForward={handleCarryForwardNet}
          onDismiss={() => setMonthEndPromptOpen(false)}
        />
      )}

      {calendarOpen && (
        <CalendarModal
          month={monthCursor}
          activity={dayActivity}
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); setCalendarOpen(false); }}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
    </CurrencyContext.Provider>
  );
}

/* ================================================================
   TAPE STRIP (signature element)
================================================================= */
function TapeStrip({ entries, categoryColorIndex, justAddedId }) {
  const renderItems = (keyPrefix) =>
    entries.map((e) => (
      <span
        key={`${keyPrefix}-${e.id}`}
        style={{
          ...styles.tapeItem,
          animation: keyPrefix === "a" && e.id === justAddedId ? "printIn 0.5s ease-out" : "none",
        }}
      >
        <span style={{ ...styles.tapeDot, background: catColor(categoryColorIndex[e.category] ?? 0) }} />
        {e.category} <Money amount={Number(e.amount)} size={12} color={T.parchment} />
      </span>
    ));

  return (
    <div style={styles.tapeOuter}>
      <div style={styles.tapePerfTop} />
      <div style={styles.tapeRow}>
        <span style={styles.tapeLabel}>
          <span style={styles.tapeLiveDot} /> Recent
        </span>
        <div style={styles.tapeScroll}>
          {entries.length === 0 ? (
            <span style={{ opacity: 0.5, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
              Nothing logged yet
            </span>
          ) : (
            <div style={{ display: "flex", width: "max-content" }} className="ticker-track">
              <div style={{ display: "flex", gap: 22, paddingRight: 22 }}>{renderItems("a")}</div>
              {/* Duplicate the track so the loop point is invisible — this is the standard
                  seamless-marquee trick: scroll exactly one copy's width, then reset. */}
              <div style={{ display: "flex", gap: 22, paddingRight: 22 }} aria-hidden="true">{renderItems("b")}</div>
            </div>
          )}
        </div>
      </div>
      <div style={styles.tapePerfBottom} />
    </div>
  );
}

/* ================================================================
   EXPENSE FORM
================================================================= */
function ExpenseForm({ categories, paymentMethods, initial, isOnline, isEditing, onCancel, onSave }) {
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [category, setCategory] = useState(initial ? initial.category : categories[0].name);
  const [date, setDate] = useState(initial ? initial.date : todayISO());
  const [note, setNote] = useState(initial ? initial.note || "" : "");
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(initial ? initial.paymentMethod || "" : "");
  const [addingCustomPayment, setAddingCustomPayment] = useState(false);
  const [customPaymentName, setCustomPaymentName] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreviewName, setReceiptPreviewName] = useState("");
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [err, setErr] = useState("");

  const handleReceiptChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return setErr("That photo is too large — please pick one under 8MB.");
    setReceiptFile(file);
    setReceiptPreviewName(file.name);
    setRemoveReceipt(false);
  };

  const submit = (e) => {
    e?.preventDefault?.();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setErr("Enter an amount greater than zero.");
    if (!date) return setErr("Pick a date.");
    const finalCategory = addingCustom ? customName.trim() : category;
    if (!finalCategory) return setErr("Name the new category.");
    const finalPaymentMethod = addingCustomPayment ? customPaymentName.trim() : paymentMethod;
    onSave({
      amount: amt,
      category: finalCategory,
      date,
      note: note.trim(),
      newCategory: addingCustom ? finalCategory : null,
      paymentMethod: finalPaymentMethod,
      newPaymentMethod: addingCustomPayment && finalPaymentMethod ? finalPaymentMethod : null,
      receiptFile,
      removeReceipt,
    });
  };

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>
            {initial ? "Edit expense" : "Log an expense"}
          </h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onCancel}><X size={18} /></button>
        </div>

        <label style={styles.label}>Amount</label>
        <div style={styles.amountWrap}>
          <DirhamSymbol size={16} color={T.ink} style={{ opacity: 0.6 }} />
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submit(e)}
            style={styles.amountInput}
            placeholder="0.00"
          />
        </div>

        <label style={styles.label}>Category</label>
        {!addingCustom ? (
          <div style={{ display: "flex", gap: 8 }}>
            <select style={styles.select} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            {isOnline && (
              <button type="button" style={styles.secondaryBtnSmall} onClick={() => setAddingCustom(true)}>
                + New
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              style={styles.textInput}
              placeholder="New category name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(e)}
              maxLength={24}
            />
            <button type="button" style={styles.secondaryBtnSmall} onClick={() => setAddingCustom(false)}>
              cancel
            </button>
          </div>
        )}

        <label style={styles.label}>Date</label>
        <input type="date" style={styles.textInput} value={date} onChange={(e) => setDate(e.target.value)} />

        <label style={styles.label}>Note (optional)</label>
        <input
          style={styles.textInput}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(e)}
          placeholder="e.g. groceries at market"
          maxLength={60}
        />

        <label style={styles.label}>Mode of payment (optional)</label>
        {!addingCustomPayment ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={styles.paymentIconBadge}>
              {React.createElement(paymentMethodIcon(paymentMethod), { size: 15, color: T.ink })}
            </span>
            <select style={{ ...styles.select, flex: 1 }} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">Skip — don't specify</option>
              {paymentMethods.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            {isOnline && (
              <button type="button" style={styles.secondaryBtnSmall} onClick={() => setAddingCustomPayment(true)}>
                + New
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              style={styles.textInput}
              placeholder="e.g. Amex, PayPal"
              value={customPaymentName}
              onChange={(e) => setCustomPaymentName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(e)}
              maxLength={24}
            />
            <button type="button" style={styles.secondaryBtnSmall} onClick={() => setAddingCustomPayment(false)}>
              cancel
            </button>
          </div>
        )}
        <p style={{ fontSize: 11.5, opacity: 0.55, marginTop: 4, marginBottom: 0 }}>
          A nickname only — please don't enter card numbers, expiry dates, or CVVs.
        </p>

        {isOnline ? (
          <>
            <label style={styles.label}>Receipt photo (optional)</label>
            {initial?.receiptPath && !removeReceipt && !receiptFile ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...styles.settingsReadonlyField, flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                  <Camera size={14} /> Photo attached
                </span>
                <button type="button" style={styles.secondaryBtnSmall} onClick={() => setRemoveReceipt(true)}>Remove</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ ...styles.secondaryBtnSmall, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <Camera size={14} />
                  {receiptPreviewName ? receiptPreviewName.slice(0, 22) : "Add a photo"}
                  <input type="file" accept="image/*" onChange={handleReceiptChange} style={{ display: "none" }} />
                </label>
                {receiptFile && (
                  <button type="button" style={styles.secondaryBtnSmall} onClick={() => { setReceiptFile(null); setReceiptPreviewName(""); }}>
                    Cancel
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 12.5, opacity: 0.6 }}>
            <WifiOff size={13} />
            {isEditing ? "Editing needs an internet connection." : "Receipt photos need an internet connection — this expense will still save, without a photo."}
          </div>
        )}

        {err && <p style={styles.errorText}>{err}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            style={{ ...styles.primaryBtn, flex: 1, ...(isEditing && !isOnline ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}
            disabled={isEditing && !isOnline}
            onClick={submit}
          >
            <Check size={16} /> {initial ? "Save changes" : "Add to ledger"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   INCOME FORM
================================================================= */
function IncomeForm({ onCancel, onSave }) {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState(SUGGESTED_INCOME_SOURCES[0]);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customSource, setCustomSource] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [repeatMonthly, setRepeatMonthly] = useState(SUGGESTED_INCOME_SOURCES[0] === "Salary");
  const [err, setErr] = useState("");

  // Salary is the one source that's overwhelmingly recurring in practice —
  // defaulting to "repeat monthly" for it (and only it) means most people
  // never have to think about this, while still being able to uncheck it
  // for a one-off case. Switching away from Salary resets the default so
  // it doesn't stick around unexpectedly for a source that isn't recurring.
  useEffect(() => {
    if (!addingCustom) setRepeatMonthly(source === "Salary");
  }, [source, addingCustom]);

  const submit = (e) => {
    e?.preventDefault?.();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setErr("Enter an amount greater than zero.");
    if (!date) return setErr("Pick a date.");
    const finalSource = addingCustom ? customSource.trim() : source;
    if (!finalSource) return setErr("Name the income source.");
    const dayOfMonth = new Date(date + "T00:00:00").getDate();
    onSave({ amount: amt, source: finalSource, date, note: note.trim(), repeatMonthly, dayOfMonth });
  };

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Log income</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onCancel}><X size={18} /></button>
        </div>

        <label style={styles.label}>Amount</label>
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          style={styles.textInput}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />

        <label style={styles.label}>Source</label>
        {!addingCustom ? (
          <div style={{ display: "flex", gap: 8 }}>
            <select style={styles.select} value={source} onChange={(e) => setSource(e.target.value)}>
              {SUGGESTED_INCOME_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" style={styles.secondaryBtnSmall} onClick={() => setAddingCustom(true)}>+ New</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              style={styles.textInput}
              value={customSource}
              onChange={(e) => setCustomSource(e.target.value)}
              placeholder="e.g. Rental income"
              maxLength={24}
            />
            <button type="button" style={styles.secondaryBtnSmall} onClick={() => setAddingCustom(false)}>Cancel</button>
          </div>
        )}

        <label style={styles.label}>Date</label>
        <input type="date" style={styles.textInput} value={date} onChange={(e) => setDate(e.target.value)} />

        <label style={styles.label}>Note (optional)</label>
        <input
          style={styles.textInput}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(e)}
          placeholder="e.g. August paycheck"
          maxLength={60}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={repeatMonthly}
            onChange={(e) => setRepeatMonthly(e.target.checked)}
            style={{ width: 16, height: 16, flexShrink: 0 }}
          />
          <span style={{ fontSize: 13 }}>Repeat this every month</span>
        </label>

        {err && <p style={styles.errorText}>{err}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button type="button" style={styles.textBtn} onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-lift" style={{ ...styles.primaryBtn, flex: 1 }} onClick={submit}>
            <Check size={16} /> Add to ledger
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SAVINGS FORM
================================================================= */
function SavingsForm({ mode, currentBalance, onCancel, onSave }) {
  const isWithdraw = mode === "withdraw";
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e?.preventDefault?.();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setErr("Enter an amount greater than zero.");
    if (!date) return setErr("Pick a date.");
    if (isWithdraw && amt > currentBalance) {
      return setErr(`You've only got ${fmtNumber(currentBalance)} saved — enter an amount up to that.`);
    }
    onSave({ amount: isWithdraw ? -amt : amt, date, note: note.trim() });
  };

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>{isWithdraw ? "Take from savings" : "Log savings"}</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onCancel}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 4 }}>
          {isWithdraw
            ? "This reduces your savings balance and adds the amount back to this month's Net, as available cash."
            : "Counted against your available cash alongside expenses — this reduces Net, since it's money that's no longer free to spend."}
        </p>

        <label style={styles.label}>Amount</label>
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          style={styles.textInput}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />

        <label style={styles.label}>Date</label>
        <input type="date" style={styles.textInput} value={date} onChange={(e) => setDate(e.target.value)} />

        <label style={styles.label}>Note (optional)</label>
        <input
          style={styles.textInput}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(e)}
          placeholder={isWithdraw ? "e.g. Car repair" : "e.g. Emergency fund"}
          maxLength={60}
        />

        {err && <p style={styles.errorText}>{err}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button type="button" style={styles.textBtn} onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-lift" style={{ ...styles.primaryBtn, flex: 1 }} onClick={submit}>
            <Check size={16} /> {isWithdraw ? "Take out" : "Add to ledger"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   RECURRING EXPENSES
================================================================= */
function RecurringModal({ categories, paymentMethods, templates, onAdd, onDelete, incomeTemplates, onAddIncome, onDeleteIncome, onClose }) {
  const [tab, setTab] = useState("expense"); // expense | income
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState(categories[0]?.name || "");
  const [source, setSource] = useState(SUGGESTED_INCOME_SOURCES[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isIncome = tab === "income";
  const activeTemplates = isIncome ? incomeTemplates : templates;

  const handleAdd = async (e) => {
    e?.preventDefault?.();
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter an amount greater than zero.");
    const day = parseInt(dayOfMonth, 10);
    if (!day || day < 1 || day > 31) return setError("Day of month must be between 1 and 31.");
    setBusy(true);
    try {
      if (isIncome) {
        await onAddIncome({ source, amount: amt, note: note.trim(), dayOfMonth: day });
      } else {
        await onAdd({ category, amount: amt, note: note.trim(), paymentMethod, dayOfMonth: day });
      }
      setAmount(""); setNote(""); setCreating(false);
    } catch (err) {
      setError(err?.message || `Couldn't add that recurring ${isIncome ? "income" : "expense"}. Please try again.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Recurring</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" style={{ ...styles.chip, borderColor: tab === "expense" ? T.gold : "transparent" }} onClick={() => { setTab("expense"); setCreating(false); setError(""); }}>
            Expenses
          </button>
          <button type="button" style={{ ...styles.chip, borderColor: tab === "income" ? T.gold : "transparent" }} onClick={() => { setTab("income"); setCreating(false); setError(""); }}>
            Income
          </button>
        </div>

        <p style={{ fontSize: 13, opacity: 0.65, marginTop: 10 }}>
          Added automatically once a month, the first time anyone opens this ledger after the month starts.
        </p>

        {activeTemplates.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {activeTemplates.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Repeat size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{isIncome ? t.source : t.category}</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    Day {t.dayOfMonth}{t.note ? ` · ${t.note}` : ""}
                  </div>
                </div>
                <Money amount={t.amount} size={13.5} />
                <button className="row-icon-hover" style={styles.rowIconBtn} onClick={() => (isIncome ? onDeleteIncome(t.id) : onDelete(t.id))} title="Remove">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!creating ? (
          <button type="button" className="btn-lift" style={{ ...styles.secondaryBtn, marginTop: 14 }} onClick={() => setCreating(true)}>
            <Plus size={16} /> New recurring {isIncome ? "income" : "expense"}
          </button>
        ) : (
          <div style={{ marginTop: 14 }}>
            {isIncome ? (
              <>
                <label style={styles.label}>Source</label>
                <select style={styles.select} value={source} onChange={(e) => setSource(e.target.value)}>
                  {SUGGESTED_INCOME_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </>
            ) : (
              <>
                <label style={styles.label}>Category</label>
                <select style={styles.select} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </>
            )}

            <label style={styles.label}>Amount</label>
            <input
              type="number"
              inputMode="decimal"
              style={styles.textInput}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />

            <label style={styles.label}>Day of month</label>
            <input
              type="number"
              min="1"
              max="31"
              style={styles.textInput}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
            />

            {!isIncome && (
              <>
                <label style={styles.label}>Payment method (optional)</label>
                <select style={styles.select} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="">Skip — don't specify</option>
                  {paymentMethods.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </>
            )}

            <label style={styles.label}>Note (optional)</label>
            <input
              style={styles.textInput}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd(e)}
              placeholder={isIncome ? "e.g. Monthly paycheck" : "e.g. Rent"}
              maxLength={60}
            />

            {error && <p style={styles.errorText}>{error}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" style={styles.textBtn} onClick={() => { setCreating(false); setError(""); }}>Cancel</button>
              <button type="button" className="btn-lift" style={{ ...styles.primaryBtn, flex: 1 }} disabled={busy} onClick={handleAdd}>
                {busy ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   CSV BANK IMPORT
================================================================= */
function parseCsvDate(raw, format) {
  const s = String(raw ?? "").trim();
  const match = s.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/);
  if (!match) return null;
  let y, m, d;
  if (format === "YYYY-MM-DD") { [, y, m, d] = match; }
  else if (format === "MM/DD/YYYY") { [, m, d, y] = match; }
  else { [, d, m, y] = match; } // DD/MM/YYYY
  y = y.length === 2 ? `20${y}` : y;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt.getTime()) || dt.getFullYear() < 1970) return null;
  return iso;
}

function parseCsvAmount(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  let s = String(raw).trim();
  const negParens = /^\(.*\)$/.test(s);
  s = s.replace(/[,$£€\s()]/g, "");
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negParens ? -Math.abs(n) : n;
}

function CsvImportModal({ categories, onImport, onClose }) {
  const [rawRows, setRawRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [fileName, setFileName] = useState("");
  const [dateCol, setDateCol] = useState("");
  const [descCol, setDescCol] = useState("");
  const [amountMode, setAmountMode] = useState("single"); // single | split
  const [amountCol, setAmountCol] = useState("");
  const [debitCol, setDebitCol] = useState("");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [category, setCategory] = useState(categories[0]?.name || "Imported");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(""); setResult(null);
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.data || res.data.length === 0) {
          setError("Couldn't find any rows in that file.");
          return;
        }
        setHeaders(res.meta.fields || []);
        setRawRows(res.data);
        // Best-effort guesses so the mapping is usually already right.
        const fields = res.meta.fields || [];
        const guess = (candidates) => fields.find((f) => candidates.some((c) => f.toLowerCase().includes(c)));
        setDateCol(guess(["date"]) || fields[0] || "");
        setDescCol(guess(["description", "desc", "memo", "narrative", "details"]) || fields[1] || "");
        setAmountCol(guess(["amount"]) || "");
        setDebitCol(guess(["debit", "withdrawal"]) || "");
      },
      error: () => setError("Couldn't read that file — make sure it's a plain CSV export."),
    });
  };

  const parsedRows = useMemo(() => {
    if (!rawRows || !dateCol) return [];
    return rawRows.map((row) => {
      const date = parseCsvDate(row[dateCol], dateFormat);
      let amount = null;
      if (amountMode === "single") {
        const v = parseCsvAmount(row[amountCol]);
        // Most bank exports use negative for money out — only expenses are
        // imported here (positive/credit rows are skipped, since importing
        // them as income would need its own mapping step this keeps simple).
        if (v != null && v < 0) amount = Math.abs(v);
      } else {
        const v = parseCsvAmount(row[debitCol]);
        if (v != null && v > 0) amount = v;
      }
      const note = descCol ? String(row[descCol] ?? "").trim().slice(0, 60) : "";
      return { date, note, amount, category, valid: !!date && amount != null && amount > 0 };
    });
  }, [rawRows, dateCol, descCol, amountMode, amountCol, debitCol, dateFormat, category]);

  const validCount = parsedRows.filter((r) => r.valid).length;
  const skippedCount = parsedRows.length - validCount;

  const handleImport = async () => {
    setError("");
    if (validCount === 0) return setError("No valid rows to import — check the column mapping.");
    setBusy(true);
    try {
      const rows = parsedRows.filter((r) => r.valid).map(({ date, note, amount, category: c }) => ({ date, note, amount, category: c }));
      const res = await onImport(rows);
      setResult(res);
    } catch (err) {
      setError(err?.message || "Import failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalCard, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Import from CSV</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onClose}><X size={18} /></button>
        </div>

        {result ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p style={{ fontSize: 14 }}>
              Imported {result.imported} expense{result.imported === 1 ? "" : "s"}
              {result.failed > 0 ? `, ${result.failed} failed` : ""}.
            </p>
            <button type="button" className="btn-lift" style={styles.primaryBtn} onClick={onClose}>Done</button>
          </div>
        ) : !rawRows ? (
          <div>
            <p style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>
              Upload a CSV export from your bank (not a PDF statement — most banks offer a CSV option under "export transactions").
              Only the date, description, and amount are read — nothing else in the file is stored, and the file itself never leaves your browser.
            </p>
            <label style={{ ...styles.secondaryBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", marginTop: 14 }}>
              <Upload size={16} /> Choose CSV file
              <input type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: "none" }} />
            </label>
            {error && <p style={styles.errorText}>{error}</p>}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 12.5, opacity: 0.6, marginBottom: 10 }}>{fileName} · {rawRows.length} rows found</p>

            <label style={styles.label}>Date column</label>
            <select style={styles.select} value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
              {headers.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>

            <label style={styles.label}>Date format in file</label>
            <select style={styles.select} value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            </select>

            <label style={styles.label}>Description column</label>
            <select style={styles.select} value={descCol} onChange={(e) => setDescCol(e.target.value)}>
              <option value="">None</option>
              {headers.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>

            <label style={styles.label}>Amount</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button type="button" style={{ ...styles.chip, borderColor: amountMode === "single" ? T.gold : "transparent" }} onClick={() => setAmountMode("single")}>
                One signed column
              </button>
              <button type="button" style={{ ...styles.chip, borderColor: amountMode === "split" ? T.gold : "transparent" }} onClick={() => setAmountMode("split")}>
                Separate debit column
              </button>
            </div>
            {amountMode === "single" ? (
              <select style={styles.select} value={amountCol} onChange={(e) => setAmountCol(e.target.value)}>
                <option value="">Select column</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            ) : (
              <select style={styles.select} value={debitCol} onChange={(e) => setDebitCol(e.target.value)}>
                <option value="">Select column</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            )}
            {amountMode === "single" && (
              <p style={{ fontSize: 11.5, opacity: 0.55, marginTop: 4 }}>Negative values are imported as expenses; positive (credit) rows are skipped.</p>
            )}

            <label style={styles.label}>Category for imported expenses</label>
            <select style={styles.select} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              {!categories.some((c) => c.name === "Imported") && <option value="Imported">Imported (new)</option>}
            </select>

            <p style={{ fontSize: 13, marginTop: 14 }}>
              <strong>{validCount}</strong> row{validCount === 1 ? "" : "s"} ready to import
              {skippedCount > 0 ? `, ${skippedCount} skipped (no date/amount match)` : ""}.
            </p>

            {error && <p style={styles.errorText}>{error}</p>}

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button type="button" style={styles.textBtn} onClick={() => { setRawRows(null); setHeaders([]); setError(""); }}>
                ← choose a different file
              </button>
              <button type="button" className="btn-lift" style={{ ...styles.primaryBtn, flex: 1, marginTop: 0 }} disabled={busy || validCount === 0} onClick={handleImport}>
                {busy ? "Importing…" : `Import ${validCount}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   BUDGET FORM
================================================================= */
function BudgetForm({ categories, budgets, onCancel, onSave }) {
  const [overall, setOverall] = useState(budgets.overall != null ? String(budgets.overall) : "");
  const [catValues, setCatValues] = useState(() => {
    const init = {};
    categories.forEach((c) => {
      init[c.name] = budgets.categories?.[c.name] != null ? String(budgets.categories[c.name]) : "";
    });
    return init;
  });

  const setCatValue = (name, val) => {
    setCatValues((prev) => ({ ...prev, [name]: val.replace(/[^0-9.]/g, "") }));
  };

  const submit = () => {
    const parsedCats = {};
    Object.entries(catValues).forEach(([name, val]) => {
      const n = parseFloat(val);
      if (n > 0) parsedCats[name] = n;
    });
    const overallNum = parseFloat(overall);
    onSave({ overall: overallNum > 0 ? overallNum : null, categories: parsedCats });
  };

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Set budgets</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onCancel}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>
          Set a monthly cap overall and per category. Leave blank for no limit.
        </p>

        <label style={styles.label}>Overall monthly budget</label>
        <div style={styles.amountWrap}>
          <DirhamSymbol size={16} color={T.ink} style={{ opacity: 0.6 }} />
          <input
            inputMode="decimal"
            value={overall}
            onChange={(e) => setOverall(e.target.value.replace(/[^0-9.]/g, ""))}
            style={styles.amountInput}
            placeholder="no limit"
          />
        </div>

        <label style={styles.label}>Per category</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
          {categories.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, fontSize: 13.5 }}>{c.name}</span>
              <div style={{ ...styles.amountWrap, width: 120 }}>
                <DirhamSymbol size={16} color={T.ink} style={{ opacity: 0.6 }} />
                <input
                  inputMode="decimal"
                  value={catValues[c.name] || ""}
                  onChange={(e) => setCatValue(c.name, e.target.value)}
                  style={styles.amountInput}
                  placeholder="none"
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button type="button" style={{ ...styles.primaryBtn, flex: 1 }} onClick={submit}>
            <Check size={16} /> Save budgets
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   PAYMENT METHODS SETUP (suggested list, editable nicknames, skippable)
================================================================= */
function PaymentMethodsSetupModal({ existing, onSave, onSkip }) {
  const [rows, setRows] = useState(() => {
    if (existing && existing.length > 0) {
      return existing.map((name) => ({ enabled: true, name }));
    }
    return SUGGESTED_PAYMENT_METHODS.map((name) => ({ enabled: true, name }));
  });
  const [customName, setCustomName] = useState("");

  const toggleRow = (i) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, enabled: !r.enabled } : r)));
  };
  const renameRow = (i, name) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, name } : r)));
  };
  const removeRow = (i) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };
  const addCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    setRows((prev) => [...prev, { enabled: true, name: trimmed }]);
    setCustomName("");
  };

  const submit = () => {
    const names = rows.filter((r) => r.enabled && r.name.trim()).map((r) => r.name.trim());
    // De-dupe while keeping first occurrence's casing.
    const seen = new Set();
    const deduped = names.filter((n) => {
      const key = n.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    onSave(deduped);
  };

  return (
    <div style={styles.modalOverlay} onClick={onSkip}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>How do you usually pay?</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onSkip}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>
          Optional — pick the ones you use and rename them however you like (e.g. "Credit card 1" → "Amex").
          You can change these anytime, and skip this and every expense's payment method entirely if you'd rather not track it.
        </p>
        <p style={{ fontSize: 12.5, color: T.brick, marginTop: 4 }}>
          Please don't enter sensitive details here — no card numbers, expiry dates, or CVVs. A short nickname is all that's needed.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, maxHeight: 280, overflowY: "auto" }}>
          {rows.map((r, i) => {
            const Icon = paymentMethodIcon(r.name);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={r.enabled} onChange={() => toggleRow(i)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                <Icon size={15} style={{ opacity: r.enabled ? 0.7 : 0.3, flexShrink: 0 }} />
                <input
                  style={{ ...styles.textInput, margin: 0, flex: 1 }}
                  value={r.name}
                  onChange={(e) => renameRow(i, e.target.value)}
                  maxLength={24}
                  disabled={!r.enabled}
                />
                <button type="button" className="row-icon-hover" style={styles.rowIconBtn} onClick={() => removeRow(i)} title="Remove">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <label style={styles.label}>Add another</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...styles.textInput, flex: 1 }}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="e.g. PayPal"
            maxLength={24}
          />
          <button type="button" style={styles.secondaryBtnSmall} onClick={addCustom}>+ Add</button>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button type="button" style={styles.textBtn} onClick={onSkip}>Skip for now</button>
          <button type="button" style={{ ...styles.primaryBtn, flex: 1 }} onClick={submit}>
            <Check size={16} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   GETTING STARTED (one-time tips after first setup)
================================================================= */
function GettingStartedModal({ onClose, onOpenBudget, onOpenIncome }) {
  const tips = [
    {
      icon: TrendingUp,
      title: "Log income too, not just expenses",
      body: "The green \"Log an income\" button records money coming in — salary, freelance work, gifts, whatever — and can repeat automatically each month. The dashboard shows Spent, Income, Savings, and Net together once you have some logged.",
    },
    {
      icon: Target,
      title: "Set a budget for each category",
      body: "Tap the target icon to set an overall monthly budget and per-category limits. You'll get a heads-up, both in the app and as a browser notification, if you go over.",
    },
    {
      icon: BarChart3,
      title: "Check your trends over time",
      body: "The bar-chart icon shows the last 12 months of spending vs. income, so patterns are easy to spot instead of buried in a single month's view.",
    },
  ];

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>A few things worth knowing</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
          {tips.map((tip, i) => {
            const Icon = tip.icon;
            return (
              <div key={i} style={{ display: "flex", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: T.parchmentDim,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={17} color={T.ink} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{tip.title}</div>
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2, lineHeight: 1.4 }}>{tip.body}</div>
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 12, opacity: 0.55, marginTop: 18, marginBottom: 8 }}>
          Worth doing right now, if you have a minute:
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={{ ...styles.addBtnSecondary, flex: 1, padding: "11px" }} onClick={onOpenIncome}>
            <TrendingUp size={15} /> Log income
          </button>
          <button type="button" style={{ ...styles.secondaryBtn, flex: 1, marginTop: 0 }} onClick={onOpenBudget}>
            <Target size={15} /> Set budget
          </button>
        </div>

        <button type="button" className="btn-lift" style={{ ...styles.primaryBtn, marginTop: 10 }} onClick={onClose}>
          I'll do this later
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   SETTINGS (profile details + change password)
================================================================= */
function TwoFactorSection() {
  const [factors, setFactors] = useState(null); // null = loading
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadFactors = async () => {
    try {
      const { data, error: err } = await supabase.auth.mfa.listFactors();
      if (err) throw err;
      setFactors(data?.totp || []);
    } catch {
      setFactors([]);
    }
  };

  useEffect(() => { loadFactors(); }, []);

  const startEnroll = async () => {
    setError(""); setNotice(""); setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (err) throw err;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setEnrolling(true);
    } catch (err) {
      setError(err?.message || "Couldn't start setup. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (code.length !== 6) return setError("Enter the 6-digit code from your app.");
    setBusy(true);
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (verifyErr) throw verifyErr;
      setNotice("Two-factor authentication is on.");
      setEnrolling(false);
      setCode("");
      loadFactors();
    } catch (err) {
      setError(err?.message || "That code didn't match. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = async () => {
    // Clean up the unconfirmed factor so it doesn't linger half set-up.
    if (factorId) { try { await supabase.auth.mfa.unenroll({ factorId }); } catch { /* best effort */ } }
    setEnrolling(false); setQrCode(""); setSecret(""); setFactorId(""); setCode(""); setError("");
  };

  const removeFactor = async (id) => {
    setError(""); setNotice(""); setBusy(true);
    try {
      const { error: err } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (err) throw err;
      setNotice("Two-factor authentication is off.");
      loadFactors();
    } catch (err) {
      setError(err?.message || "Couldn't remove it. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22, marginBottom: 4 }}>
        <ShieldCheck size={15} style={{ opacity: 0.6 }} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>Two-factor authentication</span>
      </div>

      {factors === null ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>Loading…</p>
      ) : enrolling ? (
        <div>
          <p style={{ fontSize: 13, opacity: 0.65 }}>
            Scan this with an authenticator app (Google Authenticator, Authy, etc), then enter the 6-digit code it shows.
          </p>
          {qrCode && (
            <img src={qrCode} alt="Scan this QR code with your authenticator app" style={{ width: 160, height: 160, display: "block", margin: "10px auto" }} />
          )}
          <p style={{ fontSize: 11.5, opacity: 0.55, textAlign: "center", wordBreak: "break-all" }}>
            Or enter this key manually: {secret}
          </p>
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && confirmEnroll(e)}
            style={styles.pinInput}
            placeholder="••••••"
          />
          {error && <p style={styles.errorText}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button type="button" style={styles.textBtn} onClick={cancelEnroll}>Cancel</button>
            <button type="button" className="btn-lift" style={{ ...styles.primaryBtn, flex: 1, marginTop: 0 }} disabled={busy} onClick={confirmEnroll}>
              {busy ? "Confirming…" : "Confirm"}
            </button>
          </div>
        </div>
      ) : factors.length > 0 ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
            <ShieldCheck size={14} style={{ color: T.sage }} />
            <span style={{ flex: 1 }}>Enabled</span>
            <button type="button" style={styles.secondaryBtnSmall} disabled={busy} onClick={() => removeFactor(factors[0].id)}>
              Turn off
            </button>
          </div>
          {notice && <p style={{ ...styles.errorText, color: T.sage }}>{notice}</p>}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, opacity: 0.65 }}>Add an extra step at sign-in using an authenticator app.</p>
          {error && <p style={styles.errorText}>{error}</p>}
          <button type="button" className="btn-lift" style={styles.secondaryBtn} disabled={busy} onClick={startEnroll}>
            <ShieldCheck size={16} /> Turn on two-factor authentication
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsModal({ userEmail, ledgerName, currency, onChangeCurrency, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const handleChangePassword = async (e) => {
    e?.preventDefault?.();
    setError(""); setNotice("");
    if (!currentPassword) return setError("Enter your current password.");
    if (newPassword.length < 6) return setError("New password needs to be at least 6 characters.");
    if (newPassword !== confirmPassword) return setError("New passwords don't match.");
    if (newPassword === currentPassword) return setError("New password must be different from your current one.");
    setBusy(true);
    try {
      // Supabase's updateUser doesn't ask for the current password itself —
      // re-verifying it here first is what actually confirms it's really
      // this person before changing anything.
      const { error: verifyErr } = await withTimeout(
        supabase.auth.signInWithPassword({ email: userEmail, password: currentPassword }), 8000
      );
      if (verifyErr) {
        setError("Current password is incorrect.");
        setBusy(false);
        return;
      }
      const { error: updateErr } = await withTimeout(supabase.auth.updateUser({ password: newPassword }), 8000);
      if (updateErr) throw updateErr;
      setNotice("Password updated.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setError(err?.message || "Couldn't update your password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Account settings</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onClose}><X size={18} /></button>
        </div>

        <label style={styles.label}>Email</label>
        <div style={styles.settingsReadonlyField}>{userEmail || "—"}</div>

        <label style={styles.label}>Current ledger</label>
        <div style={styles.settingsReadonlyField}>{ledgerName}</div>

        <label style={styles.label}>Currency</label>
        <select style={styles.select} value={currency} onChange={(e) => onChangeCurrency(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
        </select>

        <TwoFactorSection />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22, marginBottom: 4 }}>
          <KeyRound size={15} style={{ opacity: 0.6 }} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Change password</span>
        </div>

        <label style={styles.label}>Current password</label>
        <input
          type="password"
          style={styles.textInput}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="••••••••"
        />
        <label style={styles.label}>New password</label>
        <input
          type="password"
          style={styles.textInput}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 6 characters"
        />
        <label style={styles.label}>Retype new password</label>
        <input
          type="password"
          style={styles.textInput}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleChangePassword(e)}
          placeholder="Repeat new password"
        />

        {error && <p style={styles.errorText}>{error}</p>}
        {notice && <p style={{ ...styles.errorText, color: T.sage }}>{notice}</p>}

        <button type="button" className="btn-lift" style={styles.primaryBtn} disabled={busy} onClick={handleChangePassword}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   TRENDS (last 12 months)
================================================================= */
function TrendsModal({ data, currencySymbol, onClose }) {
  const hasAny = data.some((d) => d.spent > 0 || d.income > 0);
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalCard, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Spending trends</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onClose}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, opacity: 0.65, marginTop: 4, marginBottom: 12 }}>Last 12 months.</p>

        {!hasAny ? (
          <p style={{ fontSize: 13.5, opacity: 0.6, textAlign: "center", padding: "30px 0" }}>
            Not enough history yet — this fills in as you log expenses over time.
          </p>
        ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.parchmentDim} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: T.ink }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: T.ink }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => `${currencySymbol} ${fmtNumber(v)}`} contentStyle={{ background: T.ink, border: "none", borderRadius: 8, color: T.parchment, fontSize: 12.5 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="spent" name="Spent" fill={T.brick} radius={[3, 3, 0, 0]} />
                <Bar dataKey="income" name="Income" fill={T.sage} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   ACTIVITY LOG
================================================================= */
function ActivityLogModal({ ledgerId, onClose }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setEntries(await fetchActivityLog(ledgerId));
      } catch {
        setError("Couldn't load the activity log.");
        setEntries([]);
      }
    })();
  }, [ledgerId]);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Activity log</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onClose}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, opacity: 0.65, marginTop: 4, marginBottom: 12 }}>Most recent first, last 100 entries.</p>

        {error && <p style={styles.errorText}>{error}</p>}
        {entries === null ? (
          <p style={{ fontSize: 13.5, opacity: 0.6, textAlign: "center", padding: "20px 0" }}>Loading…</p>
        ) : entries.length === 0 ? (
          <p style={{ fontSize: 13.5, opacity: 0.6, textAlign: "center", padding: "20px 0" }}>Nothing logged yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
            {entries.map((e) => (
              <div key={e.id} style={{ fontSize: 13, borderBottom: `1px solid ${T.parchmentDim}`, paddingBottom: 8 }}>
                <div>
                  <strong>{e.displayName || "Someone"}</strong> {e.detail}
                </div>
                <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>
                  {new Date(e.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   LEDGER SWITCHER
================================================================= */
function LedgerSwitcherModal({ ledgerList, activeId, isOwner, onSwitch, onCreate, onDelete, onClose }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const activeLedger = (ledgerList || []).find((l) => l.id === activeId);

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    setError("");
    const trimmed = newName.trim();
    if (!trimmed) return setError("Name this ledger.");
    setBusy(true);
    try {
      await onCreate(trimmed);
    } catch (err) {
      setError(err?.message || "Couldn't create that ledger. Please try again.");
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError("");
    if (confirmText.trim() !== activeLedger?.name) {
      return setDeleteError("Type the ledger name exactly to confirm.");
    }
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      setDeleteError(err?.message || "Couldn't delete that ledger. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Your ledgers</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {(ledgerList || []).map((l) => (
            <button
              key={l.id}
              type="button"
              className="profile-row"
              style={{
                ...styles.profileRow,
                borderLeft: `3px solid ${l.id === activeId ? T.gold : "transparent"}`,
                cursor: l.id === activeId ? "default" : "pointer",
              }}
              onClick={() => l.id !== activeId && onSwitch(l.id)}
            >
              <span style={{ ...styles.profileAvatar, background: T.parchmentDim }}><BookMarked size={14} color={T.ink} /></span>
              <span style={{ fontWeight: 600 }}>{l.name}</span>
              {l.id === activeId && <Check size={14} style={{ marginLeft: "auto", opacity: 0.6 }} />}
            </button>
          ))}
        </div>

        {!creating ? (
          <button type="button" className="btn-lift" style={{ ...styles.secondaryBtn, marginTop: 14 }} onClick={() => setCreating(true)}>
            <Plus size={16} /> New ledger
          </button>
        ) : (
          <div style={{ marginTop: 14 }}>
            <label style={styles.label}>Name this ledger</label>
            <input
              autoFocus
              style={styles.textInput}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate(e)}
              placeholder="e.g. Household, Side business"
              maxLength={24}
            />
            {error && <p style={styles.errorText}>{error}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" style={styles.textBtn} onClick={() => { setCreating(false); setError(""); }}>Cancel</button>
              <button type="button" className="btn-lift" style={{ ...styles.primaryBtn, flex: 1 }} disabled={busy} onClick={handleCreate}>
                {busy ? "Creating…" : "Create & switch"}
              </button>
            </div>
          </div>
        )}

        {isOwner && activeLedger && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.parchmentDim}` }}>
            {!confirmingDelete ? (
              <button
                type="button"
                style={{ ...styles.textBtn, color: T.brick, display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 size={14} /> Delete "{activeLedger.name}"
              </button>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: T.brick, fontWeight: 600, marginBottom: 4 }}>
                  This permanently deletes every expense, income entry, budget, and receipt photo in
                  "{activeLedger.name}" — for every member, not just you. This can't be undone.
                </p>
                <label style={styles.label}>Type "{activeLedger.name}" to confirm</label>
                <input
                  style={styles.textInput}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={activeLedger.name}
                />
                {deleteError && <p style={styles.errorText}>{deleteError}</p>}
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button type="button" style={styles.textBtn} onClick={() => { setConfirmingDelete(false); setConfirmText(""); setDeleteError(""); }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-lift"
                    style={{ ...styles.primaryBtn, flex: 1, background: T.brick }}
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? "Deleting…" : "Delete permanently"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: 12, opacity: 0.55, marginTop: 14 }}>
          Each ledger keeps its own expenses, categories, budgets, and members — switching doesn't move or mix data between them.
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   MEMBERS / INVITES
================================================================= */
function MembersModal({ ledgerId, currentUserId, ledgerName, inviterName, onClose }) {
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, i] = await Promise.all([fetchMembers(ledgerId), fetchPendingInvites(ledgerId)]);
      setMembers(m);
      setInvites(i);
    } catch {
      setError("Couldn't load members. Try closing and reopening this.");
    }
  }, [ledgerId]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async (e) => {
    e?.preventDefault?.();
    setError(""); setNotice("");
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return setError("Enter a valid email address.");
    setBusy(true);
    try {
      await inviteMember(ledgerId, currentUserId, trimmed);
      setEmail("");
      // The invite itself is what actually grants access — this email is
      // just a courtesy notification. If it fails to send (Brevo not set
      // up, function not deployed, etc), the invite has still gone through
      // and will work the moment they sign up, so this failure is silent
      // rather than shown as an error.
      let emailSent = true;
      try {
        const { error: fnErr } = await supabase.functions.invoke("send-invite-email", {
          body: { to: trimmed, ledgerName, inviterName },
        });
        if (fnErr) emailSent = false;
      } catch {
        emailSent = false;
      }
      setNotice(
        emailSent
          ? `Invited ${trimmed} — they'll get an email, and join automatically once they sign up or sign in with that address.`
          : `Invited ${trimmed}. They'll join automatically once they sign up or sign in with that address — the notification email didn't send, so you may want to let them know directly.`
      );
      await load();
    } catch (err) {
      setError(err?.message || "Couldn't send that invite.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelInvite = async (id) => {
    try {
      await cancelInvite(id);
      await load();
    } catch {
      setError("Couldn't cancel that invite.");
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Ledger members</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onClose}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>
          Anyone you invite can see and add to this ledger once they sign in with that email.
        </p>

        <label style={styles.label}>Invite by email</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInvite(e)}
            style={{ ...styles.textInput, flex: 1 }}
            placeholder="someone@example.com"
          />
          <button type="button" className="btn-lift" style={{ ...styles.secondaryBtnSmall, display: "flex", alignItems: "center", gap: 6 }} disabled={busy} onClick={handleInvite}>
            <Mail size={14} /> Invite
          </button>
        </div>
        {error && <p style={styles.errorText}>{error}</p>}
        {notice && <p style={{ ...styles.errorText, color: T.sage }}>{notice}</p>}

        <label style={styles.label}>Members</label>
        {members === null ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {members.map((m) => (
              <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <span style={{ flex: 1 }}>
                  {m.display_name || "Member"}
                  {m.user_id === currentUserId && <span style={{ opacity: 0.5 }}> (you)</span>}
                </span>
                <span style={{ fontSize: 11.5, opacity: 0.55, textTransform: "uppercase", letterSpacing: 0.4 }}>{m.role}</span>
              </div>
            ))}
          </div>
        )}

        {invites && invites.length > 0 && (
          <>
            <label style={styles.label}>Pending invites</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {invites.map((inv) => (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                  <span style={{ flex: 1, opacity: 0.75 }}>{inv.email}</span>
                  <button type="button" className="row-icon-hover" style={styles.rowIconBtn} onClick={() => handleCancelInvite(inv.id)} title="Cancel invite">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   BUDGET ALERT
================================================================= */
function BudgetAlertModal({ alert, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalCard, maxWidth: 340, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%", background: `${T.brick}22`, color: T.brick,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
        }}>
          <AlertTriangle size={24} />
        </div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: "0 0 10px", color: T.brick }}>
          {alert.title}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
          {alert.lines.map((line, i) => (
            <p key={i} style={{ fontSize: 13.5, margin: 0, opacity: 0.85 }}>{line}</p>
          ))}
        </div>
        <button type="button" style={styles.primaryBtn} onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

/* ================================================================
   MONTH-END PROMPT (shown on the last day of the month, once)
================================================================= */
function MonthEndModal({ amount, monthName, onMoveToSavings, onCarryForward, onDismiss }) {
  return (
    <div style={styles.modalOverlay} onClick={onDismiss}>
      <div style={{ ...styles.modalCard, maxWidth: 380, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%", background: `${T.gold}22`, color: T.gold,
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
        }}>
          <PiggyBank size={22} />
        </div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, margin: "0 0 8px" }}>
          {monthName} is wrapping up
        </h2>
        <p style={{ fontSize: 14, margin: "0 0 18px", opacity: 0.8 }}>
          You've got <Money amount={amount} size={14} /> left over this month. What would you like to do with it?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" className="btn-lift" style={styles.primaryBtn} onClick={onMoveToSavings}>
            <PiggyBank size={16} /> Move it to savings
          </button>
          <button type="button" className="btn-lift" style={{ ...styles.secondaryBtn, marginTop: 0 }} onClick={onCarryForward}>
            <TrendingUp size={16} /> Carry it forward to next month
          </button>
        </div>
        <button type="button" style={{ ...styles.textBtn, marginTop: 14, width: "100%", textAlign: "center" }} onClick={onDismiss}>
          Decide later
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   CALENDAR (tap a day to see that day's expenses/income)
================================================================= */
function CalendarModal({ month, activity, selectedDate, onSelectDate, onClose }) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstWeekday = new Date(year, monthIdx, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayStr = todayISO();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateStrFor = (d) => `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalCard, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, margin: 0 }}>{MONTHS[monthIdx]} {year}</h2>
          <button type="button" style={styles.iconGhostBtnDark} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginTop: 12 }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, opacity: 0.5, padding: "4px 0" }}>{d}</div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`b${i}`} />;
            const dateStr = dateStrFor(d);
            const act = activity[dateStr];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelectDate(dateStr)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  aspectRatio: "1", borderRadius: 10, border: isToday ? `1.5px solid ${T.gold}` : "1.5px solid transparent",
                  background: isSelected ? T.gold : "transparent", color: isSelected ? T.ink : T.ink,
                  cursor: "pointer", padding: 2, position: "relative",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isToday || isSelected ? 700 : 500 }}>{d}</span>
                {act && (
                  <span style={{ display: "flex", gap: 2, marginTop: 2 }}>
                    {act.expense && <span style={{ width: 4, height: 4, borderRadius: "50%", background: isSelected ? T.ink : T.brick }} />}
                    {act.income && <span style={{ width: 4, height: 4, borderRadius: "50%", background: isSelected ? T.ink : T.sage }} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 14, fontSize: 11.5, opacity: 0.6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.brick, display: "inline-block" }} /> Expense
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.sage, display: "inline-block" }} /> Income
          </span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   STYLES
================================================================= */
const styles = {
  appShell: {
    minHeight: "100vh",
    width: "100%",
    maxWidth: "100vw",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    background: `repeating-linear-gradient(0deg, rgba(201,162,39,0) 0px, rgba(201,162,39,0) 23px, rgba(201,162,39,0.05) 24px), repeating-linear-gradient(90deg, rgba(201,162,39,0) 0px, rgba(201,162,39,0) 23px, rgba(201,162,39,0.05) 24px), radial-gradient(1200px 600px at 20% -10%, ${T.forestDeep}, ${T.forest})`,
    color: T.ink,
    fontFamily: "'Inter', sans-serif",
  },
  footer: {
    flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    padding: "18px 16px", fontSize: 12, color: T.parchment, opacity: 0.55,
    fontFamily: "'Inter', sans-serif",
  },
  footerLink: { color: T.parchment, opacity: 1, textDecoration: "underline" },
  footerDivider: { opacity: 0.5 },
  centerFill: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loginCardOuter: {
    position: "relative",
    width: "100%",
    maxWidth: 380,
  },
  loginCard: {
    background: T.parchment,
    borderRadius: 18,
    padding: "36px 28px 30px",
    width: "100%",
    boxShadow: `0 24px 70px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,162,39,0.15)`,
    position: "relative",
    overflow: "hidden",
  },
  loginCardAccent: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 5,
    background: `linear-gradient(90deg, ${T.sage}, ${T.gold}, ${T.brick})`,
  },
  brandMarkRing: {
    width: 62, height: 62, borderRadius: "50%",
    background: `linear-gradient(135deg, ${T.gold}, ${T.brick})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 14px",
    boxShadow: `0 10px 26px rgba(201,162,39,0.35)`,
  },
  brandMarkInner: {
    width: 52, height: 52, borderRadius: "50%",
    background: T.ink,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  printReport: {
    background: "#fff", color: "#111", padding: 24, fontFamily: "'Fraunces', serif",
  },
  printHeader: {
    display: "flex", alignItems: "baseline", justifyContent: "space-between",
    borderBottom: "2px solid #111", paddingBottom: 8, marginBottom: 8,
  },
  printTitle: { fontSize: 22, margin: 0 },
  printMeta: {
    display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7, marginBottom: 16,
  },
  printTotalRow: {
    display: "flex", justifyContent: "space-between", fontSize: 15,
    padding: "8px 0", borderBottom: "1px solid #ccc", marginBottom: 16,
  },
  printSectionTitle: { fontSize: 14, margin: "18px 0 8px", borderBottom: "1px solid #999", paddingBottom: 4 },
  printTable: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 },
  printTh: { textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #111", fontWeight: 600 },
  printTd: { padding: "4px 6px", borderBottom: "1px solid #eee" },
  printTdLabel: { padding: "3px 6px", borderBottom: "1px solid #eee" },
  printTdAmount: { padding: "3px 6px", borderBottom: "1px solid #eee", textAlign: "right" },
  wordDivider: {
    width: 44, height: 3, borderRadius: 2, margin: "10px auto 0",
    background: `linear-gradient(90deg, ${T.sage}, ${T.gold}, ${T.brick})`,
  },
  wordmark: { fontFamily: "'Fraunces', serif", fontSize: 30, margin: 0, color: T.ink, letterSpacing: 0.3 },
  wordmarkSmall: { fontFamily: "'Fraunces', serif", fontSize: 19, margin: 0, color: T.parchment },
  tagline: { margin: "4px 0 0", fontSize: 13, opacity: 0.55, fontStyle: "italic" },
  emptyNote: { textAlign: "center", opacity: 0.6, fontSize: 14, marginBottom: 16 },
  profileRow: {
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    padding: "12px 14px", borderRadius: 12, border: "none",
    background: T.parchmentDim, cursor: "pointer", fontSize: 14.5, color: T.ink,
    textAlign: "left",
  },
  profileAvatar: {
    width: 28, height: 28, borderRadius: "50%", background: T.forest, color: T.parchment,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, opacity: 0.65, margin: "14px 0 6px", textTransform: "uppercase", letterSpacing: 0.4 },
  textInput: {
    width: "100%", padding: "11px 13px", borderRadius: 10, border: `1px solid ${T.parchmentDim}`,
    background: "#fff", fontSize: 14.5, color: T.ink, boxSizing: "border-box", outline: "none",
  },
  settingsReadonlyField: {
    padding: "11px 13px", borderRadius: 10, background: T.parchmentDim,
    fontSize: 14.5, color: T.ink, opacity: 0.8,
  },
  pinInput: {
    width: "100%", padding: "14px", borderRadius: 10, border: `1px solid ${T.parchmentDim}`,
    background: "#fff", fontSize: 24, letterSpacing: 10, textAlign: "center",
    fontFamily: "'IBM Plex Mono', monospace", color: T.ink, boxSizing: "border-box", outline: "none",
  },
  select: {
    flex: 1, padding: "11px 13px", borderRadius: 10, border: `1px solid ${T.parchmentDim}`,
    background: "#fff", fontSize: 14.5, color: T.ink,
  },
  paymentIconBadge: {
    width: 36, height: 36, borderRadius: 10, background: T.parchmentDim,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  primaryBtn: {
    width: "100%", marginTop: 18, padding: "13px", borderRadius: 10, border: "none",
    background: T.ink, color: T.parchment, fontSize: 15, fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },
  secondaryBtn: {
    width: "100%", padding: "12px", borderRadius: 10, border: `1.5px dashed ${T.ink}55`,
    background: "transparent", color: T.ink, fontSize: 14, fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },
  secondaryBtnSmall: {
    padding: "0 14px", borderRadius: 10, border: `1px solid ${T.parchmentDim}`,
    background: T.parchmentDim, color: T.ink, fontSize: 13, cursor: "pointer",
  },
  demoBtn: {
    width: "100%", marginTop: 10, padding: "10px", borderRadius: 10, border: "none",
    background: "transparent", color: T.sage, fontSize: 13, fontWeight: 600, cursor: "pointer",
    textDecoration: "underline",
  },
  textBtn: {
    width: "100%", marginTop: 10, padding: "8px", border: "none", background: "transparent",
    color: T.ink, opacity: 0.55, fontSize: 13, cursor: "pointer",
  },
  errorText: { color: T.brick, fontSize: 13, marginTop: 8, textAlign: "center" },
  privacyNote: { fontSize: 11.5, opacity: 0.45, marginTop: 20, textAlign: "center", lineHeight: 1.5 },

  dashboardWrap: { maxWidth: 980, width: "100%", margin: "0 auto", padding: "22px 18px 60px", boxSizing: "border-box" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: 10, marginBottom: 20 },
  headerToolbar: {
    display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", rowGap: 8,
    background: "rgba(255,255,255,0.05)", padding: 6, borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.07)",
  },
  iconGhostBtn: {
    width: 34, height: 34, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.08)",
    color: T.parchment, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  },
  exportMenuBackdrop: { position: "fixed", inset: 0, zIndex: 40 },
  exportMenu: {
    position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41,
    background: T.parchment, borderRadius: 10, padding: 6, minWidth: 120,
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", gap: 2,
  },
  exportMenuItem: {
    display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 7,
    border: "none", background: "transparent", color: T.ink, fontSize: 13.5, fontWeight: 600,
    cursor: "pointer", textAlign: "left",
  },
  iconGhostBtnDark: {
    width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent",
    color: T.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: 0.7,
  },

  tapeOuter: { background: T.ink, borderRadius: 12, padding: "4px 0", marginBottom: 20, position: "relative" },
  tapePerfTop: { height: 6, background: `radial-gradient(circle, ${T.forest} 3px, transparent 3.2px)`, backgroundSize: "16px 12px", backgroundPosition: "0 -6px" },
  tapePerfBottom: { height: 6, background: `radial-gradient(circle, ${T.forest} 3px, transparent 3.2px)`, backgroundSize: "16px 12px", backgroundPosition: "0 0px" },
  tapeRow: { display: "flex", alignItems: "center" },
  tapeLabel: {
    display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
    padding: "10px 14px", background: T.brick, color: T.parchment,
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, fontWeight: 700,
    letterSpacing: 0.6, textTransform: "uppercase", borderRadius: "8px 0 0 8px",
  },
  tapeLiveDot: { width: 6, height: 6, borderRadius: "50%", background: T.parchment, animation: "pulseDot 1.6s ease-in-out infinite" },
  tapeScroll: {
    flex: 1, overflow: "hidden", padding: "10px 18px",
    fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.parchment,
  },
  tapeItem: { display: "inline-flex", alignItems: "center", gap: 7, opacity: 0.9, whiteSpace: "nowrap" },
  tapeDot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block" },

  errorBanner: {
    background: `${T.brick}22`, border: `1px solid ${T.brick}55`, color: T.parchment,
    padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16,
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
  },
  errorDismiss: { background: "none", border: "none", color: T.parchment, cursor: "pointer", opacity: 0.7 },
  undoToast: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    background: T.ink, color: T.parchment, padding: "10px 14px", borderRadius: 10,
    fontSize: 13, marginBottom: 16,
  },
  undoBtn: {
    display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.12)",
    border: "none", borderRadius: 8, color: T.parchment, padding: "6px 10px",
    fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0,
  },

  mainGrid: { display: "grid", gridTemplateColumns: "minmax(0,340px) minmax(0,1fr)", gap: 24 },
  leftCol: { display: "flex", flexDirection: "column", gap: 16 },
  rightCol: { display: "flex", flexDirection: "column", gap: 16, minWidth: 0 },

  card: { background: T.parchment, borderRadius: 18, padding: "20px 22px", color: T.ink, boxShadow: "0 6px 24px rgba(15,35,31,0.22)" },
  monthNav: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 12 },
  monthLabel: { fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, minWidth: 150, textAlign: "center" },
  totalRow: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 8, gap: 6 },
  totalNumber: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 36, fontWeight: 600, color: T.brick, letterSpacing: -0.5 },
  incomeSummaryRow: { display: "flex", gap: 20, marginTop: 8, fontSize: 13, paddingTop: 12, borderTop: `1px solid ${T.parchmentDim}`, width: "100%", justifyContent: "center" },
  incomeSummaryItem: { display: "flex", alignItems: "center", gap: 5 },
  statPill: {
    flex: "1 1 110px", minWidth: 90, borderRadius: 12, padding: "8px 10px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
  },
  statPillLabel: {
    display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: 0.3, opacity: 0.7,
  },
  statPillValue: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15 },
  progressTrack: { width: "100%", height: 7, borderRadius: 4, background: T.parchmentDim, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)" },
  progressFill: { height: "100%", borderRadius: 4, transition: "width 0.3s ease" },
  emptyRingWrap: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" },
  emptyRing: {
    width: 132, height: 132, borderRadius: "50%", border: `14px dashed ${T.parchmentDim}`,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  storageWarningBanner: {
    display: "flex", alignItems: "flex-start", gap: 8,
    background: T.brick, color: "#fff", fontSize: 12.5, lineHeight: 1.4,
    padding: "10px 16px", position: "sticky", top: 0, zIndex: 100,
  },
  legendRow: { display: "flex", alignItems: "center", gap: 9, padding: "3px 0" },
  legendDot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },

  addBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: T.gold, color: T.ink, border: "none", borderRadius: 14, padding: "15px",
    fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 18px rgba(201,162,39,0.35)",
  },
  addBtnSecondary: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: T.sage, color: "#fff", border: "none", borderRadius: 14, padding: "13px",
    fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 16px rgba(94,140,97,0.3)",
  },
  secondaryIconBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    background: T.parchment, color: T.ink, border: `1px solid ${T.parchmentDim}`, borderRadius: 14,
    padding: "11px 16px", cursor: "pointer", boxShadow: "0 2px 8px rgba(15,35,31,0.15)",
  },
  searchRow: {
    display: "flex", alignItems: "center", gap: 8, background: T.parchment,
    borderRadius: 12, padding: "10px 14px", marginBottom: 12, boxShadow: "0 2px 8px rgba(15,35,31,0.15)",
  },
  searchInput: {
    flex: 1, border: "none", background: "transparent", fontSize: 14, color: T.ink, outline: "none",
  },

  filterRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    padding: "7px 13px", borderRadius: 20, border: "1.5px solid transparent", fontSize: 12.5,
    cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", transition: "border-color 0.15s ease, background 0.15s ease",
  },
  chipClear: {
    padding: "7px 13px", borderRadius: 20, border: "none", background: "transparent",
    color: T.parchment, fontSize: 12.5, textDecoration: "underline", cursor: "pointer", opacity: 0.8,
  },

  listCard: { background: T.parchment, borderRadius: 18, overflow: "hidden", boxShadow: "0 6px 24px rgba(15,35,31,0.22)" },
  expenseRow: {
    display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
    borderBottom: `1px solid ${T.parchmentDim}`,
  },
  rowDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  rowAmount: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 14.5, marginRight: 4 },
  rowIconBtn: {
    width: 30, height: 30, border: "none", background: "transparent", color: T.ink, opacity: 0.55,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7,
    transition: "background 0.15s ease, opacity 0.15s ease",
  },

  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(15,35,31,0.6)", display: "flex",
    alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50,
  },
  modalCard: {
    background: T.parchment, borderRadius: 20, padding: "24px 26px", width: "100%", maxWidth: 400,
    maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  amountWrap: {
    display: "flex", alignItems: "center", gap: 6, border: `1px solid ${T.parchmentDim}`,
    borderRadius: 10, padding: "11px 13px", background: "#fff",
  },
  amountInput: {
    border: "none", outline: "none", fontSize: 20, fontFamily: "'IBM Plex Mono', monospace",
    width: "100%", background: "transparent", color: T.ink,
  },
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

* { box-sizing: border-box; }
html, body { margin: 0; overflow-x: hidden; max-width: 100%; }
body { margin: 0; }
input:focus, select:focus, button:focus-visible {
  outline: 2px solid ${T.gold};
  outline-offset: 1px;
}
button { font-family: inherit; }

.profile-row {
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.profile-row:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(0,0,0,0.18);
}
.btn-lift {
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
}
.btn-lift:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.06);
  box-shadow: 0 8px 20px rgba(0,0,0,0.22);
}
.row-hover {
  transition: background 0.15s ease;
}
.row-hover:hover {
  background: rgba(27,42,36,0.035);
}
.icon-btn-hover {
  transition: background 0.15s ease, transform 0.15s ease, opacity 0.15s ease;
}
.icon-btn-hover:hover {
  background: rgba(255,255,255,0.16) !important;
  transform: translateY(-1px);
}
.row-icon-hover {
  transition: background 0.15s ease, opacity 0.15s ease;
}
.row-icon-hover:hover {
  background: rgba(27,42,36,0.08);
  opacity: 0.9 !important;
}

@keyframes printIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 0.9; transform: translateY(0); }
}

@keyframes tickerScroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes pulseDot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.ticker-track {
  animation: tickerScroll 28s linear infinite;
}
.ticker-track:hover {
  animation-play-state: paused;
}

@media (max-width: 760px) {
  .main-grid { grid-template-columns: 1fr !important; }
}

@media (prefers-reduced-motion: reduce) {
  *:not(.ticker-track) { animation: none !important; transition: none !important; }
  .ticker-track { animation-duration: 60s !important; }
}

.print-only { display: none; }
@media print {
  body * { visibility: hidden; }
  .print-only, .print-only * { visibility: visible; }
  .print-only {
    display: block !important;
    position: absolute; left: 0; top: 0; width: 100%;
  }
}
`;
