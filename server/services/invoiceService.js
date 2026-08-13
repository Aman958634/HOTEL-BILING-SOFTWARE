import PDFDocument from "pdfkit";

export const buildInvoiceBuffer = (order) =>
  new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 36 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).text("Invoice", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Order: ${order.orderNumber}`);
    doc.text(`Customer: ${order.customer?.fullName || "Guest"}`);
    doc.text(`Status: ${order.status}`);
    doc.moveDown();

    order.items.forEach((item) => {
      const line = `${item.menuItem?.name || item.name || "Item"} x${item.quantity} - ${item.price}`;
      doc.text(line);
    });

    doc.moveDown();
    doc.text(`Total: ${order.total}`, { align: "right" });
    doc.end();
  });
