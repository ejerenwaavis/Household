import MonthWorkspace from '../models/MonthWorkspace.js';

function isValidMonth(value = '') {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value));
}

export function assertValidMonth(month) {
  if (!isValidMonth(month)) {
    throw new Error('Invalid month format. Expected YYYY-MM');
  }
}

export function getMonthRange(month) {
  assertValidMonth(month);
  const [year, monthNum] = String(month).split('-').map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function getMonthWorkspace(householdId, month) {
  assertValidMonth(month);
  return MonthWorkspace.findOne({ householdId, month }).lean();
}

export async function getMonthResetCutoff(householdId, month) {
  const workspace = await getMonthWorkspace(householdId, month);
  return workspace?.resetAt ? new Date(workspace.resetAt) : null;
}

export async function getMonthResetCutoffMap(householdId) {
  const docs = await MonthWorkspace.find({ householdId, resetAt: { $ne: null } })
    .select('month resetAt')
    .lean();

  return docs.reduce((map, doc) => {
    map[doc.month] = new Date(doc.resetAt);
    return map;
  }, {});
}

export function createdAtAfterReset(record, cutoff) {
  if (!cutoff) return true;
  const createdAt = record?.createdAt ? new Date(record.createdAt) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
  return createdAt >= cutoff;
}

export async function upsertMonthReset({ householdId, month, mode = 'hybrid', reason = '', resetBy = '', snapshot = {} }) {
  assertValidMonth(month);

  const resetAt = new Date();
  const historyEntry = {
    resetAt,
    mode,
    reason,
    resetBy,
    snapshot,
  };

  await MonthWorkspace.updateOne(
    { householdId, month },
    {
      $setOnInsert: {
        householdId,
        month,
        createdAt: resetAt,
      },
      $set: {
        mode,
        resetAt,
        lastResetBy: resetBy,
        lastResetReason: reason,
        updatedAt: resetAt,
      },
      $inc: { resetCount: 1 },
      $push: { resetHistory: historyEntry },
    },
    { upsert: true }
  );

  return MonthWorkspace.findOne({ householdId, month }).lean();
}
