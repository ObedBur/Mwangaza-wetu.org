import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportCell = string | number;

const brand = {
  blue: [11, 94, 168] as [number, number, number],
  orange: [229, 106, 30] as [number, number, number],
  ink: [35, 48, 66] as [number, number, number],
  muted: [103, 116, 133] as [number, number, number],
  line: [224, 230, 236] as [number, number, number],
  pale: [246, 249, 251] as [number, number, number],
};

function localDateStamp(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadReportCsv(
  baseName: string,
  headers: string[],
  rows: ReportCell[][],
) {
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");

  downloadBlob(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    `${baseName}-${localDateStamp()}.csv`,
  );
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch("/images/logo.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadReportPdf(
  title: string,
  baseName: string,
  headers: string[],
  rows: ReportCell[][],
): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape" });
  const generatedAt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  const logo = await loadLogoDataUrl();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 28;

  // Brand header and clear report identity.
  doc.setFillColor(...brand.blue);
  doc.roundedRect(14, 11, contentWidth, 29, 3, 3, "F");
  doc.setFillColor(...brand.orange);
  doc.roundedRect(14, 11, 3, 29, 1.5, 1.5, "F");
  if (logo) {
    doc.setFillColor(255, 255, 255);
    doc.circle(30, 25.5, 10.5, "F");
    doc.addImage(logo, "PNG", 21, 16.5, 18, 18);
  } else {
    doc.setFillColor(255, 255, 255);
    doc.circle(30, 25.5, 10.5, "F");
    doc.setTextColor(...brand.blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("MW", 30, 27, { align: "center" });
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Mwangaza Wetu", 46, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Mini Coopérative d’Épargne et de Crédit", 46, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("RAPPORT OFFICIEL", pageWidth - 21, 27, { align: "right" });

  doc.setTextColor(...brand.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 52, { maxWidth: contentWidth });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...brand.muted);
  doc.setFontSize(9);
  doc.text("Épargne · Crédit · Développement", 14, 59);

  // Compact summary tiles keep short reports intentional and readable.
  const summaryY = 66;
  const summaryGap = 8;
  const summaryWidth = (contentWidth - summaryGap) / 2;
  [14, 14 + summaryWidth + summaryGap].forEach((x) => {
    doc.setFillColor(...brand.pale);
    doc.setDrawColor(...brand.line);
    doc.roundedRect(x, summaryY, summaryWidth, 17, 2, 2, "FD");
  });
  doc.setTextColor(...brand.muted);
  doc.setFontSize(7);
  doc.text("ENREGISTREMENTS", 19, summaryY + 6);
  doc.text("GÉNÉRÉ LE", 19 + summaryWidth + summaryGap, summaryY + 6);
  doc.setTextColor(...brand.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(String(rows.length), 19, summaryY + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(generatedAt, 19 + summaryWidth + summaryGap, summaryY + 13);

  autoTable(doc, {
    head: [headers],
    body: rows.map((row) => row.map(String)),
    startY: 91,
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
      textColor: brand.ink,
      lineColor: brand.line,
      lineWidth: 0.15,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: brand.blue,
      textColor: 255,
      fontStyle: "bold",
      cellPadding: { top: 4.5, right: 3, bottom: 4.5, left: 3 },
    },
    alternateRowStyles: { fillColor: [249, 251, 253] },
    bodyStyles: { minCellHeight: 9 },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const footerY = pageHeight - 12;
      doc.setDrawColor(...brand.line);
      doc.setLineWidth(0.3);
      doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...brand.muted);
      doc.text("Mwangaza Wetu  ·  Plus qu’une coopérative, une famille", 14, footerY);
      doc.text(`Page ${data.pageNumber}`, pageWidth - 14, footerY, { align: "right" });
    },
  });

  doc.save(`${baseName}-${localDateStamp()}.pdf`);
}
