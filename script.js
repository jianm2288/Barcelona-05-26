const tabs = document.querySelectorAll(".day-tab");
const panels = document.querySelectorAll(".day-panel");
const destinationCards = document.querySelectorAll(".destination-card");
const routeLinks = document.querySelectorAll(".route-link");
const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isCompactDayLayout = window.matchMedia("(max-width: 1024px)");

function activateDay(dayId) {
  if (!dayId) {
    return;
  }

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
    destinationCards.forEach((card) => {
      card.classList.remove("is-focused");
    });
    return;
  }

  destinationCards.forEach((card) => {
    card.classList.toggle("is-focused", card.id === targetId);
  });
}

function revealDayPanel(dayId) {
  if (!dayId || !isCompactDayLayout.matches) {
    return;
  }

  const panel = document.getElementById(dayId);
  if (!panel) {
    return;
  }

  requestAnimationFrame(() => {
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function handleDayTabSelection(tab, event) {
  if (!tab) {
    return;
  }

  if (event) {
    event.preventDefault();
  }

  const dayId = tab.dataset.day;
  activateDay(dayId);
  revealDayPanel(dayId);

  if (window.location.hash !== `#${dayId}`) {
    history.replaceState(null, "", `#${dayId}`);
  }
}

function syncFromHash() {
  const hashId = window.location.hash.replace("#", "");
  const hashMatchesDay = panels.some((panel) => panel.id === hashId);

  if (hashMatchesDay) {
    activateDay(hashId);
    focusDestinationCard("");
    revealDayPanel(hashId);
    return;
  }

  if (tabs.length > 0) {
    activateDay(document.querySelector(".day-tab.active")?.dataset.day ?? tabs[0].dataset.day);
  }

  focusDestinationCard(hashId);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", (event) => handleDayTabSelection(tab, event));
  tab.addEventListener("touchend", (event) => handleDayTabSelection(tab, event), { passive: false });
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
    revealDayPanel(nextTab.dataset.day);
    history.replaceState(null, "", `#${nextTab.dataset.day}`);
    nextTab.focus();
  });
});

document.querySelectorAll(".inline-destination-link").forEach((link) => {
  link.addEventListener("click", () => {
    const targetId = link.dataset.destinationTarget;
    focusDestinationCard(targetId);
  });
});

window.addEventListener("hashchange", syncFromHash);
syncFromHash();

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
