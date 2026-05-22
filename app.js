const form = document.querySelector("#quiz-form");
const sourceText = document.querySelector("#source-text");
const sourceTitle = document.querySelector("#source-title");
const studentName = document.querySelector("#student-name");
const studentEmail = document.querySelector("#student-email");
const pdfFile = document.querySelector("#pdf-file");
const pdfStatus = document.querySelector("#pdf-status");
const sampleBtn = document.querySelector("#sample-btn");
const quizArea = document.querySelector("#quiz-area");
const quizTitle = document.querySelector("#quiz-title");
const studentPill = document.querySelector("#student-pill");
const questionsEl = document.querySelector("#questions");
const scoreBtn = document.querySelector("#score-btn");
const resetBtn = document.querySelector("#reset-btn");
const scoreOutput = document.querySelector("#score-output");
const tabs = Array.from(document.querySelectorAll(".tab"));

let quiz = {
  easy: [],
  medium: [],
  hard: []
};
let activeLevel = "easy";

const sampleSource = `Photosynthesis is the process by which green plants use sunlight to make food. Chlorophyll in the leaves captures light energy. Plants take in carbon dioxide from the air and water from the soil. During photosynthesis, glucose and oxygen are produced. Glucose gives the plant energy for growth, while oxygen is released into the atmosphere. Photosynthesis is important because it supports plant life and provides oxygen for animals and humans.`;

sampleBtn.addEventListener("click", () => {
  sourceTitle.value = "Photosynthesis";
  sourceText.value = sampleSource;
});

pdfFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  pdfStatus.textContent = "Reading PDF...";
  try {
    const text = await extractPdfText(file);
    sourceText.value = text.trim();
    sourceTitle.value ||= file.name.replace(/\.pdf$/i, "");
    pdfStatus.textContent = `Loaded ${file.name}`;
  } catch (error) {
    pdfStatus.textContent = "Could not read this PDF. Please paste the text instead.";
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = sourceText.value.trim();
  if (text.length < 80) {
    sourceText.setCustomValidity("Please add at least a short paragraph so Quizerr can build useful questions.");
    sourceText.reportValidity();
    return;
  }

  sourceText.setCustomValidity("");
  quiz = buildQuiz(text);
  activeLevel = "easy";
  quizTitle.textContent = sourceTitle.value.trim() || "Questions";
  studentPill.textContent = `${studentName.value.trim()} | ${studentEmail.value.trim()}`;
  quizArea.classList.remove("hidden");
  setActiveTab("easy");
  quizArea.scrollIntoView({ behavior: "smooth", block: "start" });
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTab(tab.dataset.level);
  });
});

scoreBtn.addEventListener("click", () => {
  const levelQuestions = quiz[activeLevel];
  let correct = 0;

  levelQuestions.forEach((question) => {
    const checked = document.querySelector(`input[name="${question.id}"]:checked`);
    if (checked && Number(checked.value) === question.answerIndex) {
      correct += 1;
    }
  });

  document.querySelectorAll(".question-card").forEach((card) => {
    card.classList.add("show-answer");
  });

  scoreOutput.textContent = `${activeLevelLabel(activeLevel)} score: ${correct}/${levelQuestions.length}`;
});

resetBtn.addEventListener("click", () => {
  quizArea.classList.add("hidden");
  form.reset();
  scoreOutput.textContent = "";
  pdfStatus.textContent = "Or paste your source below.";
  window.scrollTo({ top: 0, behavior: "smooth" });
});

async function extractPdfText(file) {
  const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str).join(" "));
  }

  return pageTexts.join("\n");
}

function buildQuiz(text) {
  const sentences = splitSentences(text);
  const keywords = getKeywords(text);
  const sourceConcept = keywords[0] || "this topic";
  const usableSentences = normalizeSentences(sentences, text);

  return {
    easy: createEasyQuestions(usableSentences, keywords, sourceConcept),
    medium: createMediumQuestions(usableSentences, keywords, sourceConcept),
    hard: createHardQuestions(usableSentences, keywords, sourceConcept)
  };
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 35);
}

function expandSentences(sentences, text) {
  if (sentences.length) {
    return sentences;
  }

  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 35);
}

function normalizeSentences(sentences, text) {
  const expanded = sentences.length >= 6 ? sentences : expandSentences(sentences, text);
  if (expanded.length) {
    return expanded;
  }

  return [`The source explains ${text.slice(0, 140).trim()}.`];
}

function getKeywords(text) {
  const stopWords = new Set([
    "about", "above", "after", "again", "also", "because", "before", "being", "between",
    "could", "during", "every", "from", "have", "into", "more", "most", "other", "over",
    "should", "such", "than", "that", "their", "there", "these", "this", "through", "under",
    "using", "were", "when", "where", "which", "while", "with", "would", "your", "they"
  ]);

  const counts = {};
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !stopWords.has(word))
    .forEach((word) => {
      counts[word] = (counts[word] || 0) + 1;
    });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => titleCase(word));
}

function createEasyQuestions(sentences, keywords, concept) {
  return takeQuestions([
    makeQuestion("easy", `What is one important idea mentioned about ${concept}?`, sentenceOptions(sentences, 0)),
    makeQuestion("easy", `Which term appears most closely related to the source?`, keywordOptions(keywords, 0)),
    makeQuestion("easy", "Which statement is supported by the source?", sentenceOptions(sentences, 1))
  ], "easy");
}

function createMediumQuestions(sentences, keywords, concept) {
  return takeQuestions([
    makeQuestion("medium", `What best explains how ${concept} is described in the source?`, sentenceOptions(sentences, 2)),
    makeQuestion("medium", `Which concept should be reviewed to understand ${concept} better?`, keywordOptions(keywords, 1)),
    makeQuestion("medium", "Which detail connects two ideas from the source?", sentenceOptions(sentences, 3))
  ], "medium");
}

function createHardQuestions(sentences, keywords, concept) {
  return takeQuestions([
    makeQuestion("hard", `What conclusion can be drawn from the source about ${concept}?`, inferenceOptions(sentences, 0)),
    makeQuestion("hard", "Which answer requires the strongest understanding of the source?", inferenceOptions(sentences, 1)),
    makeQuestion("hard", `If ${concept} changed, which source detail would most likely be affected first?`, sentenceOptions(sentences, 4))
  ], "hard");
}

function sentenceOptions(sentences, answerIndex) {
  const answer = sentences[answerIndex % sentences.length];
  const distractors = [
    "The source does not provide enough information to answer this.",
    "This detail is unrelated to the main source material.",
    "The opposite of the source statement is true."
  ];

  return shuffleOptions([answer, ...distractors]);
}

function keywordOptions(keywords, answerIndex) {
  const answer = keywords[answerIndex % Math.max(keywords.length, 1)] || "Main idea";
  const options = [answer, "Random choice", "Unrelated fact", "Personal opinion"];
  return shuffleOptions(options);
}

function inferenceOptions(sentences, answerIndex) {
  const answer = sentences[answerIndex % sentences.length];
  const trimmed = answer.replace(/\.$/, "");
  const options = [
    `A reasonable conclusion is that ${trimmed.toLowerCase()}.`,
    "The source is mainly asking for a personal preference.",
    "The source proves that no further explanation is needed.",
    "The source is unrelated to the topic being studied."
  ];

  return shuffleOptions(options);
}

function makeQuestion(level, prompt, optionData) {
  return {
    id: `${level}-${crypto.randomUUID()}`,
    level,
    prompt,
    options: optionData.options,
    answerIndex: optionData.answerIndex
  };
}

function shuffleOptions(options) {
  const tagged = options.map((text, index) => ({ text, correct: index === 0 }));
  for (let index = tagged.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [tagged[index], tagged[swapIndex]] = [tagged[swapIndex], tagged[index]];
  }

  return {
    options: tagged.map((option) => option.text),
    answerIndex: tagged.findIndex((option) => option.correct)
  };
}

function takeQuestions(questions, level) {
  return questions.map((question, index) => ({
    ...question,
    id: `${level}-${index}`
  }));
}

function setActiveTab(level) {
  activeLevel = level;
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.level === level);
  });
  scoreOutput.textContent = "";
  renderQuestions(level);
}

function renderQuestions(level) {
  const levelQuestions = quiz[level] || [];
  questionsEl.innerHTML = levelQuestions.map((question, questionIndex) => `
    <article class="question-card ${level}">
      <h3>${questionIndex + 1}. ${escapeHtml(question.prompt)}</h3>
      ${question.options.map((option, optionIndex) => `
        <label class="option">
          <input type="radio" name="${question.id}" value="${optionIndex}">
          <span>${escapeHtml(option)}</span>
        </label>
      `).join("")}
      <p class="answer-note">Answer: ${escapeHtml(question.options[question.answerIndex])}</p>
    </article>
  `).join("");
}

function activeLevelLabel(level) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function titleCase(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
