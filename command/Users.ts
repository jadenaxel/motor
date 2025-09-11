import { GetSession } from "../helpers";
import SendMainMenu from "./SendMainMenu";

const Users = async (ctx: any, _, sessions: any): Promise<any> => {
	await ctx.answerCbQuery().catch(() => {});
	const action: any = ctx.callbackQuery.data;
	const s: any = GetSession(ctx, sessions);

	if (!s.lockedUser) {
		s.lockedUser = action;
		ctx.editMessageText(`Elegiste: ${action}`);
		await SendMainMenu(ctx, s);
		return;
	}

	if (s.lockedUser === action) return ctx.answerCbQuery("Ya estás usando este usuario.");

	return ctx.answerCbQuery("No puedes cambiar de usuario durante la sesión. Usa /cerrar.", { show_alert: true });
};

export default Users;
