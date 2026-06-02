# Export, History, and Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the client-side Markdown/PDF export functionalities, the History page with premium styling, and setup a robust Vitest testing environment with tests for the markdown serialization logic for MeetGest.

**Architecture:** 
- The export logic utilizes a deterministic markdown serializer and standard browser download triggers, with elegant multi-page PDF generation via `jsPDF` using margin and height measurements.
- The History Page fetches meeting previews using the `api` client and displays a beautiful responsive grid of cards, integrating skeleton loaders for premium aesthetics.
- The test suite is configured using Vitest and `jsdom` with the Vite path aliases `@/*` properly resolved to `src/*`.

**Tech Stack:** React 19, TypeScript, TailwindCSS, jsPDF, Vitest, @testing-library/react, @testing-library/jest-dom, jsdom.

---

### Task 1: Install Dependencies and Configure Vitest

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`

- [ ] **Step 1: Install packages**

Run the following command in the `frontend` directory using `run_command`:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/react @types/react-dom
```

- [ ] **Step 2: Add test script in `frontend/package.json`**

Modify the `scripts` section in `frontend/package.json` to include:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `frontend/vitest.config.ts`**

Create the Vitest configuration file matching the existing Vite config path mappings.
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Run a dry-run test check**

Verify that `npm test` doesn't crash (it will just say no tests found or similar).

---

### Task 2: Implement Markdown & PDF Export Logic

**Files:**
- Create: `frontend/src/lib/export.ts`

- [ ] **Step 1: Create `frontend/src/lib/export.ts`**

Implement deterministic Markdown serialization, slug helper, and jsPDF-based PDF download with automatic text wrapping and elegant page breaking.
- Title size: 24pt
- Date / metadata size: 10pt (muted style)
- Headers (Summary, Action Items, Key Decisions) size: 14pt (bold)
- Body text size: 10pt
- Text wrapping: Calculate line splits dynamically using `doc.splitTextToSize` based on page width and margins.
- Page height: Dynamically track page height and offset. When offset exceeds page height minus margin, add a new page and reset offset.

```typescript
import { jsPDF } from "jspdf";
import type { Meeting } from "./types";

/**
 * Serializes a meeting object deterministically to a Markdown string.
 */
export function toMarkdown(meeting: Meeting): string {
  const dateStr = new Date(meeting.created_at).toLocaleDateString(undefined, {
    dateStyle: "long",
  });

  let md = `# ${meeting.title.trim()}\n\n`;
  md += `**Date:** ${dateStr}\n\n`;

  // Summary
  md += `## Summary\n\n`;
  md += `${meeting.summary.trim() || "_No summary available._"}\n\n`;

  // Action Items
  md += `## Action Items\n\n`;
  if (meeting.action_items && meeting.action_items.length > 0) {
    // Sort by position to preserve order
    const sortedActions = [...meeting.action_items].sort((a, b) => a.position - b.position);
    sortedActions.forEach((item) => {
      const ownerText = item.owner ? ` (@${item.owner.trim()})` : "";
      const deadlineText = item.deadline ? ` [due: ${item.deadline.trim()}]` : "";
      md += `- [ ] ${item.task.trim()}${ownerText}${deadlineText}\n`;
    });
    md += `\n`;
  } else {
    md += `_No action items identified._\n\n`;
  }

  // Key Decisions
  md += `## Key Decisions\n\n`;
  if (meeting.key_decisions && meeting.key_decisions.length > 0) {
    // Sort by position to preserve order
    const sortedDecisions = [...meeting.key_decisions].sort((a, b) => a.position - b.position);
    sortedDecisions.forEach((dec) => {
      md += `- ${dec.text.trim()}\n`;
    });
    md += `\n`;
  } else {
    md += `_No key decisions recorded._\n\n`;
  }

  return md.trim() + "\n";
}

/**
 * Triggers a client-side .md file download named from slugged title.
 */
export function downloadMarkdown(meeting: Meeting): void {
  const content = toMarkdown(meeting);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const slug = meeting.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "meeting-notes";
  
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${slug}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a .pdf file client-side using jsPDF.
 * Elegant multi-page handling with proper wrapping and formatting.
 */
export function downloadPdf(meeting: Meeting): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 54; // 0.75 in margin (approx 54pt)
  const contentWidth = pageWidth - margin * 2;
  
  let y = margin;

  // Helper to add standard page if we overflow
  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // 1. Document Title
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(22);
  const titleLines: string[] = doc.splitTextToSize(meeting.title.trim(), contentWidth);
  const titleHeight = titleLines.length * 28;
  ensureSpace(titleHeight);
  doc.text(titleLines, margin, y);
  y += titleHeight + 10;

  // 2. Metadata: Date
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Muted slate color
  const dateStr = `Date: ${new Date(meeting.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}`;
  ensureSpace(15);
  doc.text(dateStr, margin, y);
  y += 25;

  // Draw a premium horizontal separator rule
  ensureSpace(10);
  doc.setDrawColor(226, 232, 240); // slate-200 border
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 25;

  // Reset text color to standard dark slate
  doc.setTextColor(30, 41, 59); // slate-800

  // Summary Section
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  ensureSpace(20);
  doc.text("Summary", margin, y);
  y += 20;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85); // slate-700
  const summaryText = meeting.summary.trim() || "No summary available.";
  const summaryLines: string[] = doc.splitTextToSize(summaryText, contentWidth);
  const summaryHeight = summaryLines.length * 16;
  ensureSpace(summaryHeight + 20);
  doc.text(summaryLines, margin, y, { lineHeightFactor: 1.5 });
  y += summaryHeight + 25;

  // Action Items Section
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  ensureSpace(20);
  doc.text("Action Items", margin, y);
  y += 20;

  if (meeting.action_items && meeting.action_items.length > 0) {
    const sortedActions = [...meeting.action_items].sort((a, b) => a.position - b.position);
    sortedActions.forEach((item) => {
      const ownerText = item.owner ? ` (@${item.owner.trim()})` : "";
      const deadlineText = item.deadline ? ` [due: ${item.deadline.trim()}]` : "";
      const actionText = `[ ]  ${item.task.trim()}${ownerText}${deadlineText}`;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // slate-700
      
      const itemLines: string[] = doc.splitTextToSize(actionText, contentWidth - 10);
      const itemHeight = itemLines.length * 15;
      
      ensureSpace(itemHeight + 8);
      // Small visual box or bullet for checkbox
      doc.setDrawColor(148, 163, 184); // slate-400
      doc.setLineWidth(1);
      doc.rect(margin, y - 9, 8, 8); // draw small checkbox
      
      // Print text offset slightly to not overlay box
      const textLines: string[] = doc.splitTextToSize(`${item.task.trim()}${ownerText}${deadlineText}`, contentWidth - 20);
      doc.text(textLines, margin + 15, y);
      y += (textLines.length * 15) + 8;
    });
    y += 15;
  } else {
    doc.setFont("Helvetica", "oblique");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    ensureSpace(15);
    doc.text("No action items identified.", margin, y);
    y += 25;
  }

  // Key Decisions Section
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  ensureSpace(20);
  doc.text("Key Decisions", margin, y);
  y += 20;

  if (meeting.key_decisions && meeting.key_decisions.length > 0) {
    const sortedDecisions = [...meeting.key_decisions].sort((a, b) => a.position - b.position);
    sortedDecisions.forEach((dec) => {
      const decText = `•  ${dec.text.trim()}`;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // slate-700
      
      const decLines: string[] = doc.splitTextToSize(decText, contentWidth - 10);
      const decHeight = decLines.length * 15;
      ensureSpace(decHeight + 8);
      
      // Bullet point styling
      doc.text(decLines, margin, y, { lineHeightFactor: 1.4 });
      y += decHeight + 8;
    });
  } else {
    doc.setFont("Helvetica", "oblique");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    ensureSpace(15);
    doc.text("No key decisions recorded.", margin, y);
    y += 25;
  }

  const slug = meeting.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "meeting-notes";
    
  doc.save(`${slug}.pdf`);
}
