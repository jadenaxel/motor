import { GetSession } from "../helpers";
import SendMainMenu from "./SendMainMenu";

const Menu = async (ctx: any, _, sessions: any): Promise<any> => {
	const s: any = GetSession(ctx, sessions);
	if (!s.lockedUser) return ctx.reply("Primero debes elegir un usuario con /iniciar.");
	await SendMainMenu(ctx, s);
};

export default Menu;
