/**
 * KDQT Quiz Master - Storage & Progress Management
 */

const STORAGE_KEYS = {
  BOOKMARKS: 'kdqt_bookmarks',
  WRONG_QUESTIONS: 'kdqt_wrong_questions',
  QUIZ_HISTORY: 'kdqt_quiz_history',
  THEME: 'kdqt_theme'
};

class StorageManager {
  // Theme Management
  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  }

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  // Bookmarks Management
  getBookmarks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS)) || [];
    } catch {
      return [];
    }
  }

  isBookmarked(questionId) {
    const list = this.getBookmarks();
    return list.includes(questionId);
  }

  toggleBookmark(questionId) {
    let list = this.getBookmarks();
    const index = list.indexOf(questionId);
    let bookmarked = false;
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(questionId);
      bookmarked = true;
    }
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(list));
    return bookmarked;
  }

  // Wrong Questions Log
  getWrongQuestions() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.WRONG_QUESTIONS)) || [];
    } catch {
      return [];
    }
  }

  recordWrongQuestion(question) {
    let list = this.getWrongQuestions();
    if (!list.some(q => q.id === question.id)) {
      list.push({
        id: question.id,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        timestamp: Date.now()
      });
      localStorage.setItem(STORAGE_KEYS.WRONG_QUESTIONS, JSON.stringify(list));
    }
  }

  removeWrongQuestion(questionId) {
    let list = this.getWrongQuestions();
    list = list.filter(q => q.id !== questionId);
    localStorage.setItem(STORAGE_KEYS.WRONG_QUESTIONS, JSON.stringify(list));
  }

  // Quiz History & Scoring
  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.QUIZ_HISTORY)) || [];
    } catch {
      return [];
    }
  }

  saveQuizResult(result) {
    const history = this.getHistory();
    history.unshift({
      quizId: result.quizId,
      quizTitle: result.quizTitle,
      mode: result.mode, // 'practice' or 'exam'
      total: result.total,
      correct: result.correct,
      scorePct: Math.round((result.correct / result.total) * 100),
      timeSpentSec: result.timeSpentSec || 0,
      timestamp: Date.now()
    });
    // Keep max 50 recent records
    if (history.length > 50) history.pop();
    localStorage.setItem(STORAGE_KEYS.QUIZ_HISTORY, JSON.stringify(history));
  }

  // Overall Statistics
  getOverallStats() {
    const history = this.getHistory();
    const bookmarks = this.getBookmarks();
    const wrongQs = this.getWrongQuestions();

    const quizzesCompleted = history.length;
    let totalQuestionsAttempted = 0;
    let totalCorrectAnswers = 0;

    history.forEach(h => {
      totalQuestionsAttempted += h.total;
      totalCorrectAnswers += h.correct;
    });

    const accuracy = totalQuestionsAttempted > 0 
      ? Math.round((totalCorrectAnswers / totalQuestionsAttempted) * 100) 
      : 0;

    return {
      quizzesCompleted,
      totalQuestionsAttempted,
      totalCorrectAnswers,
      accuracy,
      bookmarksCount: bookmarks.length,
      wrongQuestionsCount: wrongQs.length
    };
  }

  clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.BOOKMARKS);
    localStorage.removeItem(STORAGE_KEYS.WRONG_QUESTIONS);
    localStorage.removeItem(STORAGE_KEYS.QUIZ_HISTORY);
  }
}

export const storage = new StorageManager();
