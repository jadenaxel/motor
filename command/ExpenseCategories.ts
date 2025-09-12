import { Markup } from "telegraf";

import { GetActiveUserLabel, GetSession } from "../helpers";

const ExpenseCategories = async (ctx: any, sessions: any) => {
	await ctx.answerCbQuery().catch(() => {});

	const s: any = GetSession(ctx, sessions);
	if (!s.lockedUser)
		return ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
			show_alert: true,
		});

	if (s.pendingEntryType !== "expense") return ctx.answerCbQuery("Selecciona primero 'Gastos' en el menú.", { show_alert: true });

	const data: any = ctx.callbackQuery?.data;
	const map: any = {
		EXP_CAT_GASOLINA: "Gasolina",
		EXP_CAT_ACEITE: "Aceite",
		EXP_CAT_MANTENIMIENTO: "Mantenimiento",
		EXP_CAT_PIEZAS: "Piezas",
		EXP_CAT_OTROS: "Otros",
	};

	s.pendingExpenseCategory = map[data] || "Otros";

	if (data === "EXP_CAT_OTROS") {
		s.awaitingOtherComment = true;
		return ctx.reply(
			"📝 Escribe un comentario breve de en qué se gastó el dinero (ej.: Peaje, Parqueo, Lavado).",
			Markup.inlineKeyboard([[Markup.button.callback("⬅️ Volver", "BACK_TO_EXPENSE_MENU")]])
		);
	}

	const label: string | null = GetActiveUserLabel(s);

	return ctx.reply(`📝 Registrar **Gasto** (${s.pendingExpenseCategory}) para ${label}. Envía el monto o usa /cerrar para cancelar.`, {
		parse_mode: "Markdown",
		...Markup.inlineKeyboard([[Markup.button.callback("⬅️ Volver", "BACK_TO_EXPENSE_MENU")]]),
	});
};

export default ExpenseCategories;
