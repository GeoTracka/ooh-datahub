"use client";

import { useEffect } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isTabbable(element: HTMLElement): boolean {
  if (element.closest("[hidden], [aria-hidden='true']")) return false;
  const closedDetails = element.closest("details:not([open])");
  if (closedDetails && element.tagName !== "SUMMARY") return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

export function ModalFocusContainment() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
      );
      const dialog = dialogs.at(-1);
      if (!dialog) return;

      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(isTabbable);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items.at(-1)!;
      const active = document.activeElement;
      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
