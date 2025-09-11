import { Markup } from "telegraf";
import { GetActiveUserLabel, GetSession } from "../helpers";

const AddIncome = async (ctx: any, next: any, sessions: any): Promise<any> => {
	await ctx.answerCbQuery().catch(() => {});
	const s: any = GetSession(ctx, sessions);
	if (!s.lockedUser) {
		return ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
			show_alert: true,
		});
	}
	const label: string | null = GetActiveUserLabel(s);
	s.pendingEntryType = "income";
	return ctx.reply(`📝 Registrar **Ganancia** para ${label} (ID: ${s.lockedUser}). Envía el monto o usa /cerrar para cancelar.`, {
		parse_mode: "Markdown",
		...Markup.inlineKeyboard([[Markup.button.callback("⬅️ Volver", "BACK_TO_MENU")]]),
	});
};

export default AddIncome;
