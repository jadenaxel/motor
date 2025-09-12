import { google } from "googleapis";

import { SPREADSHEET_ID } from "../Constant";

import rdTodayDateString from "./RDTodayDate";
import GoogleAuth from "../GoogleAuth";
import GetActiveUserLabel from "./GetActiveUserLabel";
import GetSheetNameForUser from "./GetSheetNameForUser";

const sendTodayIncomeSummary = async (ctx: any, s: any) => {
	const label: string | null = GetActiveUserLabel(s);
	const today: any = rdTodayDateString(); // YYYY-MM-DD en zona RD

	try {
		const auth: any = await GoogleAuth.getClient();
		const sheets: any = google.sheets({ version: "v4", auth });
		const sheetName: any = GetSheetNameForUser(s.lockedUser);
		const range: any = `${sheetName}!C2:E`; // Fecha (C), Categoria (D), Cantidad (E)
		const res: any = await sheets.spreadsheets.values.get({
			spreadsheetId: SPREADSHEET_ID,
			range,
		});

		const rows: any = res.data.values || [];

		let total: any = 0;

		for (const r of rows) {
			const fecha: any = r[0] || ""; // C
			const categoria: any = r[1] || ""; // D
			const cantidadStr: any = r[2] || ""; // E

			if (String(fecha).startsWith(today) && String(categoria).toLowerCase() === "ganancias") {
				const num = parseFloat(String(cantidadStr).replace(/,/g, ""));
				if (!Number.isNaN(num) && Number.isFinite(num)) total += num;
			}
		}
		const totalFmt = new Intl.NumberFormat("es-DO", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(total);

		await ctx.reply(`📊 Ganancias de hoy para ${label}: RD$ ${totalFmt}`);
	} catch (e) {
		console.error("sendTodayIncomeSummary error:", e);
		await ctx.reply("⚠️ No pude obtener el resumen de hoy.");
	}
};

export default sendTodayIncomeSummary;
