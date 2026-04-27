const tabs = document.querySelectorAll(".day-tab");
const panels = document.querySelectorAll(".day-panel");
const destinationCards = document.querySelectorAll(".destination-card");
const routeLinks = document.querySelectorAll(".route-link");
const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);

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

function focusDestinationCard(targetId) {
  if (!targetId) {
    return;
  }

  destinationCards.forEach((card) => {
    card.classList.toggle("is-focused", card.id === targetId);
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

document.querySelectorAll(".inline-destination-link").forEach((link) => {
  link.addEventListener("click", () => {
    const targetId = link.dataset.destinationTarget;
    focusDestinationCard(targetId);
  });
});

window.addEventListener("hashchange", () => {
  focusDestinationCard(window.location.hash.replace("#", ""));
});

if (window.location.hash) {
  focusDestinationCard(window.location.hash.replace("#", ""));
}

routeLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    if (!isAppleMobile) {
      return;
    }

    const appleHref = link.dataset.appleHref;
    if (!appleHref) {
      return;
    }

    event.preventDefault();
    window.location.href = appleHref;
  });
});
