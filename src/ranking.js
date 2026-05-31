export const LEADERBOARD_STORAGE_KEY = 'beyblade-x-quiz-ranking-v1';
export const MAX_LEADERBOARD_ENTRIES = 5;
export const MAX_NAME_LENGTH = 11;

export function getLeaderboard(storage = globalThis.localStorage) {
  if (!storage) {
    return [];
  }

  try {
    const parsed = JSON.parse(storage.getItem(LEADERBOARD_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeLeaderboard(parsed);
  } catch {
    return [];
  }
}

export function isFirstPlaceScore(score, leaderboard) {
  if (!Number.isInteger(score) || score <= 0) {
    return false;
  }

  return leaderboard.length === 0 || score >= leaderboard[0].score;
}

export function saveLeaderboardEntry(storage = globalThis.localStorage, entry) {
  if (!storage) {
    return [];
  }

  const leaderboard = normalizeLeaderboard([
    ...getLeaderboard(storage),
    {
      name: normalizeName(entry.name),
      score: entry.score,
      date: entry.date ?? new Date().toISOString(),
    },
  ]);

  storage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(leaderboard));
  return leaderboard;
}

function normalizeLeaderboard(entries) {
  return entries
    .map((entry) => ({
      name: normalizeName(entry.name),
      score: Number.isInteger(entry.score) ? entry.score : Number(entry.score),
      date: isValidDate(entry.date) ? entry.date : new Date().toISOString(),
    }))
    .filter((entry) => entry.name && Number.isInteger(entry.score) && entry.score >= 0)
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }
      return first.date.localeCompare(second.date);
    })
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

function normalizeName(name) {
  return String(name ?? '').trim().slice(0, MAX_NAME_LENGTH);
}

function isValidDate(date) {
  return typeof date === 'string' && !Number.isNaN(Date.parse(date));
}
