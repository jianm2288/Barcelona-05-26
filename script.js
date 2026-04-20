const tabs = document.querySelectorAll(".day-tab");
const panels = document.querySelectorAll(".day-panel");

function activateDay(dayId) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.day === dayId;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === dayId);
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateDay(tab.dataset.day));
});
