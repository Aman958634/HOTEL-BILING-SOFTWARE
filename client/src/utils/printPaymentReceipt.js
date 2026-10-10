let paymentReceiptPrintInProgress = false;

export const printPaymentReceipt = () => {
  if (paymentReceiptPrintInProgress || !document.getElementById("payment-receipt-print")) return false;

  paymentReceiptPrintInProgress = true;
  const clearPrintMode = () => {
    document.body.classList.remove("payment-receipt-printing");
    paymentReceiptPrintInProgress = false;
  };

  document.body.classList.remove("kitchen-kot-printing");
  document.body.classList.add("payment-receipt-printing");
  window.addEventListener("afterprint", clearPrintMode, { once: true });

  const print = () => {
    if (!document.getElementById("payment-receipt-print")) {
      clearPrintMode();
      return;
    }
    try {
      window.print();
    } catch (_error) {
      clearPrintMode();
    }
  };

  if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(print);
  else print();
  return true;
};
