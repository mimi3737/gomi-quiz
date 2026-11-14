(function () {
  'use strict';

  var CATEGORY_ORDER = [
    '可燃ごみ',
    '不燃ごみ',
    '資源',
    '粗大ごみ',
    '拠点回収',
    '区では収集していません'
  ];

  var CATEGORY_CLASS = {
    '可燃ごみ': 'cat-burnable',
    '不燃ごみ': 'cat-nonburnable',
    '資源': 'cat-recycle',
    '粗大ごみ': 'cat-bulky',
    '拠点回収': 'cat-station',
    '区では収集していません': 'cat-none'
  };

  // --- エラー表示（画面が真っ白にならないようにする） ---
  var shownErrors = new Set();

  function showError(message) {
    var text = String(message || '不明なエラーが発生しました');
    if (shownErrors.has(text)) return;
    shownErrors.add(text);

    var banner = document.getElementById('error-banner');
    if (!banner) return;

    var line = document.createElement('div');
    line.textContent = text;
    banner.appendChild(line);
    banner.hidden = false;
  }

  window.addEventListener('error', function (event) {
    var msg = event && event.message ? event.message : 'スクリプトの読み込みに失敗しました';
    showError('エラー: ' + msg);
  });

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    var msg = reason && reason.message ? reason.message : String(reason || '不明なエラー');
    showError('エラー: ' + msg);
  });

  // --- 自己ベストの保存 ---
  // localStorage が使えない環境（プライベートモード等）でも落ちないようにする。
  var BEST_KEY = 'setagaya-garbage-quiz.bestStreak';

  function loadBest() {
    try {
      var raw = window.localStorage.getItem(BEST_KEY);
      var value = Number(raw);
      if (!isFinite(value) || value <= 0) return 0;
      return Math.floor(value);
    } catch (err) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch (err) {
      showError(
        '自己ベストを保存できませんでした。ブラウザの設定で localStorage が使えない可能性があります。'
      );
    }
  }

  // --- 要素 ---
  var els = {
    quiz: document.getElementById('quiz'),
    progress: document.getElementById('progress'),
    progressRemaining: document.getElementById('progress-remaining'),
    progressTrack: document.getElementById('progress-track'),
    progressFill: document.getElementById('progress-fill'),
    itemName: document.getElementById('item-name'),
    answers: document.getElementById('answers'),
    result: document.getElementById('result'),
    resultHeading: document.getElementById('result-heading'),
    bestUpdate: document.getElementById('best-update'),
    resultAnswer: document.getElementById('result-answer'),
    resultExplanation: document.getElementById('result-explanation'),
    resultSupplement: document.getElementById('result-supplement'),
    resultFee: document.getElementById('result-fee'),
    nextButton: document.getElementById('next-button'),
    complete: document.getElementById('complete'),
    completeTitle: document.getElementById('complete-title'),
    completeMessage: document.getElementById('complete-message'),
    completeBestUpdate: document.getElementById('complete-best-update'),
    completeCorrect: document.getElementById('complete-correct'),
    completeRate: document.getElementById('complete-rate'),
    completeWrong: document.getElementById('complete-wrong'),
    completeStreak: document.getElementById('complete-streak'),
    playAgain: document.getElementById('play-again'),
    reviewButton: document.getElementById('review-button'),
    review: document.getElementById('review'),
    reviewLead: document.getElementById('review-lead'),
    reviewList: document.getElementById('review-list'),
    reviewClose: document.getElementById('review-close'),
    reviewBack: document.getElementById('review-back'),
    restart: document.getElementById('restart'),
    statBestWrap: document.getElementById('stat-best-wrap'),
    statCorrect: document.getElementById('stat-correct'),
    statRate: document.getElementById('stat-rate'),
    statStreak: document.getElementById('stat-streak'),
    statBest: document.getElementById('stat-best')
  };

  var state = {
    order: [],
    index: 0,
    answered: false,
    correct: 0,
    total: 0,
    streak: 0,
    sessionBest: 0,
    best: 0,
    bestUpdated: false,
    finished: false,
    wrongItems: [],
    buttons: []
  };

  function currentRecord() {
    return window.GARBAGE_DATA[state.order[state.index]];
  }

  function shuffle(array) {
    var a = array.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function buildAnswerButtons() {
    CATEGORY_ORDER.forEach(function (name) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'answer ' + CATEGORY_CLASS[name];
      btn.dataset.category = name;
      btn.textContent = name;
      btn.addEventListener('click', function () {
        answer(name);
      });
      els.answers.appendChild(btn);
      state.buttons.push(btn);
    });
  }

  function updateStats() {
    els.statCorrect.textContent = String(state.correct);
    els.statRate.textContent =
      state.total === 0 ? '-' : Math.round((state.correct / state.total) * 100) + '%';
    els.statStreak.textContent = String(state.streak);
    els.statBest.textContent = String(state.best);
    els.statBestWrap.classList.toggle('is-record', state.bestUpdated);
  }

  function updateProgress() {
    var total = state.order.length;
    var current = state.index + 1;
    var remaining = total - current;

    els.progress.textContent = current + '問目 / ' + total + '問';
    els.progressRemaining.textContent =
      remaining === 0 ? 'ラスト問題' : 'あと ' + remaining + '問';

    var percent = total === 0 ? 0 : (current / total) * 100;
    els.progressFill.style.width = percent + '%';
    els.progressTrack.setAttribute('aria-valuemax', String(total));
    els.progressTrack.setAttribute('aria-valuenow', String(current));
  }

  function renderQuestion() {
    var rec = currentRecord();

    state.answered = false;
    els.itemName.textContent = rec.item;
    updateProgress();

    els.answers.classList.remove('is-answered');
    state.buttons.forEach(function (btn) {
      btn.disabled = false;
      btn.classList.remove('is-correct', 'is-wrong');
    });

    els.result.hidden = true;
    els.result.classList.remove('is-correct', 'is-wrong');
    els.bestUpdate.hidden = true;
    els.resultExplanation.hidden = true;
    els.resultSupplement.textContent = '';
    els.resultFee.hidden = true;
  }

  function answer(category) {
    if (state.answered || state.finished) return;

    var rec = currentRecord();
    var isCorrect = rec.categories.indexOf(category) !== -1;

    state.answered = true;
    state.total += 1;

    var isNewBest = false;
    if (isCorrect) {
      state.correct += 1;
      state.streak += 1;
      if (state.streak > state.sessionBest) state.sessionBest = state.streak;
      if (state.streak > state.best) {
        state.best = state.streak;
        state.bestUpdated = true;
        isNewBest = true;
        saveBest(state.best);
      }
    } else {
      state.streak = 0;
      state.wrongItems.push({ record: rec, chosen: category });
    }

    state.buttons.forEach(function (btn) {
      var name = btn.dataset.category;
      btn.disabled = true;
      if (rec.categories.indexOf(name) !== -1) {
        btn.classList.add('is-correct');
      }
      if (name === category && !isCorrect) {
        btn.classList.add('is-wrong');
      }
    });
    els.answers.classList.add('is-answered');

    // 結果表示
    els.result.hidden = false;
    els.result.classList.toggle('is-correct', isCorrect);
    els.result.classList.toggle('is-wrong', !isCorrect);
    els.resultHeading.textContent = isCorrect ? '正解！' : 'ざんねん…';
    els.bestUpdate.hidden = !isNewBest;

    var correctText = '「' + rec.categories.join('」「') + '」';
    els.resultAnswer.textContent = isCorrect
      ? '正解は' + correctText + 'です'
      : 'あなたの回答は「' + category + '」。正解は' + correctText + 'です';

    var supplements = [];
    if (rec.note) supplements.push('備考: ' + rec.note);
    if (rec.originalCategory !== rec.categories.join('、')) {
      supplements.push('区の表記: ' + rec.originalCategory);
    }
    if (supplements.length > 0) {
      els.resultSupplement.textContent = supplements.join('\n');
      els.resultExplanation.hidden = false;
    } else {
      els.resultSupplement.textContent = '';
      els.resultExplanation.hidden = true;
    }

    els.resultFee.hidden = rec.fee !== '有料';

    updateStats();
    els.nextButton.focus();
  }

  function next() {
    if (!state.answered || state.finished) return;

    state.index += 1;
    if (state.index >= state.order.length) {
      finish();
      return;
    }
    renderQuestion();
  }

  function getMessage(rate, wrong, total) {
    if (total > 0 && wrong === 0) {
      return '全問正解！すばらしい分別マスターです。';
    }
    if (rate >= 90) {
      return 'すばらしい！分別マスターまであと少しです。';
    }
    if (rate >= 70) {
      return 'よくできました！この調子で続けましょう。';
    }
    if (rate >= 50) {
      return '半分以上正解です。復習すると、もっと身につきます。';
    }
    return '最後までやりきりました。復習して、もう一度挑戦してみましょう。';
  }

  function renderReview() {
    els.reviewList.textContent = '';
    els.reviewLead.textContent =
      state.wrongItems.length + '問を、正解と解説つきで確認できます。';

    state.wrongItems.forEach(function (entry) {
      var rec = entry.record;
      var li = document.createElement('li');
      li.className = 'review-item';

      var name = document.createElement('p');
      name.className = 'review-item-name';
      name.textContent = rec.item;
      li.appendChild(name);

      var answers = document.createElement('div');
      answers.className = 'review-answers';

      var chosen = document.createElement('p');
      chosen.className = 'review-answer review-answer-wrong';
      chosen.textContent = 'あなたの回答: ' + entry.chosen;
      answers.appendChild(chosen);

      var correct = document.createElement('p');
      correct.className = 'review-answer review-answer-correct';
      correct.textContent = '正解: ' + rec.categories.join('・');
      answers.appendChild(correct);

      li.appendChild(answers);

      if (rec.note) {
        var note = document.createElement('p');
        note.className = 'review-note';
        note.textContent = '備考: ' + rec.note;
        li.appendChild(note);
      }

      if (rec.originalCategory !== rec.categories.join('、')) {
        var original = document.createElement('p');
        original.className = 'review-note';
        original.textContent = '区の表記: ' + rec.originalCategory;
        li.appendChild(original);
      }

      if (rec.fee === '有料') {
        var fee = document.createElement('p');
        fee.className = 'review-fee';
        fee.textContent = '有料の品目です';
        li.appendChild(fee);
      }

      els.reviewList.appendChild(li);
    });
  }

  function finish() {
    state.finished = true;
    els.quiz.hidden = true;
    els.answers.hidden = true;
    els.result.hidden = true;
    els.complete.hidden = false;
    els.review.hidden = true;
    els.reviewButton.setAttribute('aria-expanded', 'false');

    var total = state.total;
    var wrong = state.wrongItems.length;
    var rate = total === 0 ? 0 : Math.round((state.correct / total) * 100);

    els.completeTitle.textContent = total + '問 おつかれさまでした';
    els.completeMessage.textContent = getMessage(rate, wrong, total);
    els.completeCorrect.textContent = state.correct + '問';
    els.completeRate.textContent = rate + '%';
    els.completeWrong.textContent = wrong + '問';
    els.completeStreak.textContent =
      '今回の最高連続正解 ' + state.sessionBest + '問 ／ 自己ベスト ' + state.best + '問';
    els.completeBestUpdate.hidden = !state.bestUpdated;
    els.reviewButton.hidden = wrong === 0;

    renderReview();
    els.playAgain.focus();
  }

  function startNewGame() {
    var indices = [];
    for (var i = 0; i < window.GARBAGE_DATA.length; i++) indices.push(i);

    state.order = shuffle(indices);
    state.index = 0;
    state.answered = false;
    state.correct = 0;
    state.total = 0;
    state.streak = 0;
    state.sessionBest = 0;
    state.bestUpdated = false;
    state.finished = false;
    state.wrongItems = [];

    els.quiz.hidden = false;
    els.answers.hidden = false;
    els.complete.hidden = true;
    els.completeBestUpdate.hidden = true;
    els.review.hidden = true;
    els.reviewButton.hidden = true;
    els.reviewButton.setAttribute('aria-expanded', 'false');
    els.reviewList.textContent = '';
    els.reviewLead.textContent = '';

    updateStats();
    renderQuestion();
  }

  function openReview() {
    if (!state.finished || state.wrongItems.length === 0) return;

    renderReview();
    els.review.hidden = false;
    els.reviewButton.setAttribute('aria-expanded', 'true');
    els.review.scrollIntoView({ behavior: 'smooth', block: 'start' });
    els.reviewClose.focus({ preventScroll: true });
  }

  function closeReview() {
    els.review.hidden = true;
    els.reviewButton.setAttribute('aria-expanded', 'false');
    els.reviewButton.focus();
  }

  function bindEvents() {
    els.nextButton.addEventListener('click', next);
    els.restart.addEventListener('click', startNewGame);
    els.playAgain.addEventListener('click', startNewGame);
    els.reviewButton.addEventListener('click', openReview);
    els.reviewClose.addEventListener('click', closeReview);
    els.reviewBack.addEventListener('click', closeReview);

    document.addEventListener('keydown', function (event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (!state.finished && !state.answered) {
        if (event.key >= '1' && event.key <= '6') {
          var i = Number(event.key) - 1;
          if (i < CATEGORY_ORDER.length) {
            event.preventDefault();
            answer(CATEGORY_ORDER[i]);
          }
        }
        return;
      }

      if (!state.finished && state.answered) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        var active = document.activeElement;
        if (active && active.tagName === 'BUTTON' && active !== els.nextButton) {
          return; // フッターのボタンなどはそのまま動かす
        }
        event.preventDefault();
        next();
      }
    });
  }

  function init() {
    if (!Array.isArray(window.GARBAGE_DATA) || window.GARBAGE_DATA.length === 0) {
      showError(
        'データの読み込みに失敗しました。data.js が見つからないか、内容が空です。\n' +
          'scripts/build-data.mjs を実行して data.js を生成してください。'
      );
      els.itemName.textContent = 'データを読み込めませんでした';
      els.answers.hidden = true;
      els.progress.textContent = '';
      return;
    }

    state.best = loadBest();

    buildAnswerButtons();
    bindEvents();
    startNewGame();
  }

  try {
    init();
  } catch (err) {
    showError('初期化に失敗しました: ' + (err && err.message ? err.message : err));
  }
})();
