/**
 * KDQT Quiz Master - Main Application Controller
 */

import { storage } from './storage.js';
import { sound } from './audio.js';
import { quizEngine } from './quiz.js';

class AppController {
  constructor() {
    this.wordData = null;
    this.pdfData = null;
    this.tracNghiemData = null;
    this.allQuestions = [];
    this.activeTab = 'home'; // 'home', 'word', 'pdf', 'tracnghiem', 'quiz', 'bookmarks'
  }

  async init() {
    this.applyTheme();
    this.initSoundToggle();
    this.initDOM();
    await this.loadData();
    this.renderDashboard();
    this.renderWordPage();
    this.renderPDFPage();
    this.renderTracNghiemPage();
    this.bindGlobalEvents();
  }

  applyTheme() {
    const theme = storage.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  toggleTheme() {
    sound.playClick();
    const current = storage.getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    storage.setTheme(next);
    this.applyTheme();
  }

  initSoundToggle() {
    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) {
      soundBtn.textContent = sound.isMuted ? '🔇' : '🔊';
      soundBtn.addEventListener('click', () => {
        const isMuted = sound.toggleMute();
        soundBtn.textContent = isMuted ? '🔇' : '🔊';
        if (!isMuted) sound.playClick();
      });
    }
  }

  initDOM() {
    // Setup quizEngine DOM refs
    quizEngine.init({
      questionIndexTag: document.getElementById('quiz-q-index'),
      timerBadge: document.getElementById('quiz-timer-badge'),
      timerText: document.getElementById('quiz-timer-text'),
      questionText: document.getElementById('quiz-q-text'),
      optionsContainer: document.getElementById('quiz-options-list'),
      explanationBox: document.getElementById('quiz-explanation-box'),
      explanationText: document.getElementById('quiz-explanation-text'),
      btnPrev: document.getElementById('btn-quiz-prev'),
      btnNext: document.getElementById('btn-quiz-next'),
      btnSubmit: document.getElementById('btn-quiz-submit'),
      btnFlag: document.getElementById('btn-quiz-flag'),
      paletteGrid: document.getElementById('quiz-palette-grid'),
      
      // Mobile bottom bar elements
      mobileBtnPrev: document.getElementById('mobile-btn-prev'),
      mobileBtnNext: document.getElementById('mobile-btn-next'),
      mobileBtnFlag: document.getElementById('mobile-btn-flag'),
      mobileBtnSubmit: document.getElementById('mobile-btn-submit'),
      mobileBtnPalette: document.getElementById('mobile-btn-palette'),
      mobilePaletteDrawer: document.getElementById('mobile-palette-drawer'),
      mobilePaletteGrid: document.getElementById('mobile-palette-grid'),

      // Results modal
      resultsModal: document.getElementById('results-modal'),
      resScoreBig: document.getElementById('res-score-big'),
      resScoreSub: document.getElementById('res-score-sub'),
      resStatCorrect: document.getElementById('res-stat-correct'),
      resStatIncorrect: document.getElementById('res-stat-incorrect'),
      resStatTime: document.getElementById('res-stat-time'),
      btnReview: document.getElementById('btn-res-review'),
      btnRestart: document.getElementById('btn-res-restart'),
      btnRetryWrong: document.getElementById('btn-res-retry-wrong')
    });
  }

  async loadData() {
    try {
      const [resWord, resPdf, resTn] = await Promise.all([
        fetch('data/word_quizzes.json?v=20261021_v2'),
        fetch('data/pdf_quizzes.json?v=20261021_v2'),
        fetch('data/tracnghiem_quizzes.json?v=20261021_v2')
      ]);

      this.wordData = await resWord.json();
      this.pdfData = await resPdf.json();
      this.tracNghiemData = await resTn.json();

      // Collect all questions for global search
      this.allQuestions = [
        ...this.wordData.allQuestions.map(q => ({ ...q, source: 'Word (300 câu)' })),
        ...this.pdfData.quizzes.flatMap(qz => qz.questions.map(q => ({ ...q, source: `PDF (${qz.chapterTitle})` }))),
        ...this.tracNghiemData.allQuestions.map(q => ({ ...q, source: 'Trắc Nghiệm KDQT (48 câu)' }))
      ];

      console.log(`Loaded ${this.allQuestions.length} questions successfully across 3 sources!`);
    } catch (err) {
      console.error('Failed to load JSON data:', err);
    }
  }

  bindGlobalEvents() {
    // Theme toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', () => this.toggleTheme());

    // Navigation Tab Buttons
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        sound.playClick();
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Exit quiz button
    const exitQuizBtn = document.getElementById('btn-exit-quiz');
    if (exitQuizBtn) {
      exitQuizBtn.addEventListener('click', () => {
        sound.playClick();
        if (confirm('Bạn có chắc chắn muốn thoát bài quiz?')) {
          clearInterval(quizEngine.timerInterval);
          this.switchTab(this.previousTab || 'home');
        }
      });
    }

    // Global Search Modal
    const searchOpenBtn = document.getElementById('btn-search-open');
    const searchModal = document.getElementById('search-modal');
    const searchCloseBtn = document.getElementById('btn-search-close');
    const searchInput = document.getElementById('search-input');

    if (searchOpenBtn && searchModal) {
      searchOpenBtn.addEventListener('click', () => {
        sound.playClick();
        searchModal.classList.add('open');
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        this.performSearch('');
      });
    }

    if (searchCloseBtn && searchModal) {
      searchCloseBtn.addEventListener('click', () => {
        searchModal.classList.remove('open');
      });
      searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) searchModal.classList.remove('open');
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.performSearch(e.target.value.trim());
      });
    }

    // Modal close button for results
    const closeResBtn = document.getElementById('btn-close-results');
    if (closeResBtn) {
      closeResBtn.addEventListener('click', () => {
        document.getElementById('results-modal').classList.remove('open');
      });
    }
  }

  switchTab(tabName) {
    if (this.activeTab !== 'quiz') {
      this.previousTab = this.activeTab;
    }
    this.activeTab = tabName;

    // Update Tab Navigation Active State
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Hide all views
    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
    const quizPlayer = document.getElementById('view-quiz-player');
    if (quizPlayer) quizPlayer.classList.remove('active');

    // Show selected view
    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) targetView.classList.add('active');

    if (tabName === 'home') {
      this.renderDashboard();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderDashboard() {
    const stats = storage.getOverallStats();
    
    // Update stats counters
    const elAttempted = document.getElementById('stat-attempted');
    const elAccuracy = document.getElementById('stat-accuracy');
    const elBookmarks = document.getElementById('stat-bookmarks');
    const elCompleted = document.getElementById('stat-completed');

    if (elAttempted) elAttempted.textContent = stats.totalQuestionsAttempted;
    if (elAccuracy) elAccuracy.textContent = `${stats.accuracy}%`;
    if (elBookmarks) elBookmarks.textContent = stats.bookmarksCount;
    if (elCompleted) elCompleted.textContent = stats.quizzesCompleted;

    // Quick Practice Buttons on Dashboard
    const quickWordBtn = document.getElementById('btn-quick-word');
    if (quickWordBtn) {
      quickWordBtn.onclick = () => {
        sound.playClick();
        this.startQuizById(this.wordData.quizzes[0].id, 'practice');
      };
    }

    const quickTnBtn = document.getElementById('btn-quick-tracnghiem');
    if (quickTnBtn) {
      quickTnBtn.onclick = () => {
        sound.playClick();
        if (this.tracNghiemData?.quizzes?.length) {
          this.startQuizById(this.tracNghiemData.quizzes[0].id, 'practice');
        }
      };
    }

    const quickExamBtn = document.getElementById('btn-quick-exam');
    if (quickExamBtn) {
      quickExamBtn.onclick = () => {
        sound.playClick();
        // Generate a random 40-question exam from all questions
        const shuffled = [...this.allQuestions].sort(() => 0.5 - Math.random()).slice(0, 40);
        const randomExam = {
          id: 'exam_random_40',
          title: 'Đề Thi Thử Ngẫu Nhiên Toàn Diện (40 Câu)',
          questions: shuffled
        };
        this.openQuizPlayer(randomExam, 'exam', 40);
      };
    }
  }

  renderWordPage() {
    const container = document.getElementById('word-quizzes-grid');
    if (!container || !this.wordData) return;

    container.innerHTML = '';
    this.wordData.quizzes.forEach(quiz => {
      const card = document.createElement('div');
      card.className = 'quiz-card';
      card.innerHTML = `
        <div>
          <div class="quiz-card-header">
            <span class="quiz-tag">Word Bank</span>
            <span class="quiz-meta-item">📝 ${quiz.questionCount} câu</span>
          </div>
          <h3 class="quiz-card-title">${quiz.title}</h3>
          <p class="quiz-card-desc">${quiz.description}</p>
        </div>
        <div>
          <div class="quiz-card-actions">
            <button class="btn btn-primary btn-sm btn-block" data-action="practice" data-id="${quiz.id}">
              ▶ Luyện tập
            </button>
            <button class="btn btn-secondary btn-sm btn-block" data-action="exam" data-id="${quiz.id}">
              ⏱ Thi thử
            </button>
          </div>
        </div>
      `;

      card.querySelector('[data-action="practice"]').addEventListener('click', () => {
        sound.playClick();
        this.startQuizById(quiz.id, 'practice');
      });

      card.querySelector('[data-action="exam"]').addEventListener('click', () => {
        sound.playClick();
        this.startQuizById(quiz.id, 'exam');
      });

      container.appendChild(card);
    });

    // Button to practice all 300 questions
    const btnAllWord = document.getElementById('btn-word-all-300');
    if (btnAllWord) {
      btnAllWord.onclick = () => {
        sound.playClick();
        const fullQuiz = {
          id: 'word_all_300',
          title: 'Toàn Bộ 300 Câu Trắc Nghiệm (File Word)',
          questions: this.wordData.allQuestions
        };
        this.openQuizPlayer(fullQuiz, 'practice');
      };
    }
  }

  renderPDFPage() {
    const container = document.getElementById('pdf-chapters-container');
    if (!container || !this.pdfData) return;

    container.innerHTML = '';
    this.pdfData.chapters.forEach((chap, cIdx) => {
      const accordion = document.createElement('div');
      accordion.className = `chapter-accordion ${cIdx === 0 ? 'open' : ''}`;
      
      const totalChapQs = chap.quizzes.reduce((acc, q) => acc + q.questionCount, 0);

      accordion.innerHTML = `
        <div class="chapter-header">
          <div class="chapter-title-wrap">
            <span class="chapter-num-badge">CHƯƠNG ${chap.chapterNumber}</span>
            <span class="chapter-name">${chap.chapterTitle}</span>
          </div>
          <div class="chapter-meta">
            <span class="chapter-count">${chap.quizzes.length} Phần • ${totalChapQs} câu</span>
            <span class="chapter-arrow">▼</span>
          </div>
        </div>
        <div class="chapter-body">
          <div class="quiz-grid"></div>
        </div>
      `;

      // Accordion header click
      accordion.querySelector('.chapter-header').addEventListener('click', () => {
        sound.playClick();
        accordion.classList.toggle('open');
      });

      // Render Sub-quizzes inside chapter
      const quizGrid = accordion.querySelector('.quiz-grid');
      chap.quizzes.forEach(quiz => {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.innerHTML = `
          <div>
            <div class="quiz-card-header">
              <span class="quiz-tag">Chương ${chap.chapterNumber}</span>
              <span class="quiz-meta-item">📝 ${quiz.questionCount} câu</span>
            </div>
            <h4 class="quiz-card-title">${quiz.partTitle}</h4>
            <p class="quiz-card-desc">Bao quát nội dung trọng tâm trích từ tài liệu ôn thi KDQT.</p>
          </div>
          <div class="quiz-card-actions">
            <button class="btn btn-primary btn-sm btn-block" data-action="practice" data-id="${quiz.id}">
              ▶ Luyện tập
            </button>
            <button class="btn btn-secondary btn-sm btn-block" data-action="exam" data-id="${quiz.id}">
              ⏱ Thi thử
            </button>
          </div>
        `;

        card.querySelector('[data-action="practice"]').addEventListener('click', (e) => {
          e.stopPropagation();
          sound.playClick();
          this.startQuizById(quiz.id, 'practice');
        });

        card.querySelector('[data-action="exam"]').addEventListener('click', (e) => {
          e.stopPropagation();
          sound.playClick();
          this.startQuizById(quiz.id, 'exam');
        });

        quizGrid.appendChild(card);
      });

      container.appendChild(accordion);
    });
  }

  renderTracNghiemPage() {
    const container = document.getElementById('tracnghiem-quizzes-grid');
    if (!container || !this.tracNghiemData) return;

    container.innerHTML = '';
    this.tracNghiemData.quizzes.forEach(quiz => {
      const card = document.createElement('div');
      card.className = 'quiz-card';
      card.style.borderLeft = '4px solid var(--accent)';
      card.innerHTML = `
        <div>
          <div class="quiz-card-header">
            <span class="quiz-tag" style="background: rgba(245, 158, 11, 0.15); color: var(--accent);">Cụm ${quiz.chapterNumber}</span>
            <span class="quiz-meta-item">📝 ${quiz.questionCount} câu</span>
          </div>
          <h3 class="quiz-card-title">${quiz.title}</h3>
          <p class="quiz-card-desc">${quiz.description}</p>
        </div>
        <div>
          <div class="quiz-card-actions">
            <button class="btn btn-primary btn-sm btn-block" data-action="practice" data-id="${quiz.id}" style="background: var(--accent); color: #1e1e2d; font-weight: 700;">
              ▶ Luyện tập
            </button>
            <button class="btn btn-secondary btn-sm btn-block" data-action="exam" data-id="${quiz.id}">
              ⏱ Thi thử
            </button>
          </div>
        </div>
      `;

      card.querySelector('[data-action="practice"]').addEventListener('click', () => {
        sound.playClick();
        this.startQuizById(quiz.id, 'practice');
      });

      card.querySelector('[data-action="exam"]').addEventListener('click', () => {
        sound.playClick();
        this.startQuizById(quiz.id, 'exam');
      });

      container.appendChild(card);
    });

    // Button to practice all 48 questions
    const btnAllTN = document.getElementById('btn-tracnghiem-all-48');
    if (btnAllTN) {
      btnAllTN.onclick = () => {
        sound.playClick();
        const fullQuiz = {
          id: 'tracnghiem_all_48',
          title: 'Toàn Bộ 48 Câu Trắc Nghiệm KDQT Trọng Tâm',
          questions: this.tracNghiemData.allQuestions
        };
        this.openQuizPlayer(fullQuiz, 'practice');
      };
    }

    // Button to exam all 48 questions (45 mins)
    const btnExamTN = document.getElementById('btn-tracnghiem-exam-48');
    if (btnExamTN) {
      btnExamTN.onclick = () => {
        sound.playClick();
        const examQuiz = {
          id: 'tracnghiem_exam_48',
          title: 'Đề Thi Thử 48 Câu Trắc Nghiệm KDQT (45 Phút)',
          questions: this.tracNghiemData.allQuestions
        };
        this.openQuizPlayer(examQuiz, 'exam', 45);
      };
    }
  }

  startQuizById(quizId, mode) {
    // Search in word quizzes
    let found = this.wordData?.quizzes.find(q => q.id === quizId);
    if (!found) {
      // Search in pdf quizzes
      found = this.pdfData?.quizzes.find(q => q.id === quizId);
    }
    if (!found) {
      // Search in tracnghiem quizzes
      found = this.tracNghiemData?.quizzes.find(q => q.id === quizId);
    }

    if (found) {
      this.openQuizPlayer(found, mode);
    }
  }

  openQuizPlayer(quizData, mode = 'practice', customMin = null) {
    if (this.activeTab !== 'quiz') {
      this.previousTab = this.activeTab;
    }
    this.activeTab = 'quiz';

    // Hide tabs, show quiz player
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    const playerView = document.getElementById('view-quiz-player');
    if (playerView) playerView.classList.add('active');

    // Update Quiz Header title
    const titleEl = document.getElementById('quiz-active-title');
    if (titleEl) titleEl.textContent = quizData.title || quizData.partTitle;

    quizEngine.startQuiz(quizData, mode, customMin);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  performSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    if (!query) {
      resultsContainer.innerHTML = '<p class="text-muted text-center" style="padding: 2rem 0;">Nhập từ khóa bất kỳ (ví dụ: toàn cầu hóa, JIT, liên minh, tỷ giá) để tìm kiếm trong 1,055 câu hỏi...</p>';
      return;
    }

    const qLower = query.toLowerCase();
    const matched = this.allQuestions.filter(q => 
      q.question.toLowerCase().includes(qLower) || 
      q.options.some(opt => opt.toLowerCase().includes(qLower))
    ).slice(0, 25); // Top 25

    if (matched.length === 0) {
      resultsContainer.innerHTML = `<p class="text-muted text-center" style="padding: 2rem 0;">Không tìm thấy câu hỏi nào phù hợp với từ khóa "<strong>${query}</strong>".</p>`;
      return;
    }

    resultsContainer.innerHTML = '';
    matched.forEach(q => {
      const item = document.createElement('div');
      item.className = 'search-result-item';

      // Highlight keyword
      const re = new RegExp(`(${query})`, 'gi');
      const highlightedQ = q.question.replace(re, '<mark style="background: rgba(245, 158, 11, 0.3); color: inherit; padding: 0 2px; border-radius: 2px;">$1</mark>');

      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
          <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">${q.source}</span>
          <span style="font-size: 0.75rem; font-weight: 700; color: var(--success);">Đáp án: ${q.correctAnswer}</span>
        </div>
        <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.5rem; line-height: 1.4;">${highlightedQ}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          <strong>${q.correctAnswer}.</strong> ${q.options[q.correctIndex]}
        </div>
      `;

      item.addEventListener('click', () => {
        sound.playClick();
        document.getElementById('search-modal').classList.remove('open');
        const singleQQuiz = {
          id: `search_result_${q.id}`,
          title: `Tra Cứu: ${q.source}`,
          questions: [q]
        };
        this.openQuizPlayer(singleQQuiz, 'practice');
      });

      resultsContainer.appendChild(item);
    });
  }
}

// Instantiate and start
const app = new AppController();
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
