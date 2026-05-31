import { jsPDF } from "jspdf";
import type { Meeting } from "./types";
import { toSlug } from "./utils";

export function toMarkdown(meeting: Meeting): string {
  const dateStr = new Date(meeting.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  let md = `# ${meeting.title.trim()}\n`;
  md += `**Date:** ${dateStr}\n\n`;
  md += `---\n\n`;

  md += `## Summary\n\n`;
  md += `${meeting.summary.trim() || "_No summary available._"}\n\n`;

  if (meeting.action_items && meeting.action_items.length > 0) {
    md += `## Action Items\n\n`;
    for (const item of meeting.action_items) {
      const ownerText = item.owner ? ` – _${item.owner.trim()}_` : "";
      const deadlineText = item.deadline ? ` (Due: ${item.deadline.trim()})` : "";
      md += `- ${item.task.trim()}${ownerText}${deadlineText}\n`;
    }
    md += `\n`;
  }

  if (meeting.key_decisions && meeting.key_decisions.length > 0) {
    md += `## Key Decisions\n\n`;
    for (const dec of meeting.key_decisions) {
      md += `- ${dec.text.trim()}\n`;
    }
    md += `\n`;
  }

  return md.trim() + "\n";
}

export function downloadMarkdown(meeting: Meeting): void {
  const content = toMarkdown(meeting);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${toSlug(meeting.title)}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPdf(meeting: Meeting): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  doc.setFont("helvetica");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 20) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59);
  const titleLines: string[] = doc.splitTextToSize(meeting.title.trim(), contentWidth);
  const titleHeight = titleLines.length * 28;
  ensureSpace(titleHeight);
  doc.text(titleLines, margin, y);
  y += titleHeight + 6;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const dateStr = new Date(meeting.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  ensureSpace(12);
  doc.text(`Generated: ${dateStr}`, margin, y);
  y += 12;

  ensureSpace(8);
  doc.setDrawColor(140, 192, 235);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  doc.setTextColor(30, 41, 59);

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(140, 192, 235);
  ensureSpace(16);
  doc.text("Summary", margin, y);
  y += 14;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const summaryText = meeting.summary.trim() || "No summary available.";
  const summaryLines: string[] = doc.splitTextToSize(summaryText, contentWidth);
  const summaryHeight = summaryLines.length * 15;
  ensureSpace(summaryHeight + 12);
  doc.text(summaryLines, margin, y, { lineHeightFactor: 1.4 });
  y += summaryHeight + 12;

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(140, 192, 235);
  ensureSpace(16);
  doc.text("Action Items", margin, y);
  y += 14;

  if (meeting.action_items && meeting.action_items.length > 0) {
    for (const item of meeting.action_items) {
      const ownerText = item.owner ? ` – ${item.owner.trim()}` : "";
      const deadlineText = item.deadline ? ` (Due: ${item.deadline.trim()})` : "";
      const textForWrapping = `${item.task.trim()}${ownerText}${deadlineText}`;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);

      const textLines: string[] = doc.splitTextToSize(textForWrapping, contentWidth - 18);
      const itemHeight = textLines.length * 14;

      ensureSpace(itemHeight + 6);

      doc.setDrawColor(140, 192, 235);
      doc.setLineWidth(1);
      doc.rect(margin, y - 6, 6, 6);

      doc.text(textLines, margin + 14, y);
      y += itemHeight + 6;
    }
    y += 8;
  } else {
    doc.setFont("Helvetica", "oblique");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    ensureSpace(15);
    doc.text("No action items identified.", margin, y);
    y += 25;
  }

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 170, 64);
  ensureSpace(16);
  doc.text("Key Decisions", margin, y);
  y += 14;

  if (meeting.key_decisions && meeting.key_decisions.length > 0) {
    for (const dec of meeting.key_decisions) {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);

      const decLines: string[] = doc.splitTextToSize(dec.text.trim(), contentWidth - 15);
      const decHeight = decLines.length * 14;
      ensureSpace(decHeight + 6);

      doc.setTextColor(255, 170, 64);
      doc.text("•", margin, y);
      doc.setTextColor(51, 65, 85);
      doc.text(decLines, margin + 10, y);
      y += decHeight + 6;
    }
  } else {
    doc.setFont("Helvetica", "oblique");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    ensureSpace(12);
    doc.text("No key decisions recorded.", margin, y);
    y += 12;
  }

  const footerY = pageHeight - 10;
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(166, 173, 186);
  const exportDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  doc.text(exportDate, margin, footerY);
  doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin - 15, footerY, { align: 'right' });

  doc.save(`${toSlug(meeting.title)}.pdf`);
}
