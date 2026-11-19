// ---------- Haptics: a light "tick" under the finger ----------
//
// Android (and other browsers with the Vibration API): a short vibration.
// iPhone: Safari has no Vibration API, but since iOS 18 it plays the system haptic when a switch control
// (<input type="checkbox" switch>) is toggled — so a hidden switch is toggled through its label. Older iPhones and
// desktops simply do nothing. Best effort only: it never throws, and nothing depends on it.

let iosLabel: HTMLLabelElement | null = null;

function iosSwitchLabel(): HTMLLabelElement | null {
  if (iosLabel?.isConnected) return iosLabel;
  if (typeof document === "undefined" || !document.body) return null;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.id = "rozfit-haptic-switch";
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  const label = document.createElement("label");
  label.htmlFor = input.id;
  label.setAttribute("aria-hidden", "true");
  for (const element of [input, label]) {
    Object.assign(element.style, { position: "fixed", left: "-9999px", top: "0", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
    document.body.appendChild(element);
  }
  iosLabel = label;
  return label;
}

/** A light tick, e.g. when a picker moves to the next value. `strong` for confirmations (rest finished). */
export function haptic(kind: "tick" | "strong" = "tick"): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function" && navigator.vibrate(kind === "tick" ? 8 : [30, 40, 30])) return;
  } catch { /* fall through */ }
  try {
    const label = iosSwitchLabel();
    label?.click();
    if (kind === "strong") window.setTimeout(() => label?.click(), 90);
  } catch { /* haptics are optional */ }
}
