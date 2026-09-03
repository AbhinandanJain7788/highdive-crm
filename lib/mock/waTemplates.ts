// Verbatim from waTemplatesSeed / Phase 0 seed (4 templates).
export type MockWaTemplate = {
  id: string;
  name: string;
  visibility: "all" | "process" | "private";
  preview: string;
  createdBy: string;
  fullText: string;
};

export const waTemplatesSeed: MockWaTemplate[] = [
  {
    id: "w1",
    name: "CV Pending",
    visibility: "all",
    preview: "Hi [Candidate Name], it was nice connecting with y...",
    createdBy: "Admin",
    fullText:
      "Hi [Candidate Name], it was nice connecting with you regarding the job opportunity. Just a quick reminder to share your updated CV with us so we can take this forward.\n\nThanks,\n[Your Name]",
  },
  {
    id: "w2",
    name: "CV Pending",
    visibility: "all",
    preview: "Hi [Candidate Name],",
    createdBy: "Admin",
    fullText:
      "Hi [Candidate Name],\n\nWe still haven't received your updated CV. Please share it at your earliest convenience so we can move forward with your application.\n\nThanks,\n[Your Name]",
  },
  {
    id: "w3",
    name: "Interview Reminder",
    visibility: "all",
    preview: "GOOD MORNING",
    createdBy: "Admin",
    fullText:
      "GOOD MORNING [Candidate Name],\n\nThis is a reminder for your upcoming interview. Please be ready 10 minutes before the scheduled time.\n\nThanks,\n[Your Name]",
  },
  {
    id: "w4",
    name: "Interview Reminder",
    visibility: "all",
    preview: "GOOD MORNING Your interview is scheduled for toda...",
    createdBy: "Admin",
    fullText:
      "GOOD MORNING [Candidate Name],\n\nYour interview is scheduled for today at [Time]. Please join on time and keep your documents ready.\n\nThanks,\n[Your Name]",
  },
];
