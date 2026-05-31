export const INITIAL_TIME_LIMIT_SECONDS = 10;
export const EXPERT_TIME_LIMIT_SECONDS = 5;
export const EXPERT_TIME_START_SCORE = 10;

export function getQuestionTimeLimitSeconds(quiz) {
  return quiz.score >= EXPERT_TIME_START_SCORE
    ? EXPERT_TIME_LIMIT_SECONDS
    : INITIAL_TIME_LIMIT_SECONDS;
}
