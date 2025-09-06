import { Markup } from "telegraf";
import { GetActiveUserLabel } from "../helpers/";

const SendExpenseCategoryMenu = (ctx: any, s: any): any => {
	const label: string | null = GetActiveUserLabel(s);
	return ctx.reply(
		`¿En qué categoría fue el gasto para ${label}?`,
		Markup.inlineKeyboard([
			[Markup.button.callback("⛽ Gasolina", "EXP_CAT_GASOLINA")],
			[Markup.button.callback("🛢️ Aceite", "EXP_CAT_ACEITE")],
			[Markup.button.callback("🧰 Mantenimiento", "EXP_CAT_MANTENIMIENTO")],
			[Markup.button.callback("🔩 Piezas", "EXP_CAT_PIEZAS")],
			[Markup.button.callback("📝 Otros", "EXP_CAT_OTROS")],
			[Markup.button.callback("⬅️ Volver", "BACK_TO_MENU")],
		])
	);
};

export default SendExpenseCategoryMenu;
