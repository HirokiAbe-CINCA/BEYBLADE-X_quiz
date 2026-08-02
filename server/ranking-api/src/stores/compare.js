/** ランキング順: score降順 → date昇順（同点は先に登録した方が上位） */
export function compareScoreEntries(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return a.date.getTime() - b.date.getTime();
}
