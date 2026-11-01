import type { jsPDF } from "jspdf";

export async function addDocumentWatermark(pdf: jsPDF) {
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not load the CYTIC Creatives logo."));
  });
  image.src = "/Logo_512p.png";
  await loaded;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const size = 112;
  pdf.saveGraphicsState();
  pdf.setGState(pdf.GState({ opacity: 0.045 }));
  pdf.addImage(image, "PNG", (pageWidth - size) / 2, (pageHeight - size) / 2, size, size);
  pdf.restoreGraphicsState();
}
