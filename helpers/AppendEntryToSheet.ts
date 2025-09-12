import { google } from "googleapis";

import GoogleAuth from "../GoogleAuth";
import GetSheetNameForUser from "./GetSheetNameForUser";
import EnsureSheetHeader from "./EnsureSheetHeader";
import EnsureFechaColumnFormat from "./EnsureFechaColumnFormat";
import NowAsSheetsText from "./NowAsSheetsText";

import { SPREADSHEET_ID } from "../Constant";

const AppendEntryToSheet = async ({ userId, userLabel, type, amount, category, note, chatId }: any) => {
	const auth: any = await GoogleAuth.getClient();
	const sheets: any = google.sheets({ version: "v4", auth });
	const sheetName: any = GetSheetNameForUser(userId);
	await EnsureSheetHeader(sheetName);
	await EnsureFechaColumnFormat(sheetName);

	const values: any = [[userId, userLabel || "", NowAsSheetsText(), category || "", Number(amount), note || ""]];
	return sheets.spreadsheets.values.append({
		spreadsheetId: SPREADSHEET_ID,
		range: `${sheetName}!A:A`,
		valueInputOption: "USER_ENTERED",
		insertDataOption: "INSERT_ROWS",
		requestBody: { values },
	});
};

export default AppendEntryToSheet;
