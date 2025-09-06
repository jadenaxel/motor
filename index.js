import path from "path";

import { Telegraf, Markup } from "telegraf";
import { google } from "googleapis";

const INACTIVITY_MS = 100_0000;

const inactivityTimers = new Map();

const sessions = new Map();

const ENV_ALLOWED = (process.env.BOT_ALLOWED_USERS || "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n));

const FALLBACK_ALLOWED = [].filter((n) => Number.isInteger(n));

const ALLOWED_USERS = new Set(
    ENV_ALLOWED.length ? ENV_ALLOWED : FALLBACK_ALLOWED
);

const getSession = (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return {};
    if (!sessions.has(chatId)) sessions.set(chatId, {});
    return sessions.get(chatId);
};

const getActiveUserLabel = (session) => {
    if (!session?.lockedUser) return null;
    return session.lockedUser === "KING"
        ? "Jose Manuel Polanco Nina"
        : "Victor Manuel Diaz";
};

function sendMainMenu(ctx, s) {
    const label = getActiveUserLabel(s);
    return ctx.reply(
        `Menú principal para ${label}:`,
        Markup.inlineKeyboard([
            [Markup.button.callback("📈 Ganancias", "ADD_INCOME")],
            [Markup.button.callback("📉 Gastos", "ADD_EXPENSE")],
        ])
    );
}

function sendExpenseCategoryMenu(ctx, s) {
    const label = getActiveUserLabel(s);
    return ctx.reply(
        `¿En qué categoría fue el gasto para ${label}?`,
        Markup.inlineKeyboard([
            [Markup.button.callback("⛽ Gasolina", "EXP_CAT_GASOLINA")],
            [Markup.button.callback("🛢️ Aceite", "EXP_CAT_ACEITE")],
            [
                Markup.button.callback(
                    "🧰 Mantenimiento",
                    "EXP_CAT_MANTENIMIENTO"
                ),
            ],
            [Markup.button.callback("🔩 Piezas", "EXP_CAT_PIEZAS")],
            [Markup.button.callback("📝 Otros", "EXP_CAT_OTROS")],
            [Markup.button.callback("⬅️ Volver", "BACK_TO_MENU")],
        ])
    );
}

function parseAmount(input) {
    if (input == null) return NaN;
    let s = String(input).trim().toLowerCase();
    s = s.replace(/[^0-9.,km\-]/g, "");

    let multiplier = 1;
    if (s.endsWith("k")) {
        multiplier = 1_000;
        s = s.slice(0, -1);
    } else if (s.endsWith("m")) {
        multiplier = 1_000_000;
        s = s.slice(0, -1);
    }

    let numeric = s.replace(/,/g, "");
    let val = parseFloat(numeric);

    if (Number.isNaN(val)) {
        numeric = s.replace(/\./g, "").replace(/,/g, ".");
        val = parseFloat(numeric);
    }

    if (Number.isNaN(val)) return NaN;
    return val * multiplier;
}

const GoogleAuth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "credentials.json"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

function getSheetNameForUser(userId) {
    return userId === "KING" ? "King" : "Zohan";
}

async function ensureSheetHeader(sheetName) {
    const auth = await GoogleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth });
    const expectedHeader = [
        "ID",
        "Nombre",
        "Fecha",
        "Categoria",
        "Cantidad",
        "Comentario",
    ];
    const range = `${sheetName}!A1:F1`;
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range,
    });
    const firstRow =
        res.data.values && res.data.values[0] ? res.data.values[0] : [];
    let needsUpdate = false;
    if (firstRow.length !== expectedHeader.length) {
        needsUpdate = true;
    } else {
        for (let i = 0; i < expectedHeader.length; ++i) {
            if (firstRow[i] !== expectedHeader[i]) {
                needsUpdate = true;
                break;
            }
        }
    }
    if (needsUpdate) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range,
            valueInputOption: "RAW",
            requestBody: { values: [expectedHeader] },
        });
    }
}

function nowAsSheetsText() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const HH = pad(d.getHours());
    const MM = pad(d.getMinutes());
    const SS = pad(d.getSeconds());
    return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
}

async function ensureFechaColumnFormat(sheetName) {
    const auth = await GoogleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth });

    const meta = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });
    const sheet = meta.data.sheets.find(
        (s) => s.properties?.title === sheetName
    );
    if (!sheet) return;
    const sheetId = sheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [
                {
                    repeatCell: {
                        range: {
                            sheetId,
                            startColumnIndex: 2,
                            endColumnIndex: 3,
                        },
                        cell: {
                            userEnteredFormat: {
                                numberFormat: {
                                    type: "DATE_TIME",
                                    pattern: "yyyy-mm-dd hh:mm:ss",
                                },
                            },
                        },
                        fields: "userEnteredFormat.numberFormat",
                    },
                },
            ],
        },
    });
}

async function appendEntryToSheet({
    userId,
    userLabel,
    type,
    amount,
    category,
    note,
    chatId,
}) {
    const auth = await GoogleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth });
    const sheetName = getSheetNameForUser(userId);
    await ensureSheetHeader(sheetName);
    await ensureFechaColumnFormat(sheetName);
    // Header: ["ID","Nombre","Fecha","Categoria","Cantidad","Comentario"]
    const values = [
        [
            userId,
            userLabel || "",
            nowAsSheetsText(),
            category || "",
            Number(amount),
            note || "",
        ],
    ];
    return sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:A`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
    });
}

const BotInstance = new Telegraf(process.env.BOT_API_KEY);

BotInstance.use(async (ctx, next) => {
    const userId = ctx.from?.id;
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
});

function endSession(ctx) {
    ctx.session = {};
    const chatId = ctx.chat?.id;
    if (chatId) {
        sessions.delete(chatId);
        const t = inactivityTimers.get(chatId);
        if (t) clearTimeout(t);
        inactivityTimers.delete(chatId);
    }
    try {
        if (ctx.callbackQuery?.message?.message_id)
            ctx.editMessageReplyMarkup();
    } catch (e) {}
    return ctx.telegram.sendMessage(ctx.chat.id, "🔒 Sesión expirada.");
}

function resetInactivity(ctx) {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const t = inactivityTimers.get(chatId);
    if (t) clearTimeout(t);

    const newTimer = setTimeout(() => {
        endSession(ctx).catch(() => {});
        inactivityTimers.delete(chatId);
    }, INACTIVITY_MS);

    inactivityTimers.set(chatId, newTimer);
}

BotInstance.use(async (ctx, next) => {
    const s = getSession(ctx);

    if (ctx.updateType === "message" && typeof ctx.message?.text === "string") {
        const txt = ctx.message.text.trim();
        if (txt.startsWith("/")) {
            const cmd = txt.split(" ")[0];

            if (!s.lockedUser && cmd !== "/iniciar") {
                await ctx.reply(
                    "Primero debes elegir un usuario con /iniciar."
                );
                return;
            }

            if (s.lockedUser && cmd !== "/cerrar") {
                await ctx.reply(
                    `Ya iniciaste sesión como ${s.lockedUser}. Solo puedes usar /cerrar para salir.`
                );
                return;
            }
        }
    }

    if (ctx.updateType === "callback_query") {
        const data = ctx.callbackQuery?.data;

        if (!s.lockedUser && data !== "KING" && data !== "ZOHAN") {
            await ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
                show_alert: true,
            });
            return;
        }

        if (
            s.lockedUser &&
            (data === "KING" || data === "ZOHAN") &&
            data !== s.lockedUser
        ) {
            await ctx.answerCbQuery(
                "No puedes cambiar de usuario durante la sesión. Usa /cerrar primero.",
                { show_alert: true }
            );
            return;
        }
    }

    return next();
});

BotInstance.use((ctx, next) => {
    resetInactivity(ctx);
    return next();
});

BotInstance.start((ctx) =>
    ctx.reply("Bienvenido a Motor Bot! Usa /iniciar para ver opciones.")
);


BotInstance.command("mi_id", (ctx) => {
    const userId = ctx.from?.id;
    return ctx.reply(`Tu user.id es: ${userId}`);
});

// Comando de mantenimiento para limpiar webhook y updates pendientes
BotInstance.command("fix409", async (ctx) => {
    try {
        await BotInstance.telegram.deleteWebhook({ drop_pending_updates: true });
        await ctx.reply("✅ Webhook eliminado y updates pendientes descartados. Si el 409 persiste, reinicia el servicio.");
    } catch (e) {
        console.error("fix409 error:", e);
        await ctx.reply("⚠️ No pude limpiar el webhook. Revisa logs.");
    }
});

BotInstance.command("iniciar", (ctx) => {
    const s = getSession(ctx);
    if (s.lockedUser) {
        return ctx.reply(
            `Ya iniciaste sesión como ${s.lockedUser}. Usa /cerrar para salir.`
        );
    }
    return ctx.reply(
        "Soy:",
        Markup.inlineKeyboard([
            [Markup.button.callback("Jose Manuel Polanco Nina", "KING")],
            [Markup.button.callback("Victor Manuel Diaz", "ZOHAN")],
        ])
    );
});

BotInstance.command("menu", (ctx) => {
    const s = getSession(ctx);
    if (!s.lockedUser) {
        return ctx.reply("Primero debes elegir un usuario con /iniciar.");
    }
    return sendMainMenu(ctx, s);
});

BotInstance.action(["KING", "ZOHAN"], async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const action = ctx.callbackQuery.data;
    const s = getSession(ctx);

    if (!s.lockedUser) {
        s.lockedUser = action;
        ctx.editMessageText(`Elegiste: ${action}`);
        return sendMainMenu(ctx, s);
    }

    if (s.lockedUser === action) {
        return ctx.answerCbQuery("Ya estás usando este usuario.");
    }

    return ctx.answerCbQuery(
        "No puedes cambiar de usuario durante la sesión. Usa /cerrar.",
        { show_alert: true }
    );
});

BotInstance.action("ADD_INCOME", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const s = getSession(ctx);
    if (!s.lockedUser) {
        return ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
            show_alert: true,
        });
    }
    const label = getActiveUserLabel(s);
    s.pendingEntryType = "income";
    return ctx.reply(
        `📝 Registrar **Ganancia** para ${label} (ID: ${s.lockedUser}). Envía el monto o usa /cerrar para cancelar.`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("⬅️ Volver", "BACK_TO_MENU")],
            ]),
        }
    );
});

BotInstance.action("ADD_EXPENSE", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const s = getSession(ctx);
    if (!s.lockedUser) {
        return ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
            show_alert: true,
        });
    }
    s.pendingEntryType = "expense";
    s.pendingExpenseCategory = undefined;
    s.pendingExpenseOtherComment = undefined;
    s.awaitingOtherComment = false;
    return sendExpenseCategoryMenu(ctx, s);
});

BotInstance.action(
    [
        "EXP_CAT_GASOLINA",
        "EXP_CAT_ACEITE",
        "EXP_CAT_MANTENIMIENTO",
        "EXP_CAT_PIEZAS",
        "EXP_CAT_OTROS",
    ],
    async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const s = getSession(ctx);
        if (!s.lockedUser) {
            return ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
                show_alert: true,
            });
        }
        if (s.pendingEntryType !== "expense") {
            return ctx.answerCbQuery(
                "Selecciona primero 'Gastos' en el menú.",
                { show_alert: true }
            );
        }
        const data = ctx.callbackQuery?.data;
        const map = {
            EXP_CAT_GASOLINA: "Gasolina",
            EXP_CAT_ACEITE: "Aceite",
            EXP_CAT_MANTENIMIENTO: "Mantenimiento",
            EXP_CAT_PIEZAS: "Piezas",
            EXP_CAT_OTROS: "Otros",
        };
        s.pendingExpenseCategory = map[data] || "Otros";

        if (data === "EXP_CAT_OTROS") {
            s.awaitingOtherComment = true;
            return ctx.reply(
                "📝 Escribe un comentario breve de en qué se gastó el dinero (ej.: Peaje, Parqueo, Lavado).",
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback(
                            "⬅️ Volver",
                            "BACK_TO_EXPENSE_MENU"
                        ),
                    ],
                ])
            );
        }

        const label = getActiveUserLabel(s);
        return ctx.reply(
            `📝 Registrar **Gasto** (${s.pendingExpenseCategory}) para ${label}. Envía el monto o usa /cerrar para cancelar.`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(
                            "⬅️ Volver",
                            "BACK_TO_EXPENSE_MENU"
                        ),
                    ],
                ]),
            }
        );
    }
);

BotInstance.command("cerrar", (ctx) => endSession(ctx));

BotInstance.on("text", async (ctx) => {
    const s = getSession(ctx);
    const text = String(ctx.message?.text || "").trim();

    if (
        s.lockedUser &&
        s.pendingEntryType === "expense" &&
        s.awaitingOtherComment
    ) {
        if (text.length < 2) {
            return ctx.reply(
                "El comentario es muy corto. Describe brevemente en qué se gastó el dinero."
            );
        }
        s.pendingExpenseOtherComment = text;
        s.awaitingOtherComment = false;
        const label = getActiveUserLabel(s);
        return ctx.reply(
            `Comentario registrado: "${text}". Ahora envía el monto del gasto para ${label}.`,
            Markup.inlineKeyboard([
                [Markup.button.callback("⬅️ Volver", "BACK_TO_EXPENSE_MENU")],
            ])
        );
    }

    if (
        s.lockedUser &&
        (s.pendingEntryType === "income" || s.pendingEntryType === "expense")
    ) {
        const amount = parseAmount(text);
        if (!Number.isNaN(amount) && Number.isFinite(amount)) {
            const label = getActiveUserLabel(s);
            const kind = s.pendingEntryType === "income" ? "Ganancia" : "Gasto";

            let extra = "";
            let savedOk = false;
            if (s.pendingEntryType === "expense") {
                const cat = s.pendingExpenseCategory
                    ? ` | Categoría: ${s.pendingExpenseCategory}`
                    : "";
                const com = s.pendingExpenseOtherComment
                    ? ` | Nota: ${s.pendingExpenseOtherComment}`
                    : "";
                extra = cat + com;
            }

            try {
                await appendEntryToSheet({
                    userId: s.lockedUser,
                    userLabel: label,
                    type: s.pendingEntryType,
                    amount,
                    category:
                        s.pendingEntryType === "expense"
                            ? s.pendingExpenseCategory || ""
                            : "Ganancias",
                    note:
                        s.pendingEntryType === "expense"
                            ? s.pendingExpenseOtherComment || ""
                            : "",
                    chatId: ctx.chat?.id,
                });
                savedOk = true;
            } catch (err) {
                console.error("Sheets append error:", err);
            }

            // reset pending states
            s.pendingEntryType = undefined;
            s.pendingExpenseCategory = undefined;
            s.pendingExpenseOtherComment = undefined;
            s.awaitingOtherComment = false;

            const savedMsg = savedOk
                ? " 💾 Guardado en Google Sheets."
                : " ⚠️ No se pudo guardar en Google Sheets.";

            const wasExpense = kind === "Gasto";
            const keyboard = wasExpense
                ? Markup.inlineKeyboard([
                      [
                          Markup.button.callback(
                              "⬅️ Volver a categorías",
                              "BACK_TO_EXPENSE_MENU"
                          ),
                      ],
                      [
                          Markup.button.callback(
                              "🏠 Menú principal",
                              "BACK_TO_MENU"
                          ),
                      ],
                  ])
                : Markup.inlineKeyboard([
                      [
                          Markup.button.callback(
                              "🏠 Menú principal",
                              "BACK_TO_MENU"
                          ),
                      ],
                  ]);

            return ctx.reply(
                `✅ ${kind} registrada para ${label} (ID: ${
                    s.lockedUser
                }) por RD$ ${amount.toFixed(2)}.${extra}${savedMsg}`,
                {
                    ...keyboard,
                }
            );
        } else {
            {
                const isExpense = s.pendingEntryType === "expense";
                const keyboard = isExpense
                    ? Markup.inlineKeyboard([
                          [
                              Markup.button.callback(
                                  "⬅️ Volver a categorías",
                                  "BACK_TO_EXPENSE_MENU"
                              ),
                          ],
                          [
                              Markup.button.callback(
                                  "🏠 Menú principal",
                                  "BACK_TO_MENU"
                              ),
                          ],
                      ])
                    : Markup.inlineKeyboard([
                          [
                              Markup.button.callback(
                                  "🏠 Menú principal",
                                  "BACK_TO_MENU"
                              ),
                          ],
                      ]);
                return ctx.reply(
                    "❗Formato inválido. Envía solo la cantidad. Ejemplos válidos: 12000, 12,000, 12k, 12.5k",
                    {
                        ...keyboard,
                    }
                );
            }
        }
    }

    return ctx.reply("Comando no registrado. Prueba /iniciar");
});

BotInstance.action("BACK_TO_MENU", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const s = getSession(ctx);
    if (!s.lockedUser) {
        return ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
            show_alert: true,
        });
    }
    s.pendingEntryType = undefined;
    s.pendingExpenseCategory = undefined;
    s.pendingExpenseOtherComment = undefined;
    s.awaitingOtherComment = false;
    return sendMainMenu(ctx, s);
});

BotInstance.action("BACK_TO_EXPENSE_MENU", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const s = getSession(ctx);
    if (!s.lockedUser) {
        return ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
            show_alert: true,
        });
    }
    s.pendingEntryType = "expense";
    s.pendingExpenseCategory = undefined;
    s.pendingExpenseOtherComment = undefined;
    s.awaitingOtherComment = false;
    return sendExpenseCategoryMenu(ctx, s);
});

BotInstance.catch((err) => console.error("Error en bot:", err));

// Lanzar en modo polling asegurando que no exista webhook ni updates pendientes
(async () => {
    try {
        const wh = await BotInstance.telegram.getWebhookInfo();
        if (wh && wh.url) {
            console.log("Webhook detectado; eliminando antes de iniciar polling:", wh.url);
            await BotInstance.telegram.deleteWebhook({ drop_pending_updates: true });
        }
        await BotInstance.launch({ dropPendingUpdates: true });
        console.log("Bot lanzado en polling con dropPendingUpdates.");
    } catch (err) {
        console.error("Error al lanzar el bot:", err);
    }
})();

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
server.listen(PORT, () => {
    console.log(`HTTP health server listening on port ${PORT}`);
});
// --------------------------------------------------------------------

process.once("SIGINT", () => {
    try { server.close(); } catch {}
    console.log("Cierre por SIGINT");
    BotInstance.stop("SIGINT");
});
process.once("SIGTERM", () => {
    try { server.close(); } catch {}
    console.log("Cierre por SIGTERM");
    BotInstance.stop("SIGTERM");
});
