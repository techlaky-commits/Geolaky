"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CompassState = {
  // 0-360, 0 = Nord, sens horaire (cap boussole). Null tant qu'aucune lecture
  // n'a ete recue.
  heading: number | null;
  // true si la lecture est reellement referencee au nord magnetique/vrai
  // (iOS webkitCompassHeading, ou Android "deviceorientationabsolute").
  // false = lecture relative seulement (peut deriver), l'UI doit l'indiquer
  // plutot que de laisser croire a une precision qu'on n'a pas.
  absolute: boolean;
  // null = verification en cours, true = capteur actif, false = aucune
  // donnee recue apres le delai d'attente (capteur absent/navigateur non
  // supporte/permission refusee).
  supported: boolean | null;
};

// Lissage par moyenne circulaire (vecteur unitaire) : evite le bruit du
// magnetometre ET le saut 359deg -> 0deg qu'une moyenne lineaire naive
// produirait au passage du Nord.
const SMOOTHING = 0.15;
const SUPPORT_TIMEOUT_MS = 3000;

type IOSDeviceOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

export function useCompassHeading() {
  const [state, setState] = useState<CompassState>({ heading: null, absolute: false, supported: null });
  const smoothedVector = useRef<{ x: number; y: number } | null>(null);
  const rafPending = useRef(false);
  const latestSample = useRef<{ heading: number; absolute: boolean } | null>(null);

  const applySample = useCallback((rawHeading: number, absolute: boolean) => {
    const screenAngle =
      typeof screen !== "undefined" && screen.orientation && typeof screen.orientation.angle === "number"
        ? screen.orientation.angle
        : 0;
    const corrected = ((rawHeading + screenAngle) % 360 + 360) % 360;

    const rad = (corrected * Math.PI) / 180;
    const sample = { x: Math.sin(rad), y: Math.cos(rad) };
    const prev = smoothedVector.current;
    const next = prev
      ? { x: prev.x + (sample.x - prev.x) * SMOOTHING, y: prev.y + (sample.y - prev.y) * SMOOTHING }
      : sample;
    smoothedVector.current = next;
    const smoothedDeg = ((Math.atan2(next.x, next.y) * 180) / Math.PI + 360) % 360;

    latestSample.current = { heading: smoothedDeg, absolute };
    if (!rafPending.current) {
      rafPending.current = true;
      requestAnimationFrame(() => {
        rafPending.current = false;
        if (latestSample.current) {
          setState({ heading: latestSample.current.heading, absolute: latestSample.current.absolute, supported: true });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setState((s) => ({ ...s, supported: false }));
      return;
    }

    function handleOrientation(event: Event) {
      const iosEvent = event as IOSDeviceOrientationEvent;
      if (typeof iosEvent.webkitCompassHeading === "number") {
        applySample(iosEvent.webkitCompassHeading, true);
        return;
      }
      const orientationEvent = event as DeviceOrientationEvent;
      if (orientationEvent.alpha === null) return;
      const absolute = "absolute" in event ? Boolean((event as { absolute?: boolean }).absolute) : false;
      applySample((360 - orientationEvent.alpha) % 360, absolute);
    }

    // Un seul canal a la fois : Android expose "deviceorientationabsolute"
    // (reference vraie), iOS ne l'expose jamais (webkitCompassHeading passe
    // par l'evenement standard). Ecouter les deux ferait doublon.
    const hasAbsolute = "ondeviceorientationabsolute" in window;
    const eventName = hasAbsolute ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(eventName, handleOrientation);

    const timeout = setTimeout(() => {
      setState((s) => (s.heading === null ? { ...s, supported: false } : s));
    }, SUPPORT_TIMEOUT_MS);

    return () => {
      window.removeEventListener(eventName, handleOrientation);
      clearTimeout(timeout);
    };
  }, [applySample]);

  // Sur iOS 13+, l'acces aux capteurs d'orientation exige un accord explicite
  // demande depuis un geste utilisateur (bouton). Sur les autres plateformes,
  // il n'existe pas d'API de permission dediee : l'ecoute demarre directement.
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const DOE = (typeof window !== "undefined" ? window.DeviceOrientationEvent : undefined) as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> })
      | undefined;
    if (typeof DOE?.requestPermission === "function") {
      try {
        const result = await DOE.requestPermission();
        return result === "granted";
      } catch {
        return false;
      }
    }
    return true;
  }, []);

  return { ...state, requestPermission };
}
