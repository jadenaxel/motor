import { google } from "googleapis";

import GoogleAuth from "../GoogleAuth";
import { SPREADSHEET_ID } from "../Constant";

const EnsureFechaColumnFormat = async (sheetName: string): Promise<void> => {
	const auth: any = await GoogleAuth.getClient();
	const sheets: any = google.sheets({ version: "v4", auth });

	const meta: any = await sheets.spreadsheets.get({
		spreadsheetId: SPREADSHEET_ID,
	});

	const sheet: any = meta?.data?.sheets?.find((s: any) => s.properties?.title === sheetName);

	if (!sheet) return;
	const sheetId: string = sheet?.properties?.sheetId;

	await sheets.spreadsheets.batchUpdate({
		spreadsheetId: SPREADSHEET_ID,
		requestBody: {
			requests: [
				{
					repeatCell: {
						range: {
							sheetId,
							startColumnIndex: 2,
							endColumnIndex: 3,
						},
						cell: {
							userEnteredFormat: {
								numberFormat: {
									type: "DATE_TIME",
									pattern: "yyyy-mm-dd hh:mm:ss",
								},
							},
						},
						fields: "userEnteredFormat.numberFormat",
					},
				},
			],
		},
	});
};

export default EnsureFechaColumnFormat;
