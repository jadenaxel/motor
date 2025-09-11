import { GetSession } from "../helpers";

const AnyMessage = async (ctx: any, next: any, sessions: any): Promise<any> => {
	const s: any = GetSession(ctx, sessions);

	if (ctx.updateType === "message" && typeof ctx.message?.text === "string") {
		const txt: any = ctx.message.text.trim();
		if (txt.startsWith("/")) {
			const cmd: any = txt.split(" ")[0];

			if (!s.lockedUser && cmd !== "/iniciar") {
				await ctx.reply("Primero debes elegir un usuario con /iniciar.");
				return;
			}

			if (s.lockedUser && cmd !== "/cerrar") {
				await ctx.reply(`Ya iniciaste sesión como ${s.lockedUser}. Solo puedes usar /cerrar para salir.`);
				return;
			}
		}
	}

	if (ctx.updateType === "callback_query") {
		const data: any = ctx.callbackQuery?.data;

		if (!s.lockedUser && data !== "KING" && data !== "ZOHAN") {
			await ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
				show_alert: true,
			});
			return;
		}

		if (s.lockedUser && (data === "KING" || data === "ZOHAN") && data !== s.lockedUser) {
			await ctx.answerCbQuery("No puedes cambiar de usuario durante la sesión. Usa /cerrar primero.", { show_alert: true });
			return;
		}
	}

	return next();
};

export default AnyMessage;
