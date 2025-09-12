import { GetSession } from "../helpers/";
import SendExpenseCategoryMenu from "./SendExpenseCategoryMenu";

const BackToExpenseMenu = async (ctx: any, sessions: any): Promise<void> => {
	await ctx.answerCbQuery().catch(() => {});

	const s: any = GetSession(ctx, sessions);

	if (!s.lockedUser)
		return ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
			show_alert: true,
		});

	s.pendingEntryType = "expense";
	s.pendingExpenseCategory = undefined;
	s.pendingExpenseOtherComment = undefined;
	s.awaitingOtherComment = false;

	return SendExpenseCategoryMenu(ctx, s);
};

export default BackToExpenseMenu;