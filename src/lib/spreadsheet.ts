/**
 * Converts a CSV or Excel file (.csv, .xlsx, .xls) to a CSV text string
 * so it can be fed directly into the existing CSV parsers.
 */
export async function fileToCSVText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "xlsx" || ext === "xls") {
    const { read, utils } = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Produce a CSV string from the first sheet; raw: false formats dates etc.
    return utils.sheet_to_csv(sheet, { blankrows: false });
  }

  // Default: plain CSV
  return file.text();
}
