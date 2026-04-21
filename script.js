const tabs = document.querySelectorAll(".day-tab");
const panels = document.querySelectorAll(".day-panel");

function activateDay(dayId) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.day === dayId;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  panels.forEach((panel) => {
    const isActive = panel.id === dayId;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateDay(tab.dataset.day));
  tab.addEventListener("keydown", (event) => {
    const currentIndex = Array.from(tabs).indexOf(tab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    activateDay(nextTab.dataset.day);
    nextTab.focus();
  });
});

if (tabs.length > 0) {
  activateDay(document.querySelector(".day-tab.active")?.dataset.day ?? tabs[0].dataset.day);
}
