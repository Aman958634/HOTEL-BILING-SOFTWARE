import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const isVisible = (element) => {
  if (!element || element.disabled || element.getAttribute("aria-hidden") === "true" || element.getAttribute("aria-disabled") === "true") return false;
  const style = window.getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none" && element.getClientRects().length > 0;
};

export const isEditableOrderControl = (element) => {
  if (!element || element.dataset.orderArrowNav === "true") return false;
  const tag = String(element.tagName || "").toLowerCase();
  return tag === "input" || tag === "select" || tag === "textarea" || Boolean(element.isContentEditable);
};

const centre = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

// Prefer the nearest control in the requested direction, then favour controls
// that share a row/column. This keeps navigation useful as responsive grids
// change from multiple columns to a single column.
export const findSpatialTarget = (current, candidates, direction) => {
  const currentRect = current.getBoundingClientRect();
  const currentCentre = centre(currentRect);
  const horizontal = direction === "ArrowLeft" || direction === "ArrowRight";
  const sign = direction === "ArrowLeft" || direction === "ArrowUp" ? -1 : 1;

  return candidates
    .filter((candidate) => candidate !== current)
    .map((candidate) => ({ candidate, rect: candidate.getBoundingClientRect() }))
    .filter(({ rect }) => {
      const candidateCentre = centre(rect);
      const delta = horizontal ? candidateCentre.x - currentCentre.x : candidateCentre.y - currentCentre.y;
      return sign * delta > 2;
    })
    .map(({ candidate, rect }) => {
      const candidateCentre = centre(rect);
      const primary = Math.abs(horizontal ? candidateCentre.x - currentCentre.x : candidateCentre.y - currentCentre.y);
      const cross = Math.abs(horizontal ? candidateCentre.y - currentCentre.y : candidateCentre.x - currentCentre.x);
      const overlaps = horizontal
        ? rect.top < currentRect.bottom && rect.bottom > currentRect.top
        : rect.left < currentRect.right && rect.right > currentRect.left;
      return { candidate, score: primary + cross * (overlaps ? 0.35 : 1.8) };
    })
    .sort((a, b) => a.score - b.score)[0]?.candidate || null;
};

const focusControl = (element) => {
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
};

const getControls = (root, group = "") => Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))
  .filter((element) => isVisible(element) && (!group || element.dataset.orderNavGroup === group));

// Menu cards live in their own scrollable, responsive grid.  Limiting spatial
// matching to these controls first keeps a right/down press inside the grid
// from being captured by an unrelated control elsewhere in the modal.
const getMenuItems = (root) => Array.from(root.querySelectorAll("[data-order-menu-item='true']"))
  .filter(isVisible);

const getCartItems = (root) => Array.from(root.querySelectorAll("[data-order-cart-item]"))
  .filter(isVisible);

export const useOrderModalKeyboardNavigation = ({ open, modalRef, focusKey, onCartQuantity }) => {
  const previousFocusRef = useRef(null);

  const moveFocus = useCallback((current, direction) => {
    const root = modalRef.current;
    if (!root) return false;

    const group = current.dataset.orderNavGroup;
    if (group && (direction === "ArrowLeft" || direction === "ArrowRight")) {
      const controls = getControls(root, group);
      const index = controls.indexOf(current);
      const next = controls[index + (direction === "ArrowRight" ? 1 : -1)];
      if (next) {
        focusControl(next);
        return true;
      }
    }

    if (current.dataset.orderMenuItem === "true") {
      const menuTarget = findSpatialTarget(current, getMenuItems(root), direction);
      if (menuTarget) {
        focusControl(menuTarget);
        return true;
      }

      // The cart sits below a nested, scrollable menu grid. Its coordinates
      // are not consistently comparable to a card scrolled inside that grid,
      // so make the final-row hand-off deterministic.
      if (direction === "ArrowDown") {
        const firstCartItem = getCartItems(root)[0];
        if (firstCartItem) {
          focusControl(firstCartItem);
          return true;
        }
      }
    }

    const next = findSpatialTarget(current, getControls(root), direction);
    if (!next) return false;
    focusControl(next);
    return true;
  }, [modalRef]);

  const onKeyDownCapture = useCallback((event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const root = modalRef.current;
    if (!root || !root.contains(event.target)) return;

    if (event.key === "Tab") {
      const controls = getControls(root);
      if (!controls.length) return;
      const active = document.activeElement;
      const index = controls.indexOf(active);
      const next = event.shiftKey
        ? controls[index <= 0 ? controls.length - 1 : index - 1]
        : controls[index === controls.length - 1 ? 0 : index + 1];
      if (next) {
        event.preventDefault();
        focusControl(next);
      }
      return;
    }

    const current = event.target.closest?.(FOCUSABLE_SELECTOR);
    if (!current || !root.contains(current)) return;

    // Search remains a normal text field for caret/editing keys. Arrow Down is
    // the one intentional hand-off to the visible menu grid.
    if (current.dataset.orderMenuSearch === "true" && event.key === "ArrowDown") {
      const firstMenuItem = getMenuItems(root)[0];
      if (firstMenuItem) {
        event.preventDefault();
        focusControl(firstMenuItem);
      }
      return;
    }

    if (isEditableOrderControl(current)) return;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      if (moveFocus(current, event.key)) event.preventDefault();
      return;
    }

    if ((event.key === "+" || event.key === "-" || event.code === "NumpadAdd" || event.code === "NumpadSubtract") && onCartQuantity) {
      const cartItem = current.closest("[data-order-cart-item]");
      if (!cartItem?.dataset.orderCartItem) return;
      onCartQuantity(cartItem.dataset.orderCartItem, event.key === "-" || event.code === "NumpadSubtract" ? -1 : 1);
      event.preventDefault();
    }
  }, [modalRef, moveFocus, onCartQuantity]);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return undefined;
    }
    previousFocusRef.current?.focus?.();
    previousFocusRef.current = null;
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const root = modalRef.current;
      if (!root || root.contains(document.activeElement)) return;
      const initial = root.querySelector("[data-order-primary-focus]") || getControls(root)[0];
      if (initial) focusControl(initial);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusKey, modalRef, open]);

  return { onKeyDownCapture };
};
