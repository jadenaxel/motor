import { SAFE_TOKEN_RE } from "../Constant.js";

const safeErr = (e: any): any => {
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

export default safeErr;
