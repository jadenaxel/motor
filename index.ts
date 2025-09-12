import { Telegraf } from "telegraf";

import { INACTIVITY_MS } from "./Constant";
import { CheckPermission, AnyMessage, Start, Menu, Users, AddIncome, AddExpense, ExpenseCategories, Text, BackToMenu, BackToExpenseMenu } from "./command";
import { SafeError, EndSession, ResetInactivity } from "./helpers/";

import "./Process.js";

try {
	// @ts-ignore
	import("telegraf/lib/core/network/client.js")
		.then((mod: any) => {
			if (mod && typeof mod.redactToken === "function") {
				const original = mod.redactToken;
				mod.redactToken = function safeRedact(error: any) {
					try {
						// Try original behavior
						return original.call(this, error);
					} catch (e) {
						// Fallback: do not mutate error.message; just return the same error
						return error;
					}
				};
				console.log("[patch] Applied safe redactToken for Telegraf client");
			}
		})
		.catch(() => {
			// No-op if internal path changes
		});
} catch {}
// -----------------------------------------------------------------------------------------------

const BotInstance: any = new Telegraf(process.env.BOT_API_KEY || "");

// Maps to track inactivity timers and sessions per chat ID
const inactivityTimers: Map<any, any> = new Map();
const sessions: Map<any, any> = new Map();

const EXPENSE_CATEGORIES: string[] = ["EXP_CAT_GASOLINA", "EXP_CAT_ACEITE", "EXP_CAT_MANTENIMIENTO", "EXP_CAT_PIEZAS", "EXP_CAT_OTROS"];
const ENV_ALLOWED: number[] = (process.env.BOT_ALLOWED_USERS || "")
	.split(",")
	.map((s) => parseInt(s.trim(), 10))
	.filter((n) => Number.isInteger(n));
const FALLBACK_ALLOWED: any[] = [].filter((n) => Number.isInteger(n));
const ALLOWED_USERS: Set<any> = new Set(ENV_ALLOWED.length ? ENV_ALLOWED : FALLBACK_ALLOWED);

BotInstance.use(async (ctx: any, next: any) => CheckPermission(ctx, next, ALLOWED_USERS));
BotInstance.use(async (ctx: any, next: any) => AnyMessage(ctx, next, sessions));

BotInstance.use((ctx: any, next: any) => {
	ResetInactivity(ctx, sessions, inactivityTimers, INACTIVITY_MS);
	return next();
});

BotInstance.start((ctx: any) => ctx.reply("Bienvenido a Motor Bot! Usa /iniciar para ver opciones."));
BotInstance.command("iniciar", (ctx: any) => Start(ctx, undefined, sessions));
BotInstance.command("menu", async (ctx: any) => Menu(ctx, undefined, sessions));
BotInstance.action(["KING", "ZOHAN"], async (ctx: any) => Users(ctx, undefined, sessions));
BotInstance.action("ADD_INCOME", async (ctx: any) => AddIncome(ctx, undefined, sessions));
BotInstance.action("ADD_EXPENSE", async (ctx: any) => AddExpense(ctx, undefined, sessions));
BotInstance.action(EXPENSE_CATEGORIES, async (ctx: any) => ExpenseCategories(ctx, sessions));
BotInstance.command("cerrar", (ctx: any) => EndSession(ctx, sessions, inactivityTimers));
BotInstance.on("text", async (ctx: any) => Text(ctx, sessions));
BotInstance.action("BACK_TO_MENU", async (ctx: any) => BackToMenu(ctx, sessions));
BotInstance.action("BACK_TO_EXPENSE_MENU", async (ctx: any) => BackToExpenseMenu(ctx, sessions));
BotInstance.catch((err: any, ctx: any) => console.error("Error en bot:", SafeError(err), "ctxType:", ctx?.updateType));

// Lanzar en modo polling asegurando que no exista webhook ni updates pendientes
(async () => {
	try {
		const wh: any = await BotInstance.telegram.getWebhookInfo();
		if (wh && wh.url) {
			console.log("Webhook detectado; eliminando antes de iniciar polling:", wh.url);
			await BotInstance.telegram.deleteWebhook({
				drop_pending_updates: true,
			});
		}
		await BotInstance.launch({ dropPendingUpdates: true });
		console.log("Bot lanzado en polling con dropPendingUpdates.");
	} catch (err) {
		console.error("Error al lanzar el bot:", err);
	}
})();

// Keep-alive ping each 1 minute to surface auth/network issues without crashing
setInterval(() => {
	BotInstance.telegram.getMe().catch((e: any) => {
		console.error("keepAlive getMe error:", SafeError(e));
	});
}, 1 * 60 * 1000);

// --- Minimal HTTP server so hosting platforms detect an open port ---
import http from "http";
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const server = http.createServer((req, res) => {
	// Lightweight health endpoint
	if (req.url === "/health") {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ ok: true }));
		return;
	}
	res.writeHead(200, { "Content-Type": "text/plain" });
	res.end("Motor Bot running");
});
server.listen(PORT, () => console.log(`HTTP health server listening on port ${PORT}`));
// --------------------------------------------------------------------

process.once("SIGINT", () => {
	try {
		server.close();
	} catch {}
	console.log("Cierre por SIGINT");
	BotInstance.stop("SIGINT");
});
process.once("SIGTERM", () => {
	try {
		server.close();
	} catch {}
	console.log("Cierre por SIGTERM");
	BotInstance.stop("SIGTERM");
});
