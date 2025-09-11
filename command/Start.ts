import { Markup } from "telegraf";

import { GetSession } from "../helpers";

const Start = (ctx: any, _, sessions: any): any => {
	const s: any = GetSession(ctx, sessions);

	if (s.lockedUser) return ctx.reply(`Ya iniciaste sesión como ${s.lockedUser}. Usa /cerrar para salir.`);

	return ctx.reply(
		"Quien eres?",
		Markup.inlineKeyboard([[Markup.button.callback("Jose Manuel Polanco Nina", "KING")], [Markup.button.callback("Victor Manuel Diaz", "ZOHAN")]])
	);
};

export default Start;
