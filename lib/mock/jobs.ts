// Verbatim from jobsSeed / Phase 0 seed (14 jobs). All use the single Default Pipeline
// template (8 stages) — see pipeline.ts.
export type MockJob = {
  id: string;
  title: string;
  clientId: string;
  status: "open" | "on_hold" | "closed";
  openings: number;
  createdOn: string;
};

export const jobsSeed: MockJob[] = [
  { id: "j1", title: "Senior React Developer", clientId: "k1", status: "open", openings: 2, createdOn: "05 Aug 2026" },
  { id: "j2", title: "Business Development Executive", clientId: "k2", status: "open", openings: 3, createdOn: "10 Aug 2026" },
  { id: "j3", title: "HR Generalist", clientId: "k3", status: "closed", openings: 1, createdOn: "02 Jul 2026" },
  { id: "j4", title: "Backend Engineer (Node.js)", clientId: "k1", status: "open", openings: 2, createdOn: "14 Aug 2026" },
  { id: "j5", title: "Digital Marketing Manager", clientId: "k4", status: "on_hold", openings: 1, createdOn: "01 Aug 2026" },
  { id: "j6", title: "Field Sales Executive", clientId: "k2", status: "open", openings: 5, createdOn: "18 Aug 2026" },
  { id: "j7", title: "Customer Support Associate", clientId: "k3", status: "open", openings: 4, createdOn: "20 Aug 2026" },
  { id: "j8", title: "Accounts Executive", clientId: "k4", status: "open", openings: 1, createdOn: "22 Aug 2026" },
  { id: "j9", title: "Graphic Designer", clientId: "k4", status: "closed", openings: 1, createdOn: "28 Jul 2026" },
  { id: "j10", title: "Operations Manager", clientId: "k1", status: "open", openings: 1, createdOn: "24 Aug 2026" },
  { id: "j11", title: "Data Analyst", clientId: "k2", status: "open", openings: 2, createdOn: "26 Aug 2026" },
  { id: "j12", title: "Content Writer", clientId: "k4", status: "closed", openings: 1, createdOn: "05 Aug 2026" },
  { id: "j13", title: "Warehouse Supervisor", clientId: "k3", status: "open", openings: 3, createdOn: "29 Aug 2026" },
  { id: "j14", title: "Inside Sales Representative", clientId: "k2", status: "open", openings: 2, createdOn: "30 Aug 2026" },
];

export const jobStatusLabels: Record<MockJob["status"], string> = {
  open: "Open",
  on_hold: "On Hold",
  closed: "Closed",
};

// Verbatim from the HTML's per-status badge colors (Open/On Hold/Closed ternary).
export function jobStatusStyle(status: MockJob["status"]): { bg: string; color: string } {
  switch (status) {
    case "open":
      return { bg: "#E6F4EA", color: "#1E7F43" };
    case "on_hold":
      return { bg: "#FFF4E5", color: "#B15C00" };
    case "closed":
      return { bg: "#EEF0F5", color: "#5B6472" };
  }
}
