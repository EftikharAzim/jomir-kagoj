function revealFeedback(exercise, message, state) {
  const feedback = exercise.querySelector(".feedback");
  feedback.dataset.state = state;
  feedback.replaceChildren(document.createTextNode(message));
  if (exercise.id === "receipt-review" && state === "correct") {
    try { localStorage.setItem("jomir.receipt-reviewed", "1"); } catch {}
  }
}

for (const link of document.querySelectorAll("a[data-term]")) {
  const note = document.getElementById("term-" + link.dataset.term);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "inline-term";
  button.textContent = link.textContent;
  button.setAttribute("aria-controls", note.id);
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", () => {
    note.hidden = !note.hidden;
    button.setAttribute("aria-expanded", String(!note.hidden));
  });
  link.replaceWith(button);
}

const slug = document.querySelector("[data-lesson]")?.dataset.lesson;

function readSaved(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch { return null; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

if (slug) {
  const sections = [...document.querySelectorAll("main > .lesson-section[id]")];
  let lastSection;
  function remember(section) {
    if (!section || section === lastSection) return;
    lastSection = section;
    save("jomir.section." + slug, { id: section.id, title: section.querySelector("h2").textContent });
  }
  function recordScroll() {
    const readingLine = Math.min(innerHeight / 3, 240);
    remember(sections.filter(el => el.getBoundingClientRect().top <= readingLine).pop());
  }
  let pending;
  window.addEventListener("scroll", () => {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; recordScroll(); });
  }, { passive: true });
  window.addEventListener("pagehide", () => { if (pending) recordScroll(); });
  document.addEventListener("input", event => remember(event.target.closest(".lesson-section[id]")));
  document.addEventListener("click", event => {
    const link = event.target.closest(".lesson-contents a");
    remember(link ? document.getElementById(link.hash.slice(1)) : event.target.closest(".lesson-section[id]"));
  });
}

function updateReadingPlace() {
  const resume = document.querySelector("[data-resume]");
  if (!slug && !resume) return;
  const today = new Date();
  const localDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  try {
    if (slug) {
      localStorage.setItem("jomir.last-lesson", slug);
      const starters = ["dag", "khatian", "documents"];
      if (starters.includes(slug)) {
        localStorage.setItem("jomir.seen." + slug, "1");
        if (!localStorage.getItem("jomir.review-after") && starters.every(id => localStorage.getItem("jomir.seen." + id))) {
          localStorage.setItem("jomir.review-after", String(localDay));
        }
      }
      return;
    }
    const last = localStorage.getItem("jomir.last-lesson");
    const lesson = [...document.querySelectorAll("[data-lesson-link]")].find(link => link.dataset.lessonLink === last);
    if (lesson) {
      const section = readSaved("jomir.section." + last);
      const hasSection = typeof section?.title === "string" && /^[a-z0-9-]+$/.test(section.id);
      resume.href = lesson.href + (hasSection ? "#" + section.id : "");
      resume.textContent = "চালিয়ে যান · পাঠ " + lesson.querySelector(".number").textContent +
        (hasSection ? " · " + section.title : "");
    }
    const due = localStorage.getItem("jomir.review-after");
    document.querySelector("[data-due-review]").hidden = !(due && localDay > Number(due) && !localStorage.getItem("jomir.receipt-reviewed"));
  } catch {
    // Browsing and exercises also work when the browser blocks device storage.
  }
}
window.addEventListener("pageshow", updateReadingPlace);

function checkChoice(exercise, choice) {
  const correct = choice === exercise.dataset.expected;
  revealFeedback(exercise, correct ? exercise.dataset.answer : exercise.dataset.hint, correct ? "correct" : "retry");
}

function normalizeNumber(value) {
  const digits = "০১২৩৪৫৬৭৮৯";
  const normalized = value.trim().replace(/[০-৯]/g, digit => String(digits.indexOf(digit)));
  return /^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/.test(normalized)
    ? Number(normalized.replaceAll(",", ""))
    : NaN;
}

function checkFields(exercise, focusError) {
  const fields = [...exercise.querySelectorAll("input[data-expected]")];
  for (const field of fields) field.removeAttribute("aria-invalid");
  const wrong = fields.find(field => normalizeNumber(field.value) !== Number(field.dataset.expected));
  if (wrong) {
    wrong.setAttribute("aria-invalid", "true");
    if (focusError) wrong.focus();
  }
  revealFeedback(exercise, wrong ? wrong.dataset.hint : exercise.dataset.answer, wrong ? "retry" : "correct");
}

function markMap(buttons, selected) {
  for (const option of buttons) {
    option.classList.toggle("is-chosen", option === selected);
    option.setAttribute("aria-pressed", String(option === selected));
  }
}

for (const exercise of document.querySelectorAll("[data-exercise]")) {
  exercise.hidden = false;
  const key = "jomir.exercise." + slug + "." + exercise.id;
  const draft = slug ? readSaved(key) : null;

  if (exercise.dataset.exercise === "map") {
    const buttons = exercise.querySelectorAll("[data-choice]");
    const selected = [...buttons].find(button => button.dataset.choice === draft?.choice);
    if (selected) {
      markMap(buttons, selected);
      checkChoice(exercise, selected.dataset.choice);
    }
    for (const button of buttons) {
      button.addEventListener("click", () => {
        markMap(buttons, button);
        if (slug) save(key, { choice: button.dataset.choice });
        checkChoice(exercise, button.dataset.choice);
      });
    }
    continue;
  }

  function grade(focusError) {
    if (exercise.dataset.exercise === "choices") {
      checkChoice(exercise, new FormData(exercise).get("answer"));
      return;
    }

    checkFields(exercise, focusError);
  }
  if (draft?.values && typeof draft.values === "object") {
    for (const field of exercise.querySelectorAll("input")) {
      const value = draft.values[field.name];
      if (typeof value !== "string") continue;
      if (field.type === "radio") field.checked = field.value === value;
      else field.value = value;
    }
    if (draft.submitted) grade(false);
  }
  function saveForm(submitted) {
    if (slug) save(key, { values: Object.fromEntries(new FormData(exercise)), submitted });
  }
  exercise.addEventListener("input", () => {
    saveForm(false);
    const feedback = exercise.querySelector(".feedback");
    feedback.textContent = "";
    delete feedback.dataset.state;
    for (const field of exercise.querySelectorAll("[aria-invalid]")) field.removeAttribute("aria-invalid");
  });
  exercise.addEventListener("submit", event => {
    event.preventDefault();
    saveForm(true);
    grade(true);
  });
}

const glossarySearch = document.querySelector(".glossary-search");
if (glossarySearch) {
  glossarySearch.hidden = false;
  const input = glossarySearch.querySelector("input");
  const clear = glossarySearch.querySelector("button");
  const status = glossarySearch.querySelector("[role=status]");
  const groups = [...document.querySelectorAll(".glossary .lesson-section")];
  function normalizeWord(value) {
    return value.normalize("NFC").replace(/[.\s\u200c\u200d]+/g, "").toLowerCase();
  }
  function filterWords() {
    const query = normalizeWord(input.value);
    let count = 0;
    for (const group of groups) {
      let matches = 0;
      for (const term of group.querySelectorAll("dt")) {
        const match = normalizeWord(term.textContent).includes(query);
        term.parentElement.hidden = !match;
        if (match) matches++;
      }
      group.hidden = matches === 0;
      count += matches;
    }
    document.querySelector(".glossary-nav").hidden = !!query;
    clear.hidden = !input.value;
    status.textContent = !query ? "" : count ? count.toLocaleString("bn-BD") + "টি শব্দ পাওয়া গেছে।" : "শব্দটি পাওয়া যায়নি। কম অক্ষর দিয়ে খুঁজুন।";
  }
  input.addEventListener("input", filterWords);
  clear.addEventListener("click", () => { input.value = ""; filterWords(); input.focus(); });
  window.addEventListener("pageshow", filterWords);
}
for (const select of document.querySelectorAll(".land-scale select")) {
  const figure = select.closest(".land-scale");
  const grid = figure.querySelector(".acre-grid");
  let previousArea;
  const describe = () => {
    const option = select.selectedOptions[0];
    const area = Number(option.dataset.cols) * Number(option.dataset.rows);
    grid.classList.toggle("same-area", area === previousArea);
    previousArea = area;
    grid.style.setProperty("--plot-width", Number(option.dataset.cols) * 10 + "%");
    grid.style.setProperty("--plot-height", Number(option.dataset.rows) * 10 + "%");
    figure.querySelector("[aria-live]").textContent = option.dataset.note;
  };
  select.parentElement.hidden = false;
  select.addEventListener("change", describe);
  describe();
}

for (const controls of document.querySelectorAll(".boundary-controls")) {
  const figure = controls.closest(".pond-figure");
  const buttons = controls.querySelectorAll("[data-edge]");
  const notes = {
    road: "দুই ছবিতেই টিক দেওয়া তিন ফালির পশ্চিম ধার রাস্তা ছোঁয়। শুধু এই সূত্রে দুটির মধ্যে বেছে নেওয়া যায় না।",
    pond: "বাঁয়ে টানা রেখার ওপাশে পুকুর। ডানে ভাঙা রেখার ওপাশে ক ফালি। ‘উত্তরে পুকুর’ তাই বাঁয়ের ক, খ, গ ফালির সঙ্গে মেলে।",
  };
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const edge = figure.dataset.edge === button.dataset.edge ? "" : button.dataset.edge;
      figure.dataset.edge = edge;
      for (const other of buttons) other.setAttribute("aria-pressed", String(other.dataset.edge === edge));
      controls.querySelector("[role=status]").textContent = notes[edge] || "";
    });
  }
  controls.hidden = false;
}
