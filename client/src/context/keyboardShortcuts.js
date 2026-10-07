export const isEditableTarget = (target) => {
  const tag = String(target?.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target?.isContentEditable);
};

export const getShortcutKey = (event) => {
  if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "k") return "ctrl+k";
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") return "ctrl+enter";
  if (event.key === "Escape") return "escape";
  if (/^F(?:[1-9]|1[01])$/.test(event.key)) return event.key.toLowerCase();
  if (event.key === "ArrowUp") return "arrowup";
  if (event.key === "ArrowDown") return "arrowdown";
  if (event.key === "Enter") return "enter";
  if (event.key === "Delete") return "delete";
  if (event.key === "/") return "menu-search";
  if (event.key === "+" || event.code === "NumpadAdd") return "plus";
  if (event.key === "-" || event.code === "NumpadSubtract") return "minus";
  return "";
};
