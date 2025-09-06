import { Markup } from "telegraf";
import { IncomeSummary } from "./helpers/";
import { GetActiveUserLabel } from "./helpers";

// Envía el menú principal y el resumen de ganancias del día
const sendMainMenu = async (ctx: any, s: any) => {
	const label: string | null = GetActiveUserLabel(s);
	// Enviar resumen de ganancias del día justo debajo
	await IncomeSummary(ctx, s);

	await ctx.reply(
		`Menú principal para ${label}:`,
		Markup.inlineKeyboard([[Markup.button.callback("📈 Ganancias", "ADD_INCOME")], [Markup.button.callback("📉 Gastos", "ADD_EXPENSE")]])
	);
};

export { sendMainMenu };
