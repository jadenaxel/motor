

// const EndSession = (ctx: any): any => {
// 	ctx.session = {};
// 	const chatId: any = ctx.chat?.id;
// 	if (chatId) {
// 		sessions.delete(chatId);
// 		const t: any = inactivityTimers.get(chatId);
// 		if (t) clearTimeout(t);
// 		inactivityTimers.delete(chatId);
// 	}
// 	try {
// 		if (ctx.callbackQuery?.message?.message_id) ctx.editMessageReplyMarkup();
// 	} catch (e) {}
// 	return ctx.telegram.sendMessage(ctx.chat.id, "🔒 Sesión expirada.");
// };

// export default EndSession;
