import { describe, it, expect } from "vitest";
import { toMarkdown } from "../src/lib/export";
import type { Meeting } from "../src/lib/types";

describe("toMarkdown serializer", () => {
  const baseMeeting: Meeting = {
    id: "uuid-123",
    title: "Quarterly Review",
    raw_transcript: "Let's review the quarter...",
    summary: "A brief summary of findings.",
    created_at: 1780000000000, // May 2026 approx
    action_items: [],
    key_decisions: [],
  };

  it("should format meeting title, date and summary correctly", () => {
    const md = toMarkdown(baseMeeting);
    expect(md).toContain("# Quarterly Review");
    expect(md).toContain("Date:");
    expect(md).toContain("## Summary");
    expect(md).toContain("A brief summary of findings.");
  });

  it("should print placeholders when action items and key decisions are empty", () => {
    const md = toMarkdown(baseMeeting);
    expect(md).toContain("_No action items identified._");
    expect(md).toContain("_No key decisions recorded._");
  });

  it("should correctly serialize and order action items by position", () => {
    const meeting: Meeting = {
      ...baseMeeting,
      action_items: [
        {
          id: "item-2",
          meeting_id: "uuid-123",
          task: "Update Meta ad creative",
          owner: "Sarah",
          deadline: "Friday",
          position: 2,
        },
        {
          id: "item-1",
          meeting_id: "uuid-123",
          task: "Setup Google Ads campaign",
          owner: null,
          deadline: null,
          position: 1,
        },
      ],
    };

    const md = toMarkdown(meeting);
    expect(md).not.toContain("_No action items identified._");
    
    // Check sorting and styling
    const lines = md.split("\n");
    const actionsSection = lines.slice(lines.indexOf("## Action Items") + 1);
    
    const firstActionIdx = actionsSection.findIndex(l => l.includes("Setup Google Ads campaign"));
    const secondActionIdx = actionsSection.findIndex(l => l.includes("Update Meta ad creative"));
    
    expect(firstActionIdx).toBeLessThan(secondActionIdx);
    expect(actionsSection[firstActionIdx]).toBe("- [ ] Setup Google Ads campaign");
    expect(actionsSection[secondActionIdx]).toBe("- [ ] Update Meta ad creative (@Sarah) [due: Friday]");
  });

  it("should correctly serialize and order key decisions by position", () => {
    const meeting: Meeting = {
      ...baseMeeting,
      key_decisions: [
        {
          id: "dec-2",
          meeting_id: "uuid-123",
          text: "Decided to pause low-performing search ads",
          position: 2,
        },
        {
          id: "dec-1",
          meeting_id: "uuid-123",
          text: "Approved the campaign expansion budget",
          position: 1,
        },
      ],
    };

    const md = toMarkdown(meeting);
    expect(md).not.toContain("_No key decisions recorded._");
    
    const lines = md.split("\n");
    const decisionsSection = lines.slice(lines.indexOf("## Key Decisions") + 1);
    
    const firstDecIdx = decisionsSection.findIndex(l => l.includes("Approved the campaign expansion budget"));
    const secondDecIdx = decisionsSection.findIndex(l => l.includes("Decided to pause low-performing search ads"));
    
    expect(firstDecIdx).toBeLessThan(secondDecIdx);
    expect(decisionsSection[firstDecIdx]).toBe("- Approved the campaign expansion budget");
    expect(decisionsSection[secondDecIdx]).toBe("- Decided to pause low-performing search ads");
  });
});
