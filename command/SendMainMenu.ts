import { Markup } from "telegraf";
import { IncomeSummary, GetActiveUserLabel } from "../helpers/";

const sendMainMenu = async (ctx: any, s: any): Promise<void> => {
	const label: string | null = GetActiveUserLabel(s);
	// Enviar resumen de ganancias del día justo debajo
	await IncomeSummary(ctx, s);

	await ctx.reply(
		`Menú principal para ${label}:`,
		Markup.inlineKeyboard([[Markup.button.callback("📈 Ganancias", "ADD_INCOME")], [Markup.button.callback("📉 Gastos", "ADD_EXPENSE")]])
	);
};

export default sendMainMenu;
