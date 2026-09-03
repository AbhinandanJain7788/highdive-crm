// Verbatim from importDedupSeed (2 rows) — used by the CSV Import review step.
export type MockImportDedupRow = {
  id: string;
  newName: string;
  newPhone: string;
  newJob: string;
  existingName: string;
  existingPhone: string;
  existingStatus: string;
};

export const importDedupSeed: MockImportDedupRow[] = [
  { id: "imp1", newName: "Rohit Verma", newPhone: "+91 99887 65432", newJob: "Business Development Executive", existingName: "Rohit Verma", existingPhone: "+91 99887 65432", existingStatus: "New" },
  { id: "imp2", newName: "Pooja Joshi", newPhone: "+91 95678 90123", newJob: "Data Analyst", existingName: "Pooja Joshi", existingPhone: "+91 95678 90123", existingStatus: "New" },
];
