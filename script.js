// ========================================
// 設定
// ========================================

const QUESTION_FILES = [
  "./geography1.json",
  "./history1.json",
  "./kanji1.json",
  "./anime1.json"
];

const QUESTIONS_PER_QUIZ = 10;
const CHALLENGE_QUESTION_COUNT = 30; // 腕試し時の出題数
const CHALLENGE_TIME_LIMIT = 10;     // 1問あたりの制限時間（秒）
const CHALLENGE_MAX_LIVES = 3;       // 腕試しのライフ数

// ==========================================
// プリロード用関数
// ==========================================

// 1枚の画像を完全に読み込むPromiseを返す関数（1問目の表示待ちなどに使用）
function preloadSingleImage(src) {
  return new Promise(resolve => {
    if (!src || src.trim() === "") {
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // エラー時もクイズ進行を停止させない
    img.src = src;
  });
}

// 複数画像のバックグラウンド読み込み（先行キャッシュ用）
function preloadImages(questions) {
  questions.forEach(q => {
    if (q.image && q.image.trim() !== "") {
      const img = new Image();
      img.src = q.image;
    }
  });
}

// ========================================
// 変数
// ========================================

let allQuestions = [];
let currentGenre = "";
let currentDifficulty = "";
let quizQuestions = [];
let currentIndex = 0;
let score = 0;

// 腕試し用変数
let lives = CHALLENGE_MAX_LIVES;
let timerId = null;
let timeLeft = CHALLENGE_TIME_LIMIT;

// ========================================
// 画面管理
// ========================================

const screens = {};

document.querySelectorAll(".screen").forEach(el => {
  screens[el.id] = el;
});

function showScreen(id) {
  // 画面遷移時は安全のためタイマーを停止
  stopTimer();

  Object.values(screens).forEach(s => {
    s.classList.remove("active");
  });

  if (screens[id]) {
    screens[id].classList.add("active");
  }
}

// ========================================
// 配列をシャッフル（共通）
// ========================================

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ========================================
// 複数JSONファイルから問題をまとめて読み込む
// ========================================

async function loadQuestions() {
  showScreen("loading");

  try {
    const responses = await Promise.all(
      QUESTION_FILES.map(async file => {
        const res = await fetch(file);
        if (!res.ok) {
          throw new Error(`${file} の読み込みに失敗しました (HTTP: ${res.status})`);
        }
        return res.json();
      })
    );

    const rawQuestions = responses.flat();

    allQuestions = rawQuestions.map(q => {
      const correct = String(q.choice1 || "").trim();
      const wrongPool = [
        String(q.choice2 || "").trim(),
        String(q.choice3 || "").trim(),
        String(q.choice4 || "").trim(),
        String(q.choice5 || "").trim(),
        String(q.choice6 || "").trim()
      ].filter(choice => choice !== "");

      return {
        genre: String(q.genre || "").trim(),
        difficulty: String(q.difficulty || "").trim().toLowerCase(),
        question: String(q.question || "").trim(),
        image: String(q.image || "").trim(),
        correctAnswerText: correct,
        wrongChoicesPool: wrongPool
      };
    }).filter(q =>
      q.genre !== "" &&
      q.question !== "" &&
      q.correctAnswerText !== "" &&
      q.wrongChoicesPool.length >= 3
    );

    if (allQuestions.length === 0) {
      throw new Error("有効な問題データが見つかりませんでした。");
    }

    buildGenreScreen();
    showScreen("genre-screen");

  } catch (err) {
    console.error("読み込みエラー:", err);
    document.getElementById("error-message").textContent =
      "データを取得できませんでした（" + err.message + "）";
    showScreen("error-screen");
  }
}

// ========================================
// ジャンル選択画面
// ========================================

function buildGenreScreen() {
  const genres = [...new Set(allQuestions.map(q => q.genre))];
  const list = document.getElementById("genre-list");
  list.innerHTML = "";

  genres.forEach(g => {
    const count = allQuestions.filter(q => q.genre === g).length;
    const btn = document.createElement("button");
    btn.className = "option-item";
    btn.innerHTML = `<span>${g}</span><span class="count">${count}問</span>`;
    btn.addEventListener("click", () => {
      currentGenre = g;
      buildDifficultyScreen();
      showScreen("difficulty-screen");
    });
    list.appendChild(btn);
  });
}

// ========================================
// 難易度選択
// ========================================

const DIFFICULTY_LABELS = {
  easy: "簡単",
  normal: "普通",
  hard: "難しい",
  challenge: "腕試し"
};

function buildDifficultyScreen() {
  document.getElementById("selected-genre-label").textContent = `ジャンル：${currentGenre}`;

  const pool = allQuestions.filter(q => q.genre === currentGenre);
  const difficulties = [...new Set(pool.map(q => q.difficulty))];

  const list = document.getElementById("difficulty-list");
  list.innerHTML = "";

  // 通常難易度
  difficulties.forEach(d => {
    const count = pool.filter(q => q.difficulty === d).length;
    const btn = document.createElement("button");
    btn.className = `option-item ${d}`;
    const label = DIFFICULTY_LABELS[d] || d;

    btn.innerHTML = `<span>${label}</span><span class="count">${count}問</span>`;
    btn.addEventListener("click", async () => {
      currentDifficulty = d;
      await startQuiz();
    });
    list.appendChild(btn);
  });

  // 腕試しボタン
  const challengePool = pool.filter(q => q.difficulty === "normal" || q.difficulty === "hard");
  if (challengePool.length > 0) {
    const cBtn = document.createElement("button");
    cBtn.className = "option-item challenge";
    const availableCount = Math.min(challengePool.length, CHALLENGE_QUESTION_COUNT);
    cBtn.innerHTML = `<span>腕試し</span><span class="count">${availableCount}問 / 制限時間10秒</span>`;
    cBtn.addEventListener("click", async () => {
      currentDifficulty = "challenge";
      await startQuiz();
    });
    list.appendChild(cBtn);
  }
}

// 戻るボタン
document.querySelector('[data-back="genre"]').addEventListener("click", () => {
  stopTimer();
  showScreen("genre-screen");
});

// ========================================
// クイズ開始
// ========================================

async function startQuiz() {
  stopTimer();

  let pool = [];
  let questionCount = QUESTIONS_PER_QUIZ;

  if (currentDifficulty === "challenge") {
    // 中級（normal）と上級（hard）から抽出
    pool = allQuestions.filter(
      q => q.genre === currentGenre && (q.difficulty === "normal" || q.difficulty === "hard")
    );
    questionCount = CHALLENGE_QUESTION_COUNT;
    lives = CHALLENGE_MAX_LIVES;
  } else {
    pool = allQuestions.filter(
      q => q.genre === currentGenre && q.difficulty === currentDifficulty
    );
  }

  quizQuestions = shuffle(pool).slice(0, questionCount);
  currentIndex = 0;
  score = 0;

  if (quizQuestions.length === 0) {
    alert("この条件の問題がありません。");
    showScreen("difficulty-screen");
    return;
  }

  // 出題対象全問の裏読み込みを開始
  preloadImages(quizQuestions);

  // 1問目に画像が存在する場合は、読み込み完了を待ってから画面を表示
  if (quizQuestions[0].image && quizQuestions[0].image.trim() !== "") {
    showScreen("loading");
    await preloadSingleImage(quizQuestions[0].image);
  }

  // 腕試し用UIの表示切り替え
  const livesEl = document.getElementById("quiz-lives");
  const timerEl = document.getElementById("quiz-timer");
  if (currentDifficulty === "challenge") {
    livesEl.style.display = "inline";
    timerEl.style.display = "inline";
    updateLivesUI();
  } else {
    livesEl.style.display = "none";
    timerEl.style.display = "none";
  }

  showScreen("quiz-screen");
  renderQuestion();
}

function updateLivesUI() {
  const livesEl = document.getElementById("quiz-lives");
  livesEl.textContent = "❤️".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, CHALLENGE_MAX_LIVES - lives));
}

// ========================================
// タイマー制御（腕試し用）
// ========================================

function startTimer() {
  stopTimer();
  timeLeft = CHALLENGE_TIME_LIMIT;
  const timerEl = document.getElementById("quiz-timer");
  timerEl.textContent = `⏱️ ${timeLeft}s`;

  timerId = setInterval(() => {
    timeLeft--;
    timerEl.textContent = `⏱️ ${timeLeft}s`;

    if (timeLeft <= 0) {
      stopTimer();
      handleTimeUp();
    }
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

// 時間切れ時の処理
function handleTimeUp() {
  const q = quizQuestions[currentIndex];
  const allBtns = document.querySelectorAll(".choice-btn");

  allBtns.forEach(b => {
    b.disabled = true;
    if (b.textContent.trim() === q.correctAnswerText) {
      b.classList.add("correct");
      b.innerHTML += ' <span class="mark">✓</span>';
    }
  });

  // ライフを1減らす
  lives--;
  updateLivesUI();

  if (lives <= 0) {
    setTimeout(() => {
      showResult(true);
    }, 1200);
  } else {
    document.getElementById("next-btn").disabled = false;
  }
}

// ========================================
// 問題表示
// ========================================

function renderQuestion() {
  const q = quizQuestions[currentIndex];

  // 次の問題の画像があれば先行してプリロードを実行
  if (currentIndex + 1 < quizQuestions.length) {
    const nextQ = quizQuestions[currentIndex + 1];
    if (nextQ.image && nextQ.image.trim() !== "") {
      preloadSingleImage(nextQ.image);
    }
  }

  document.getElementById("quiz-progress").textContent =
    `${currentIndex + 1} / ${quizQuestions.length}`;

  document.getElementById("quiz-score").textContent =
    `スコア: ${score}`;

  document.getElementById("progress-fill").style.width =
    `${(currentIndex / quizQuestions.length) * 100}%`;

  document.getElementById("quiz-tag").textContent =
    `${currentGenre} / ${DIFFICULTY_LABELS[currentDifficulty] || currentDifficulty}`;

  document.getElementById("question-text").textContent = q.question;

  // 画像表示
  const imageContainer = document.getElementById("image-container");
  const questionImage = document.getElementById("question-image");

  if (imageContainer && questionImage) {
    if (q.image && q.image !== "") {
      questionImage.src = q.image;
      imageContainer.style.display = "block";
    } else {
      questionImage.src = "";
      imageContainer.style.display = "none";
    }
  }

  const choicesEl = document.getElementById("choices");
  choicesEl.innerHTML = "";

  const nextBtn = document.getElementById("next-btn");
  nextBtn.disabled = true;

  const selectedWrongChoices = shuffle(q.wrongChoicesPool).slice(0, 3);
  const finalChoices = shuffle([q.correctAnswerText, ...selectedWrongChoices]);

  finalChoices.forEach(choiceText => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = choiceText;
    btn.addEventListener("click", () => selectAnswer(choiceText));
    choicesEl.appendChild(btn);
  });

  // 腕試しの場合はタイマースタート
  if (currentDifficulty === "challenge") {
    startTimer();
  }
}

// ========================================
// 回答処理
// ========================================

function selectAnswer(selectedChoiceText) {
  stopTimer();

  const q = quizQuestions[currentIndex];
  const allBtns = document.querySelectorAll(".choice-btn");

  allBtns.forEach(b => {
    b.disabled = true;
    const btnText = b.textContent.trim();
    if (btnText === q.correctAnswerText) {
      b.classList.add("correct");
      b.innerHTML += ' <span class="mark">✓</span>';
    } else if (btnText === selectedChoiceText) {
      b.classList.add("wrong");
      b.innerHTML += ' <span class="mark">✗</span>';
    }
  });

  if (selectedChoiceText === q.correctAnswerText) {
    score++;
    document.getElementById("quiz-score").textContent = `スコア: ${score}`;
  } else {
    if (currentDifficulty === "challenge") {
      lives--;
      updateLivesUI();
      if (lives <= 0) {
        setTimeout(() => {
          showResult(true);
        }, 1200);
        return;
      }
    }
  }

  document.getElementById("next-btn").disabled = false;
}

// ========================================
// 次の問題
// ========================================

document.getElementById("next-btn").addEventListener("click", () => {
  currentIndex++;
  if (currentIndex < quizQuestions.length) {
    renderQuestion();
  } else {
    showResult(false);
  }
});

// ========================================
// 結果画面
// ========================================

function showResult(isGameOver = false) {
  stopTimer();
  document.getElementById("progress-fill").style.width = "100%";
  document.getElementById("result-score").textContent = score;
  document.getElementById("result-total").textContent = quizQuestions.length;

  let msg = "";

  if (isGameOver) {
    document.querySelector("#result-screen .title").textContent = "ゲームオーバー";
    msg = "ライフがなくなってしまいました…！また挑戦してください！";
  } else {
    document.querySelector("#result-screen .title").textContent = "結果発表";
    const rate = score / quizQuestions.length;
    if (rate === 1) {
      msg = "完全制覇！素晴らしい腕前です！🎉";
    } else if (rate >= 0.8) {
      msg = "素晴らしい！上級レベルの実力です！✨";
    } else if (rate >= 0.5) {
      msg = "ナイスファイト！あと少しで合格点です！";
    } else {
      msg = "次はもっと頑張りましょう！";
    }
  }

  document.getElementById("result-message").textContent = msg;
  showScreen("result-screen");
}

// ========================================
// ボタンイベント
// ========================================

document.getElementById("retry-btn").addEventListener("click", startQuiz);
document.getElementById("home-btn").addEventListener("click", () => {
  stopTimer();
  showScreen("genre-screen");
});
document.getElementById("retry-load-btn").addEventListener("click", loadQuestions);

// ========================================
// 初期化
// ========================================

loadQuestions();