import EndSession from "./EndSession";

const ResetInactivity = (ctx: any, sessions: any, inactivityTimers: any, INACTIVITY_MS: any): any => {
	const chatId: any = ctx.chat?.id;
	if (!chatId) return;

	const t: any = inactivityTimers.get(chatId);
	if (t) clearTimeout(t);

	const newTimer = setTimeout(() => {
		EndSession(ctx, sessions, inactivityTimers).catch(() => {});
		inactivityTimers.delete(chatId);
	}, INACTIVITY_MS);

	inactivityTimers.set(chatId, newTimer);
};

export default ResetInactivity;
