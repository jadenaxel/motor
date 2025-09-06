import { google } from "googleapis";

import GoogleAuth from "../GoogleAuth";
import { SPREADSHEET_ID } from "../Constant";

const EnsureSheetHeader = async (sheetName: string): Promise<void> => {
	const auth: any = await GoogleAuth.getClient();
	const sheets: any = google.sheets({ version: "v4", auth });
	const expectedHeader: string[] = ["ID", "Nombre", "Fecha", "Categoria", "Cantidad", "Comentario"];
	const range: string = `${sheetName}!A1:F1`;

	const res: any = await sheets.spreadsheets.values.get({
		spreadsheetId: SPREADSHEET_ID,
		range,
	});

	const firstRow: any[] = res.data.values && res.data.values[0] ? res.data.values[0] : [];

	let needsUpdate: boolean = false;

	if (firstRow.length !== expectedHeader.length) needsUpdate = true;
	else {
		for (let i = 0; i < expectedHeader.length; ++i) {
			if (firstRow[i] !== expectedHeader[i]) {
				needsUpdate = true;
				break;
			}
		}
	}
	if (needsUpdate) {
		await sheets.spreadsheets.values.update({
			spreadsheetId: SPREADSHEET_ID,
			range,
			valueInputOption: "RAW",
			requestBody: { values: [expectedHeader] },
		});
	}
};

export default EnsureSheetHeader;
