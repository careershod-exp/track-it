import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------
   Thin data-access layer. Every function here does exactly one
   Supabase call and throws on failure — callers decide how to
   surface that (banner, retry, etc). Keeping this in one file means
   swapping backends later only touches this module, not the UI.

   Data model: a ledger can have multiple member accounts. Access is
   scoped by ledger_members rows, enforced by Row Level Security (see
   supabase-schema.sql) — a user can only touch a ledger or its
   expenses if they're a member.
------------------------------------------------------------------ */

export async function pingDatabase() {
  const { error } = await supabase.from("ledgers").select("id").limit(1);
  if (error) throw error;
  return true;
}

// Resolves which ledger this user should land in, in priority order:
//   1. Any ledger they've been invited to by email — claiming the invite
//      here means a brand-new user who was invited lands straight in the
//      shared ledger instead of getting an empty one of their own.
//   2. A ledger they're already a member of (earliest membership).
//   3. Otherwise, create a new ledger with them as its owner.
export async function ensureLedger(user) {
  const email = user.email;
  // The ledger's own name and the person's display name to other members
  // are two different things — a person's full name isn't a good ledger
  // title, so these are kept separate rather than reusing one value for
  // both.
  const personName = user.user_metadata?.full_name || user.user_metadata?.display_name || (email ? email.split("@")[0] : "Someone");

  if (email) {
    const { data: invites } = await supabase
      .from("ledger_invites")
      .select("id,ledger_id")
      .ilike("email", email);
    if (invites && invites.length > 0) {
      for (const invite of invites) {
        await supabase.from("ledger_members").insert({
          ledger_id: invite.ledger_id,
          user_id: user.id,
          display_name: personName,
          role: "member",
        }); // ignore errors here (e.g. already a member) — the delete below still cleans up the invite
        await supabase.from("ledger_invites").delete().eq("id", invite.id);
      }
    }
  }

  const { data: membership, error: memErr } = await supabase
    .from("ledger_members")
    .select("ledger_id, ledgers ( id, name, categories, budgets )")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (memErr) throw memErr;
  if (membership?.ledgers) {
    return membership.ledgers;
  }

  const name = user.user_metadata?.display_name || (email ? email.split("@")[0] : "My ledger");
  const { data: created, error: createErr } = await supabase
    .from("ledgers")
    .insert({ name, owner_id: user.id })
    .select("id,name,categories,budgets")
    .single();
  if (createErr) throw createErr;

  const { error: memberErr } = await supabase.from("ledger_members").insert({
    ledger_id: created.id,
    user_id: user.id,
    display_name: personName,
    role: "owner",
  });
  if (memberErr) throw memberErr;

  return created;
}

// Every ledger this user belongs to (owned or invited-into), for the ledger
// switcher. Ordered by when they joined, oldest first.
export async function fetchUserLedgers(userId) {
  const { data, error } = await supabase
    .from("ledger_members")
    .select("ledger_id, created_at, ledgers ( id, name )")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || [])
    .filter((row) => row.ledgers)
    .map((row) => ({ id: row.ledgers.id, name: row.ledgers.name }));
}

// Creates a brand-new ledger owned by this user and joins them to it —
// used by "+ New ledger" in the switcher, distinct from the automatic
// first-ledger creation in ensureLedger above.
export async function createLedger(userId, name, displayName) {
  const { data: created, error: createErr } = await supabase
    .from("ledgers")
    .insert({ name, owner_id: userId })
    .select("id,name")
    .single();
  if (createErr) throw createErr;

  const { error: memberErr } = await supabase.from("ledger_members").insert({
    ledger_id: created.id,
    user_id: userId,
    display_name: displayName,
    role: "owner",
  });
  if (memberErr) throw memberErr;

  return created;
}

export async function fetchLedgerData(ledgerId) {
  const { data, error } = await supabase
    .from("ledgers")
    .select("categories,budgets,payment_methods,currency")
    .eq("id", ledgerId)
    .single();
  if (error) throw error;
  return {
    categories: data?.categories || [],
    budgets: data?.budgets || { overall: null, categories: {} },
    paymentMethods: data?.payment_methods || [],
    currency: data?.currency || "AED",
  };
}

export async function saveCategoriesRemote(ledgerId, categories) {
  const { error } = await supabase.from("ledgers").update({ categories }).eq("id", ledgerId);
  if (error) throw error;
}

export async function saveBudgetsRemote(ledgerId, budgets) {
  const { error } = await supabase.from("ledgers").update({ budgets }).eq("id", ledgerId);
  if (error) throw error;
}

export async function savePaymentMethodsRemote(ledgerId, paymentMethods) {
  const { error } = await supabase.from("ledgers").update({ payment_methods: paymentMethods }).eq("id", ledgerId);
  if (error) throw error;
}

export async function fetchExpenses(ledgerId) {
  const { data, error } = await supabase
    .from("expenses")
    .select("id,date,category,note,amount,created_at,added_by,payment_method,receipt_path")
    .eq("ledger_id", ledgerId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    category: row.category,
    date: row.date,
    note: row.note || "",
    createdAt: new Date(row.created_at).getTime(),
    addedBy: row.added_by,
    paymentMethod: row.payment_method || "",
    receiptPath: row.receipt_path || "",
  }));
}

// Returns the DB-generated row (real id, server timestamp) so the caller can
// swap out its optimistic temp-id entry once this resolves.
export async function insertExpenseRemote(ledgerId, addedBy, expense) {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      ledger_id: ledgerId,
      added_by: addedBy,
      date: expense.date,
      category: expense.category,
      note: expense.note || null,
      amount: expense.amount,
      payment_method: expense.paymentMethod || null,
      receipt_path: expense.receiptPath || null,
    })
    .select("id,date,category,note,amount,created_at,added_by,payment_method,receipt_path")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    amount: Number(data.amount),
    category: data.category,
    date: data.date,
    note: data.note || "",
    createdAt: new Date(data.created_at).getTime(),
    addedBy: data.added_by,
    paymentMethod: data.payment_method || "",
    receiptPath: data.receipt_path || "",
  };
}

export async function updateExpenseRemote(expenseId, patch) {
  const { error } = await supabase
    .from("expenses")
    .update({
      date: patch.date,
      category: patch.category,
      note: patch.note || null,
      amount: patch.amount,
      payment_method: patch.paymentMethod || null,
      ...(patch.receiptPath !== undefined ? { receipt_path: patch.receiptPath || null } : {}),
    })
    .eq("id", expenseId);
  if (error) throw error;
}

export async function deleteExpenseRemote(expenseId) {
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) throw error;
}

export async function fetchMembers(ledgerId) {
  const { data, error } = await supabase
    .from("ledger_members")
    .select("user_id,display_name,role,created_at")
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchPendingInvites(ledgerId) {
  const { data, error } = await supabase
    .from("ledger_invites")
    .select("id,email,created_at")
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function inviteMember(ledgerId, invitedBy, email) {
  const { error } = await supabase.from("ledger_invites").insert({
    ledger_id: ledgerId,
    invited_by: invitedBy,
    email: email.trim().toLowerCase(),
  });
  if (error) {
    if (error.code === "23505") throw new Error("That person has already been invited.");
    throw error;
  }
}

export async function cancelInvite(inviteId) {
  const { error } = await supabase.from("ledger_invites").delete().eq("id", inviteId);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Income
------------------------------------------------------------------ */
export async function fetchIncome(ledgerId) {
  const { data, error } = await supabase
    .from("income")
    .select("id,date,source,note,amount,created_at,added_by")
    .eq("ledger_id", ledgerId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    source: row.source,
    date: row.date,
    note: row.note || "",
    createdAt: new Date(row.created_at).getTime(),
    addedBy: row.added_by,
  }));
}

export async function insertIncomeRemote(ledgerId, addedBy, entry) {
  const { data, error } = await supabase
    .from("income")
    .insert({
      ledger_id: ledgerId,
      added_by: addedBy,
      date: entry.date,
      source: entry.source,
      note: entry.note || null,
      amount: entry.amount,
    })
    .select("id,date,source,note,amount,created_at,added_by")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    amount: Number(data.amount),
    source: data.source,
    date: data.date,
    note: data.note || "",
    createdAt: new Date(data.created_at).getTime(),
    addedBy: data.added_by,
  };
}

export async function deleteIncomeRemote(incomeId) {
  const { error } = await supabase.from("income").delete().eq("id", incomeId);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Recurring expenses
------------------------------------------------------------------ */
export async function fetchRecurringExpenses(ledgerId) {
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select("id,category,note,amount,payment_method,day_of_month,last_generated_month")
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    category: row.category,
    note: row.note || "",
    amount: Number(row.amount),
    paymentMethod: row.payment_method || "",
    dayOfMonth: row.day_of_month,
    lastGeneratedMonth: row.last_generated_month,
  }));
}

export async function createRecurringExpense(ledgerId, createdBy, template) {
  const { data, error } = await supabase
    .from("recurring_expenses")
    .insert({
      ledger_id: ledgerId,
      created_by: createdBy,
      category: template.category,
      note: template.note || null,
      amount: template.amount,
      payment_method: template.paymentMethod || null,
      day_of_month: template.dayOfMonth,
    })
    .select("id,category,note,amount,payment_method,day_of_month,last_generated_month")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    category: data.category,
    note: data.note || "",
    amount: Number(data.amount),
    paymentMethod: data.payment_method || "",
    dayOfMonth: data.day_of_month,
    lastGeneratedMonth: data.last_generated_month,
  };
}

export async function deleteRecurringExpense(recurringId) {
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", recurringId);
  if (error) throw error;
}

export async function markRecurringGenerated(recurringId, monthStr) {
  const { error } = await supabase
    .from("recurring_expenses")
    .update({ last_generated_month: monthStr })
    .eq("id", recurringId);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Activity log
------------------------------------------------------------------ */
export async function logActivity(ledgerId, userId, displayName, detail) {
  // Best-effort — a failed log write should never block the action it's
  // describing, so callers fire this without awaiting/handling errors.
  const { error } = await supabase.from("activity_log").insert({
    ledger_id: ledgerId, user_id: userId, display_name: displayName, detail,
  });
  if (error) throw error;
}

export async function fetchActivityLog(ledgerId) {
  const { data, error } = await supabase
    .from("activity_log")
    .select("id,display_name,detail,created_at")
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    detail: row.detail,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

/* ---------------------------------------------------------------
   Currency
------------------------------------------------------------------ */
export async function saveCurrencyRemote(ledgerId, currencyCode) {
  const { error } = await supabase.from("ledgers").update({ currency: currencyCode }).eq("id", ledgerId);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Receipt photos
------------------------------------------------------------------ */
export async function uploadReceipt(ledgerId, expenseId, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${ledgerId}/${expenseId}-${Date.now().toString(36)}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function getReceiptUrl(path) {
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteReceipt(path) {
  const { error } = await supabase.storage.from("receipts").remove([path]);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Deleting a ledger (owner only — enforced by RLS, not just this check)
------------------------------------------------------------------ */
export async function deleteLedger(ledgerId) {
  const { error } = await supabase.from("ledgers").delete().eq("id", ledgerId);
  if (error) throw error;
}

export async function updateMemberDisplayName(ledgerId, userId, displayName) {
  const { error } = await supabase
    .from("ledger_members")
    .update({ display_name: displayName })
    .eq("ledger_id", ledgerId)
    .eq("user_id", userId);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Savings
------------------------------------------------------------------ */
export async function fetchSavings(ledgerId) {
  const { data, error } = await supabase
    .from("savings")
    .select("id,date,note,amount,created_at,added_by")
    .eq("ledger_id", ledgerId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    date: row.date,
    note: row.note || "",
    createdAt: new Date(row.created_at).getTime(),
    addedBy: row.added_by,
  }));
}

export async function insertSavingsRemote(ledgerId, addedBy, entry) {
  const { data, error } = await supabase
    .from("savings")
    .insert({
      ledger_id: ledgerId,
      added_by: addedBy,
      date: entry.date,
      note: entry.note || null,
      amount: entry.amount,
    })
    .select("id,date,note,amount,created_at,added_by")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    amount: Number(data.amount),
    date: data.date,
    note: data.note || "",
    createdAt: new Date(data.created_at).getTime(),
    addedBy: data.added_by,
  };
}

export async function deleteSavingsRemote(savingsId) {
  const { error } = await supabase.from("savings").delete().eq("id", savingsId);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Recurring income
------------------------------------------------------------------ */
export async function fetchRecurringIncome(ledgerId) {
  const { data, error } = await supabase
    .from("recurring_income")
    .select("id,source,note,amount,day_of_month,last_generated_month")
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    source: row.source,
    note: row.note || "",
    amount: Number(row.amount),
    dayOfMonth: row.day_of_month,
    lastGeneratedMonth: row.last_generated_month,
  }));
}

export async function createRecurringIncome(ledgerId, createdBy, template) {
  const { data, error } = await supabase
    .from("recurring_income")
    .insert({
      ledger_id: ledgerId,
      created_by: createdBy,
      source: template.source,
      note: template.note || null,
      amount: template.amount,
      day_of_month: template.dayOfMonth,
    })
    .select("id,source,note,amount,day_of_month,last_generated_month")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    source: data.source,
    note: data.note || "",
    amount: Number(data.amount),
    dayOfMonth: data.day_of_month,
    lastGeneratedMonth: data.last_generated_month,
  };
}

export async function deleteRecurringIncome(recurringId) {
  const { error } = await supabase.from("recurring_income").delete().eq("id", recurringId);
  if (error) throw error;
}

export async function markRecurringIncomeGenerated(recurringId, monthStr) {
  const { error } = await supabase
    .from("recurring_income")
    .update({ last_generated_month: monthStr })
    .eq("id", recurringId);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Card payment reminders
------------------------------------------------------------------ */
export async function fetchCardReminders(ledgerId) {
  const { data, error } = await supabase
    .from("card_reminders")
    .select("id,card_name,due_day,note,last_notified_month")
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    cardName: row.card_name,
    dueDay: row.due_day,
    note: row.note || "",
    lastNotifiedMonth: row.last_notified_month,
  }));
}

export async function createCardReminder(ledgerId, createdBy, reminder) {
  const { data, error } = await supabase
    .from("card_reminders")
    .insert({
      ledger_id: ledgerId,
      created_by: createdBy,
      card_name: reminder.cardName,
      due_day: reminder.dueDay,
      note: reminder.note || null,
    })
    .select("id,card_name,due_day,note,last_notified_month")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    cardName: data.card_name,
    dueDay: data.due_day,
    note: data.note || "",
    lastNotifiedMonth: data.last_notified_month,
  };
}

export async function deleteCardReminder(reminderId) {
  const { error } = await supabase.from("card_reminders").delete().eq("id", reminderId);
  if (error) throw error;
}

export async function markCardReminderNotified(reminderId, monthStr) {
  const { error } = await supabase
    .from("card_reminders")
    .update({ last_notified_month: monthStr })
    .eq("id", reminderId);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Notifications (bell icon) — shared per ledger, capped at 15
------------------------------------------------------------------ */
export async function fetchNotifications(ledgerId) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,message,type,read,created_at")
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    message: row.message,
    type: row.type,
    read: row.read,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function insertNotification(ledgerId, message, type = "card_due") {
  const { data, error } = await supabase
    .from("notifications")
    .insert({ ledger_id: ledgerId, message, type })
    .select("id,message,type,read,created_at")
    .single();
  if (error) throw error;
  // Enforce the 15-item cap — delete anything past the 15 most recent for
  // this ledger, so the list never grows without bound.
  const { data: overflow } = await supabase
    .from("notifications")
    .select("id")
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: false })
    .range(15, 999);
  if (overflow && overflow.length > 0) {
    await supabase.from("notifications").delete().in("id", overflow.map((r) => r.id));
  }
  return {
    id: data.id,
    message: data.message,
    type: data.type,
    read: data.read,
    createdAt: new Date(data.created_at).getTime(),
  };
}

export async function markNotificationsRead(ledgerId) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("ledger_id", ledgerId).eq("read", false);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Editing a savings entry
------------------------------------------------------------------ */
export async function updateSavingsRemote(savingsId, patch) {
  const { error } = await supabase
    .from("savings")
    .update({ date: patch.date, note: patch.note || null, amount: patch.amount })
    .eq("id", savingsId);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Loans (given or taken)
------------------------------------------------------------------ */
const LOAN_FIELDS = "id,loan_type,direction,person_or_lender,principal_amount,monthly_repayment,start_date,balance_override_amount,balance_override_date,include_in_net_balance,note,created_at";

function mapLoanRow(row) {
  return {
    id: row.id,
    loanType: row.loan_type,
    direction: row.direction,
    personOrLender: row.person_or_lender || "",
    principalAmount: row.principal_amount != null ? Number(row.principal_amount) : null,
    monthlyRepayment: row.monthly_repayment != null ? Number(row.monthly_repayment) : null,
    startDate: row.start_date,
    balanceOverrideAmount: row.balance_override_amount != null ? Number(row.balance_override_amount) : null,
    balanceOverrideDate: row.balance_override_date,
    includeInNetBalance: row.include_in_net_balance,
    note: row.note || "",
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function fetchLoans(ledgerId) {
  const { data, error } = await supabase
    .from("loans")
    .select(LOAN_FIELDS)
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapLoanRow);
}

export async function createLoan(ledgerId, createdBy, loan) {
  const { data, error } = await supabase
    .from("loans")
    .insert({
      ledger_id: ledgerId,
      created_by: createdBy,
      loan_type: loan.loanType,
      direction: loan.direction,
      person_or_lender: loan.personOrLender || null,
      principal_amount: loan.principalAmount || null,
      monthly_repayment: loan.monthlyRepayment || null,
      start_date: loan.startDate,
      include_in_net_balance: loan.includeInNetBalance,
      note: loan.note || null,
    })
    .select(LOAN_FIELDS)
    .single();
  if (error) throw error;
  return mapLoanRow(data);
}

export async function updateLoan(loanId, loan) {
  const { error } = await supabase
    .from("loans")
    .update({
      loan_type: loan.loanType,
      direction: loan.direction,
      person_or_lender: loan.personOrLender || null,
      principal_amount: loan.principalAmount || null,
      monthly_repayment: loan.monthlyRepayment || null,
      start_date: loan.startDate,
      include_in_net_balance: loan.includeInNetBalance,
      note: loan.note || null,
    })
    .eq("id", loanId);
  if (error) throw error;
}

// A standalone correction to what's actually still owed — for a missed
// payment, an early payoff, or any other real-world mismatch with the
// automatic monthly schedule. Doesn't touch the loan's other fields.
export async function updateLoanBalance(loanId, amount, date) {
  const { error } = await supabase
    .from("loans")
    .update({ balance_override_amount: amount, balance_override_date: date })
    .eq("id", loanId);
  if (error) throw error;
}

export async function deleteLoan(loanId) {
  const { error } = await supabase.from("loans").delete().eq("id", loanId);
  if (error) throw error;
}

/* ---------------------------------------------------------------
   Editing an income entry
------------------------------------------------------------------ */
export async function updateIncomeRemote(incomeId, patch) {
  const { error } = await supabase
    .from("income")
    .update({ date: patch.date, source: patch.source, note: patch.note || null, amount: patch.amount })
    .eq("id", incomeId);
  if (error) throw error;
}