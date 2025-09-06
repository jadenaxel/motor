const INACTIVITY_MS = 100_0000;
const SAFE_TOKEN_RE = /(bot|user)(\d+):[^/]+/g;

const getSession = (ctx, sessions) => {
	const chatId = ctx.chat?.id;
	if (!chatId) return {};
	if (!sessions.has(chatId)) sessions.set(chatId, {});
	return sessions.get(chatId);
};

const safeErr = (e) => {
	try {
		const msg = String(e?.message ?? e ?? "");
		return {
			name: e?.name || "Error",
			message: msg.replace(SAFE_TOKEN_RE, "$1$2:[REDACTED]"),
			stack: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 10).join("\n") : undefined,
		};
	} catch {
		return { name: "Error", message: "Unknown error" };
	}
};

export { INACTIVITY_MS, SAFE_TOKEN_RE, getSession, safeErr };
