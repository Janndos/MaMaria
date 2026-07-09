import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Streams an .xlsx template that mirrors Ma'Maria's kitchen sheet exactly:
 * a title row, the `№ / Denumire / Masa / gr / Pret portie, MDL` header, and
 * category rows interleaved with numbered items. Downloading and filling this
 * guarantees the upload parser recognises every column and section.
 */
export async function GET() {
  return handle(async () => {
    await requireAdmin();

    const rows: (string | number)[][] = [
      ["", "MENIUL ZILEI", "", ""],
      ["", "", "", ""],
      ["№", "Denumire", "Masa / gr", "Pret portie, MDL"],
      ["", "Felul întâi", "", ""],
      [1, "Zeamă cu carne de pui", 300, 21],
      ["", "Garnitură", "", ""],
      [2, "Cartofi copți la cuptor", 250, 19],
      [3, "Paste cu sos fin de roșii", 250, 19],
      ["", "Bucate din carne", "", ""],
      [4, "Fileu de pui copt în sos alb", 100, 27],
      ["", "Salate", "", ""],
      [5, "Salată din varză", 100, 14],
      ["", "Altele", "", ""],
      [6, "Pâine albă de casă", 50, 3],
      [7, "Compot din fructe", 200, 5],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 5 }, { wch: 40 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Meniu");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="model-meniu-mamaria.xlsx"',
      },
    });
  });
}
