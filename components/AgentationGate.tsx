"use client";

import { useEffect, useState } from "react";
import { Agentation } from "agentation";

// Agentation's global pointer interceptors block the sheet's drag gesture,
// so it's gated behind `?annotate=1` in the URL — visit the app with that
// query param when you actually want to annotate.
export function AgentationGate() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setEnabled(params.get("annotate") === "1");
  }, []);

  if (!enabled) return null;
  return <Agentation />;
}
