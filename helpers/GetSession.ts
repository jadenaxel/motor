const GetSession = (ctx: any, sessions: any) => {
	const chatId: any = ctx.chat?.id;
	if (!chatId) return {};
	if (!sessions.has(chatId)) sessions.set(chatId, {});
	return sessions.get(chatId);
};

export default GetSession;
