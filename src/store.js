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

  if (email) {
    const { data: invites } = await supabase
      .from("ledger_invites")
      .select("id,ledger_id")
      .ilike("email", email);
    if (invites && invites.length > 0) {
      const displayName = user.user_metadata?.display_name || email.split("@")[0];
      for (const invite of invites) {
        await supabase.from("ledger_members").insert({
          ledger_id: invite.ledger_id,
          user_id: user.id,
          display_name: displayName,
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
    display_name: name,
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
