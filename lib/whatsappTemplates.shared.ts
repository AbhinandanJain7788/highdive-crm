export type TemplateVisibility = "all" | "process" | "private";

export type WaTemplateRow = {
  id: string;
  name: string;
  visibility: TemplateVisibility;
  processId: string | null;
  fullText: string;
  preview: string;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
};

export const TEMPLATE_VISIBILITIES: TemplateVisibility[] = ["all", "process", "private"];

// Card preview truncation — matches the mock seed's ~55-char previews.
export function previewFor(fullText: string): string {
  const oneLine = fullText.replace(/\s+/g, " ").trim();
  return oneLine.length > 55 ? `${oneLine.slice(0, 55)}...` : oneLine;
}
