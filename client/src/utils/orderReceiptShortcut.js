/** Selected rows take precedence; a focused row is a safe F9 fallback. */
export const resolveReceiptShortcutOrder = (selectedOrder, focusedOrder) => selectedOrder || focusedOrder || null;
