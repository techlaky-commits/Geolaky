"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // installation du PWA non bloquante si le service worker echoue
      });
    }
  }, []);

  return null;
}
