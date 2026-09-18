// ========================================
// 設定
// ========================================

// ローカル/GitHubリポジトリ内のJSONファイルパス
const QUESTIONS_JSON_URL = "./questions.json";

const QUESTIONS_PER_QUIZ = 10;


// ========================================
// 変数
// ========================================

let allQuestions = [];
let currentGenre = "";
let currentDifficulty = "";
let quizQuestions = [];
let currentIndex = 0;
let score = 0;


// ========================================
// 画面管理
// ========================================

const screens = {};

document.querySelectorAll(".screen").forEach(el => {
  screens[el.id] = el;
});


function showScreen(id) {
  Object.values(screens).forEach(s => {
    s.classList.remove("active");
  });

  if (screens[id]) {
    screens[id].classList.add("active");
  }
}


// ========================================
// JSONファイルから問題を読み込む
// ========================================

async function loadQuestions() {

  showScreen("loading");

  try {

    console.log("JSONから問題を取得中...");

    const res = await fetch(QUESTIONS_JSON_URL);

    if (!res.ok) {
      throw new Error("HTTPエラー: " + res.status);
    }

    const data = await res.json();

    console.log("取得したデータ:", data);


    // JSONデータをクイズ用の形式に変換
    allQuestions = data.map(q => ({

      genre: String(q.genre || "").trim(),

      difficulty: String(
        q.difficulty || ""
      ).trim().toLowerCase(),

      question: String(
        q.question || ""
      ).trim(),

      // 画像パスの取得（空文字や未定義の場合は空文字に）
      image: String(q.image || "").trim(),

      choices: [

        String(q.choice1 || "").trim(),

        String(q.choice2 || "").trim(),

        String(q.choice3 || "").trim(),

        String(q.choice4 || "").trim()

      ],

      answer: parseInt(q.answer, 10)

    })).filter(q =>

      q.genre !== "" &&

      q.question !== "" &&

      q.choices.every(choice => choice !== "") &&

      !isNaN(q.answer)

    );


    console.log(
      "読み込んだ問題数:",
      allQuestions.length
    );


    if (allQuestions.length === 0) {

      throw new Error(
        "問題が見つかりませんでした。questions.jsonの項目名を確認してください。"
      );

    }


    // ジャンル選択画面を作成
    buildGenreScreen();

    // ジャンル選択画面へ
    showScreen("genre-screen");


  } catch (err) {

    console.error("読み込みエラー:", err);

    document.getElementById(
      "error-message"
    ).textContent =
      "データを取得できませんでした（" +
      err.message +
      "）";

    showScreen("error-screen");

  }

}


// ========================================
// ジャンル選択画面
// ========================================

function buildGenreScreen() {

  const genres = [
    ...new Set(
      allQuestions.map(q => q.genre)
    )
  ];

  const list =
    document.getElementById("genre-list");

  list.innerHTML = "";


  genres.forEach(g => {

    const count =
      allQuestions.filter(
        q => q.genre === g
      ).length;


    const btn =
      document.createElement("button");

    btn.className = "option-item";


    btn.innerHTML =
      `<span>${g}</span>` +
      `<span class="count">${count}問</span>`;


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

  hard: "難しい"

};


function buildDifficultyScreen() {

  document.getElementById(
    "selected-genre-label"
  ).textContent =
    `ジャンル：${currentGenre}`;


  const pool =
    allQuestions.filter(
      q => q.genre === currentGenre
    );


  const difficulties =
    [
      ...new Set(
        pool.map(q => q.difficulty)
      )
    ];


  const list =
    document.getElementById(
      "difficulty-list"
    );


  list.innerHTML = "";


  difficulties.forEach(d => {

    const count =
      pool.filter(
        q => q.difficulty === d
      ).length;


    const btn =
      document.createElement("button");


    btn.className =
      `option-item ${d}`;


    const label =
      DIFFICULTY_LABELS[d] || d;


    btn.innerHTML =
      `<span>${label}</span>` +
      `<span class="count">${count}問</span>`;


    btn.addEventListener("click", () => {

      currentDifficulty = d;

      startQuiz();

    });


    list.appendChild(btn);

  });

}


// 戻るボタン

document
  .querySelector('[data-back="genre"]')
  .addEventListener("click", () => {

    showScreen("genre-screen");

  });


// ========================================
// 配列をシャッフル
// ========================================

function shuffle(arr) {

  const a = [...arr];

  for (let i = a.length - 1; i > 0; i--) {

    const j =
      Math.floor(Math.random() * (i + 1));

    [a[i], a[j]] = [a[j], a[i]];

  }

  return a;

}


// ========================================
// クイズ開始
// ========================================

function startQuiz() {

  const pool =
    allQuestions.filter(

      q =>

        q.genre === currentGenre &&

        q.difficulty === currentDifficulty

    );


  quizQuestions =
    shuffle(pool)
      .slice(0, QUESTIONS_PER_QUIZ);


  currentIndex = 0;

  score = 0;


  // 問題がない場合

  if (quizQuestions.length === 0) {

    alert("この条件の問題がありません。");

    showScreen("difficulty-screen");

    return;

  }


  showScreen("quiz-screen");

  renderQuestion();

}


// ========================================
// 問題表示（画像制御を追加）
// ========================================

function renderQuestion() {

  const q =
    quizQuestions[currentIndex];


  document.getElementById(
    "quiz-progress"
  ).textContent =
    `${currentIndex + 1} / ${quizQuestions.length}`;


  document.getElementById(
    "quiz-score"
  ).textContent =
    `スコア: ${score}`;


  document.getElementById(
    "progress-fill"
  ).style.width =
    `${(currentIndex / quizQuestions.length) * 100}%`;


  document.getElementById(
    "quiz-tag"
  ).textContent =
    `${currentGenre} / ${
      DIFFICULTY_LABELS[currentDifficulty]
      || currentDifficulty
    }`;


  document.getElementById(
    "question-text"
  ).textContent =
    q.question;


  // --- ★画像表示の制御処理★ ---
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
  // ------------------------------


  const choicesEl =
    document.getElementById("choices");


  choicesEl.innerHTML = "";


  const nextBtn =
    document.getElementById("next-btn");


  nextBtn.disabled = true;


  q.choices.forEach(
    (choiceText, i) => {

      const num = i + 1;


      const btn =
        document.createElement("button");


      btn.className = "choice-btn";


      btn.textContent =
        choiceText;


      btn.addEventListener(
        "click",
        () => selectAnswer(num)
      );


      choicesEl.appendChild(btn);

    }

  );

}


// ========================================
// 回答処理
// ========================================

function selectAnswer(selectedNum) {

  const q =
    quizQuestions[currentIndex];


  const allBtns =
    document.querySelectorAll(
      ".choice-btn"
    );


  // すべてのボタンを無効化

  allBtns.forEach(b => {
    b.disabled = true;
  });


  allBtns.forEach((b, i) => {

    const num = i + 1;


    if (num === q.answer) {

      b.classList.add("correct");

      b.innerHTML +=
        ' <span class="mark">✓</span>';

    }

    else if (num === selectedNum) {

      b.classList.add("wrong");

      b.innerHTML +=
        ' <span class="mark">✗</span>';

    }

  });


  // 正解ならスコア追加

  if (selectedNum === q.answer) {

    score++;


    document.getElementById(
      "quiz-score"
    ).textContent =
      `スコア: ${score}`;

  }


  document.getElementById(
    "next-btn"
  ).disabled = false;

}


// ========================================
// 次の問題
// ========================================

document
  .getElementById("next-btn")
  .addEventListener("click", () => {

    currentIndex++;


    if (
      currentIndex <
      quizQuestions.length
    ) {

      renderQuestion();

    }

    else {

      showResult();

    }

  });


// ========================================
// 結果画面
// ========================================

function showResult() {

  document.getElementById(
    "progress-fill"
  ).style.width = "100%";


  document.getElementById(
    "result-score"
  ).textContent =
    score;


  document.getElementById(
    "result-total"
  ).textContent =
    quizQuestions.length;


  const rate =
    score / quizQuestions.length;


  let msg;


  if (rate === 1) {

    msg =
      "パーフェクト！素晴らしい！";

  }

  else if (rate >= 0.8) {

    msg =
      "とても良い成績です！";

  }

  else if (rate >= 0.5) {

    msg =
      "まずまずの結果です！";

  }

  else {

    msg =
      "次はもっと頑張りましょう！";

  }


  document.getElementById(
    "result-message"
  ).textContent =
    msg;


  showScreen("result-screen");

}


// ========================================
// ボタン
// ========================================

document
  .getElementById("retry-btn")
  .addEventListener(
    "click",
    startQuiz
  );


document
  .getElementById("home-btn")
  .addEventListener("click", () => {

    showScreen("genre-screen");

  });


document
  .getElementById("retry-load-btn")
  .addEventListener(
    "click",
    loadQuestions
  );


// ========================================
// 初期化
// ========================================

loadQuestions();