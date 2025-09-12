import { Markup } from "telegraf";

import { AppendEntryToSheet, GetActiveUserLabel, GetSession, ParseAmount } from "../helpers";

const Text = async (ctx: any, sessions: any): Promise<any> => {
	const s: any = GetSession(ctx, sessions);
	const text: string = String(ctx.message?.text || "").trim();

	if (s.lockedUser && s.pendingEntryType === "expense" && s.awaitingOtherComment) {
		if (text.length < 2) return ctx.reply("El comentario es muy corto. Describe brevemente en qué se gastó el dinero.");

		s.pendingExpenseOtherComment = text;
		s.awaitingOtherComment = false;

		const label: string | null = GetActiveUserLabel(s);

		return ctx.reply(
			`Comentario registrado: "${text}". Ahora envía el monto del gasto para ${label}.`,
			Markup.inlineKeyboard([[Markup.button.callback("⬅️ Volver", "BACK_TO_EXPENSE_MENU")]])
		);
	}

	if (s.lockedUser && (s.pendingEntryType === "income" || s.pendingEntryType === "expense")) {
		const amount: number = ParseAmount(text);

		if (!Number.isNaN(amount) && Number.isFinite(amount)) {
			const label: string | null = GetActiveUserLabel(s);
			const kind: string = s.pendingEntryType === "income" ? "Ganancia" : "Gasto";

			let extra: any = "";
			let savedOk: any = false;

			if (s.pendingEntryType === "expense") {
				const cat: any = s.pendingExpenseCategory ? ` | Categoría: ${s.pendingExpenseCategory}` : "";
				const com: any = s.pendingExpenseOtherComment ? ` | Nota: ${s.pendingExpenseOtherComment}` : "";
				extra = cat + com;
			}

			try {
				await AppendEntryToSheet({
					userId: s.lockedUser,
					userLabel: label,
					type: s.pendingEntryType,
					amount,
					category: s.pendingEntryType === "expense" ? s.pendingExpenseCategory || "" : "Ganancias",
					note: s.pendingEntryType === "expense" ? s.pendingExpenseOtherComment || "" : "",
					chatId: ctx.chat?.id,
				});
				savedOk = true;
			} catch (err) {
				console.error("Sheets append error:", err);
			}

			// reset pending states
			s.pendingEntryType = undefined;
			s.pendingExpenseCategory = undefined;
			s.pendingExpenseOtherComment = undefined;
			s.awaitingOtherComment = false;

			const savedMsg: string = savedOk ? " 💾 Guardado en Google Sheets." : " ⚠️ No se pudo guardar en Google Sheets.";

			const wasExpense: boolean = kind === "Gasto";
			const keyboard: any = wasExpense
				? Markup.inlineKeyboard([
						[Markup.button.callback("⬅️ Volver a categorías", "BACK_TO_EXPENSE_MENU")],
						[Markup.button.callback("🏠 Menú principal", "BACK_TO_MENU")],
				  ])
				: Markup.inlineKeyboard([[Markup.button.callback("🏠 Menú principal", "BACK_TO_MENU")]]);

			return ctx.reply(`✅ ${kind} registrada para ${label} (ID: ${s.lockedUser}) por RD$ ${amount.toFixed(2)}.${extra}${savedMsg}`, {
				...keyboard,
			});
		} else {
			{
				const isExpense: boolean = s.pendingEntryType === "expense";
				const keyboard = isExpense
					? Markup.inlineKeyboard([
							[Markup.button.callback("⬅️ Volver a categorías", "BACK_TO_EXPENSE_MENU")],
							[Markup.button.callback("🏠 Menú principal", "BACK_TO_MENU")],
					  ])
					: Markup.inlineKeyboard([[Markup.button.callback("🏠 Menú principal", "BACK_TO_MENU")]]);
				return ctx.reply("❗Formato inválido. Envía solo la cantidad. Ejemplos válidos: 12000, 12,000, 12k, 12.5k", {
					...keyboard,
				});
			}
		}
	}

	return ctx.reply("Comando no registrado. Prueba /iniciar");
};

export default Text;
