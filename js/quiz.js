/**
 * KDQT Quiz Master - Core Quiz Engine
 */

import { sound } from './audio.js';
import { storage } from './storage.js';

class QuizEngine {
  constructor() {
    this.quiz = null;
    this.questions = [];
    this.currentIndex = 0;
    this.userAnswers = {}; // { [index]: selectedOptionIndex }
    this.mode = 'practice'; // 'practice' or 'exam'
    this.isSubmitted = false;
    this.timerInterval = null;
    this.timeRemaining = 0;
    this.totalTime = 0;
    this.filter = 'all'; // 'all', 'unanswered', 'incorrect', 'flagged'

    // DOM Elements
    this.dom = {};
  }

  init(domElements) {
    this.dom = domElements;
    this.bindEvents();
  }

  bindEvents() {
    // Navigation buttons
    if (this.dom.btnPrev) this.dom.btnPrev.addEventListener('click', () => this.prevQuestion());
    if (this.dom.btnNext) this.dom.btnNext.addEventListener('click', () => this.nextQuestion());
    if (this.dom.btnSubmit) this.dom.btnSubmit.addEventListener('click', () => this.confirmSubmit());
    if (this.dom.btnFlag) this.dom.btnFlag.addEventListener('click', () => this.toggleFlagCurrent());

    // Mobile bottom bar buttons
    if (this.dom.mobileBtnPrev) this.dom.mobileBtnPrev.addEventListener('click', () => this.prevQuestion());
    if (this.dom.mobileBtnNext) this.dom.mobileBtnNext.addEventListener('click', () => this.nextQuestion());
    if (this.dom.mobileBtnFlag) this.dom.mobileBtnFlag.addEventListener('click', () => this.toggleFlagCurrent());
    if (this.dom.mobileBtnSubmit) this.dom.mobileBtnSubmit.addEventListener('click', () => this.confirmSubmit());
    if (this.dom.mobileBtnPalette) this.dom.mobileBtnPalette.addEventListener('click', () => this.openMobileDrawer());

    // Drawer close
    if (this.dom.mobilePaletteDrawer) {
      this.dom.mobilePaletteDrawer.addEventListener('click', (e) => {
        if (e.target === this.dom.mobilePaletteDrawer) this.closeMobileDrawer();
      });
    }

    // Results modal buttons
    if (this.dom.btnReview) this.dom.btnReview.addEventListener('click', () => this.reviewQuiz());
    if (this.dom.btnRestart) this.dom.btnRestart.addEventListener('click', () => this.restartQuiz());
    if (this.dom.btnRetryWrong) this.dom.btnRetryWrong.addEventListener('click', () => this.retryWrongQuestions());
  }

  startQuiz(quizData, mode = 'practice', customDurationMin = null) {
    this.quiz = quizData;
    this.questions = [...quizData.questions];
    this.currentIndex = 0;
    this.userAnswers = {};
    this.mode = mode;
    this.isSubmitted = false;
    this.filter = 'all';

    clearInterval(this.timerInterval);

    // Setup Timer for Exam Mode
    if (this.mode === 'exam') {
      const durationMinutes = customDurationMin || Math.max(15, Math.ceil(this.questions.length * 1.2));
      this.totalTime = durationMinutes * 60;
      this.timeRemaining = this.totalTime;
      this.startTimer();
      if (this.dom.timerBadge) this.dom.timerBadge.classList.remove('hidden');
    } else {
      if (this.dom.timerBadge) this.dom.timerBadge.classList.add('hidden');
    }

    this.renderQuestion();
    this.renderPalette();
  }

  startTimer() {
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      this.updateTimerDisplay();

      if (this.timeRemaining <= 300) { // < 5 mins
        if (this.dom.timerBadge) this.dom.timerBadge.classList.add('warning');
      }

      if (this.timeRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.submitQuiz(true); // auto submit
      }
    }, 1000);
  }

  updateTimerDisplay() {
    if (!this.dom.timerText) return;
    const mins = Math.floor(this.timeRemaining / 60);
    const secs = this.timeRemaining % 60;
    this.dom.timerText.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  renderQuestion() {
    if (!this.questions.length) return;
    const q = this.questions[this.currentIndex];
    const isBookmarked = storage.isBookmarked(q.id);

    // Question index tag & title
    if (this.dom.questionIndexTag) {
      this.dom.questionIndexTag.textContent = `Câu ${this.currentIndex + 1} / ${this.questions.length}`;
    }
    if (this.dom.questionText) {
      this.dom.questionText.textContent = q.question;
    }

    // Flag button state
    this.updateFlagUI(isBookmarked);

    // Render 4 Options
    if (this.dom.optionsContainer) {
      this.dom.optionsContainer.innerHTML = '';
      const letters = ['A', 'B', 'C', 'D'];
      const selectedIndex = this.userAnswers[this.currentIndex];

      q.options.forEach((optText, optIdx) => {
        const item = document.createElement('div');
        item.className = 'option-item';
        item.setAttribute('data-index', optIdx);

        // State classes
        if (selectedIndex === optIdx) {
          item.classList.add('selected');
        }

        // Feedback in Practice Mode or after Submission
        if (this.mode === 'practice' && selectedIndex !== undefined) {
          if (optIdx === q.correctIndex) {
            item.classList.add('correct');
          } else if (selectedIndex === optIdx) {
            item.classList.add('incorrect');
          }
        } else if (this.isSubmitted) {
          if (optIdx === q.correctIndex) {
            item.classList.add('correct');
          } else if (selectedIndex === optIdx) {
            item.classList.add('incorrect');
          }
        }

        item.innerHTML = `
          <div class="option-marker">${letters[optIdx]}</div>
          <div class="option-content">${optText}</div>
        `;

        if (!this.isSubmitted && !(this.mode === 'practice' && selectedIndex !== undefined)) {
          item.addEventListener('click', () => this.selectOption(optIdx));
        }

        this.dom.optionsContainer.appendChild(item);
      });
    }

    // Explanation Box
    if (this.dom.explanationBox) {
      const selectedIndex = this.userAnswers[this.currentIndex];
      if ((this.mode === 'practice' && selectedIndex !== undefined) || this.isSubmitted) {
        this.dom.explanationBox.classList.add('show');
        if (this.dom.explanationText) {
          this.dom.explanationText.textContent = q.explanation || `Đáp án đúng là ${q.correctAnswer}.`;
        }
      } else {
        this.dom.explanationBox.classList.remove('show');
      }
    }

    // Navigation buttons state
    if (this.dom.btnPrev) this.dom.btnPrev.disabled = this.currentIndex === 0;
    if (this.dom.mobileBtnPrev) this.dom.mobileBtnPrev.disabled = this.currentIndex === 0;

    const isLast = this.currentIndex === this.questions.length - 1;
    if (this.dom.btnNext) {
      this.dom.btnNext.textContent = isLast ? 'Nộp bài' : 'Câu tiếp →';
    }
    if (this.dom.mobileBtnNext) {
      this.dom.mobileBtnNext.textContent = isLast ? 'Nộp bài' : 'Tiếp →';
    }

    this.renderPalette();
  }

  selectOption(optIdx) {
    if (this.isSubmitted) return;
    const q = this.questions[this.currentIndex];
    this.userAnswers[this.currentIndex] = optIdx;

    if (optIdx === q.correctIndex) {
      sound.playCorrect();
      storage.removeWrongQuestion(q.id);
    } else {
      sound.playIncorrect();
      storage.recordWrongQuestion(q);
    }

    this.renderQuestion();
    this.renderPalette();
  }

  nextQuestion() {
    sound.playClick();
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.renderQuestion();
    } else {
      this.confirmSubmit();
    }
  }

  prevQuestion() {
    sound.playClick();
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderQuestion();
    }
  }

  jumpToQuestion(index) {
    sound.playClick();
    if (index >= 0 && index < this.questions.length) {
      this.currentIndex = index;
      this.renderQuestion();
      this.closeMobileDrawer();
    }
  }

  toggleFlagCurrent() {
    const q = this.questions[this.currentIndex];
    const isBookmarked = storage.toggleBookmark(q.id);
    sound.playClick();
    this.updateFlagUI(isBookmarked);
    this.renderPalette();
  }

  updateFlagUI(isBookmarked) {
    const starIcon = isBookmarked ? '★' : '☆';
    const text = isBookmarked ? ' Đã lưu' : ' Lưu câu hỏi';
    if (this.dom.btnFlag) {
      this.dom.btnFlag.innerHTML = `<span>${starIcon}</span>${text}`;
      this.dom.btnFlag.classList.toggle('btn-secondary', !isBookmarked);
      this.dom.btnFlag.classList.toggle('btn-primary', isBookmarked);
    }
    if (this.dom.mobileBtnFlag) {
      this.dom.mobileBtnFlag.innerHTML = `<span>${starIcon}</span><span>Lưu</span>`;
    }
  }

  renderPalette() {
    const containers = [this.dom.paletteGrid, this.dom.mobilePaletteGrid];
    containers.forEach(grid => {
      if (!grid) return;
      grid.innerHTML = '';

      this.questions.forEach((q, idx) => {
        const btn = document.createElement('button');
        btn.className = 'palette-btn';
        btn.textContent = idx + 1;

        if (idx === this.currentIndex) btn.classList.add('current');
        if (storage.isBookmarked(q.id)) btn.classList.add('flagged');

        const ans = this.userAnswers[idx];
        if (ans !== undefined) {
          if (this.mode === 'practice' || this.isSubmitted) {
            if (ans === q.correctIndex) {
              btn.classList.add('correct');
            } else {
              btn.classList.add('incorrect');
            }
          } else {
            btn.classList.add('answered');
          }
        }

        btn.addEventListener('click', () => this.jumpToQuestion(idx));
        grid.appendChild(btn);
      });
    });
  }

  openMobileDrawer() {
    sound.playClick();
    if (this.dom.mobilePaletteDrawer) {
      this.dom.mobilePaletteDrawer.classList.add('open');
    }
  }

  closeMobileDrawer() {
    if (this.dom.mobilePaletteDrawer) {
      this.dom.mobilePaletteDrawer.classList.remove('open');
    }
  }

  confirmSubmit() {
    sound.playClick();
    const answeredCount = Object.keys(this.userAnswers).length;
    const unansweredCount = this.questions.length - answeredCount;

    if (unansweredCount > 0 && !this.isSubmitted) {
      const confirmMsg = `Bạn còn ${unansweredCount} câu chưa làm. Bạn có chắc chắn muốn nộp bài?`;
      if (confirm(confirmMsg)) {
        this.submitQuiz();
      }
    } else {
      this.submitQuiz();
    }
  }

  submitQuiz(isAuto = false) {
    clearInterval(this.timerInterval);
    this.isSubmitted = true;

    // Calculate score
    let correctCount = 0;
    this.questions.forEach((q, idx) => {
      if (this.userAnswers[idx] === q.correctIndex) {
        correctCount++;
      }
    });

    const total = this.questions.length;
    const scorePct = Math.round((correctCount / total) * 100);
    const timeSpent = this.totalTime - this.timeRemaining;

    // Save to storage
    storage.saveQuizResult({
      quizId: this.quiz.id,
      quizTitle: this.quiz.title || this.quiz.partTitle,
      mode: this.mode,
      total,
      correct: correctCount,
      timeSpentSec: timeSpent
    });

    sound.playComplete();
    this.showResultsModal(correctCount, total, scorePct, timeSpent);
    this.renderQuestion();
    this.renderPalette();
  }

  showResultsModal(correct, total, scorePct, timeSpent) {
    if (!this.dom.resultsModal) return;

    if (this.dom.resScoreBig) this.dom.resScoreBig.textContent = `${scorePct}%`;
    if (this.dom.resScoreSub) {
      let message = 'Cần cố gắng thêm!';
      if (scorePct >= 90) message = 'Xuất sắc! Nắm rất vững kiến thức!';
      else if (scorePct >= 75) message = 'Rất tốt! Đạt chuẩn thi môn KDQT!';
      else if (scorePct >= 50) message = 'Đạt yêu cầu! Cần ôn lại các câu sai.';
      this.dom.resScoreSub.textContent = message;
    }

    if (this.dom.resStatCorrect) this.dom.resStatCorrect.textContent = `${correct} / ${total}`;
    if (this.dom.resStatIncorrect) this.dom.resStatIncorrect.textContent = `${total - correct}`;
    
    if (this.dom.resStatTime) {
      const mins = Math.floor(timeSpent / 60);
      const secs = timeSpent % 60;
      this.dom.resStatTime.textContent = `${mins}m ${secs}s`;
    }

    this.dom.resultsModal.classList.add('open');
  }

  reviewQuiz() {
    sound.playClick();
    if (this.dom.resultsModal) this.dom.resultsModal.classList.remove('open');
    this.currentIndex = 0;
    this.renderQuestion();
  }

  restartQuiz() {
    sound.playClick();
    if (this.dom.resultsModal) this.dom.resultsModal.classList.remove('open');
    this.startQuiz(this.quiz, this.mode);
  }

  retryWrongQuestions() {
    sound.playClick();
    if (this.dom.resultsModal) this.dom.resultsModal.classList.remove('open');

    const wrongList = this.questions.filter((q, idx) => this.userAnswers[idx] !== q.correctIndex);
    if (!wrongList.length) {
      alert('Tuyệt vời! Bạn không làm sai câu nào để ôn lại.');
      return;
    }

    const wrongQuiz = {
      id: `${this.quiz.id}_wrong`,
      title: `Ôn Lại Câu Sai - ${this.quiz.title || this.quiz.partTitle}`,
      questions: wrongList
    };

    this.startQuiz(wrongQuiz, 'practice');
  }
}

export const quizEngine = new QuizEngine();
