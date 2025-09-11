const CheckPermission = async (ctx: any, next: any, allow_users: any): Promise<any> => {
	const ALLOWED_USERS = allow_users;
	const userId: any = ctx.from?.id;

	if (!userId || !ALLOWED_USERS.has(userId)) {
		if (ctx.updateType === "callback_query") {
			await ctx
				.answerCbQuery("🚫 No tienes permiso para usar este bot.", {
					show_alert: true,
				})
				.catch(() => {});
		}
		if (ctx.updateType === "message") {
			await ctx.reply("🚫 No tienes permiso para usar este bot.");
		}
		return;
	}
	return next();
};

export default CheckPermission;
