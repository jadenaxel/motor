import { GetSession } from "../helpers";
import SendMainMenu from "./SendMainMenu";

const BackToMenu = async (ctx: any, sessions: any) => {
	await ctx.answerCbQuery().catch(() => {});

	const s: any = GetSession(ctx, sessions);
	if (!s.lockedUser)
		return ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
			show_alert: true,
		});

	s.pendingEntryType = undefined;
	s.pendingExpenseCategory = undefined;
	s.pendingExpenseOtherComment = undefined;
	s.awaitingOtherComment = false;

	await SendMainMenu(ctx, s);
	return;
};

export default BackToMenu;
