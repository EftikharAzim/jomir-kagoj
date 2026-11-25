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

function updateReadingPlace() {
  const slug = document.querySelector("[data-lesson]")?.dataset.lesson;
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
      resume.href = lesson.href;
      resume.textContent = "যেখান থেকে পড়ছিলেন · পাঠ " + lesson.querySelector(".number").textContent;
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

for (const exercise of document.querySelectorAll("[data-exercise]")) {
  exercise.hidden = false;

  if (exercise.dataset.exercise === "map") {
    const buttons = exercise.querySelectorAll("[data-choice]");
    for (const button of buttons) {
      button.addEventListener("click", () => {
        for (const option of buttons) {
          const selected = option === button;
          option.classList.toggle("is-chosen", selected);
          option.setAttribute("aria-pressed", String(selected));
        }
        checkChoice(exercise, button.dataset.choice);
      });
    }
    continue;
  }

  exercise.addEventListener("submit", event => {
    event.preventDefault();
    if (exercise.dataset.exercise === "choices") {
      checkChoice(exercise, new FormData(exercise).get("answer"));
      return;
    }

    for (const field of exercise.querySelectorAll("[data-expected]")) {
      field.removeAttribute("aria-invalid");
    }
    const wrongField = [...exercise.querySelectorAll("[data-expected]")].find(field =>
      normalizeNumber(field.value) !== Number(field.dataset.expected)
    );
    if (wrongField) {
      wrongField.setAttribute("aria-invalid", "true");
      wrongField.focus();
      revealFeedback(exercise, wrongField.dataset.hint, "retry");
      return;
    }
    revealFeedback(exercise, exercise.dataset.answer, "correct");
  });
}
for (const select of document.querySelectorAll(".land-scale select")) {
  const figure = select.closest(".land-scale");
  const grid = figure.querySelector(".acre-grid");
  const describe = () => {
    const option = select.selectedOptions[0];
    grid.style.setProperty("--plot-width", Number(option.dataset.cols) * 10 + "%");
    grid.style.setProperty("--plot-height", Number(option.dataset.rows) * 10 + "%");
    figure.querySelector("[aria-live]").textContent = option.dataset.note;
  };
  select.parentElement.hidden = false;
  select.addEventListener("change", describe);
  describe();
}
