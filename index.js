import path from "path";

import { Telegraf, Markup } from "telegraf";
import { google } from "googleapis";

const INACTIVITY_MS = 30_000;

const inactivityTimers = new Map();

const sessions = new Map(); // chatId -> { lockedUser?: "KING" | "ZOHAN" }

// ===== Authorization (whitelist) =====
// Define allowed user IDs: you + 2 personas más.
// OPCIÓN A (recomendada): Usa variable de entorno BOT_ALLOWED_USERS con IDs separados por coma, ej:
// BOT_ALLOWED_USERS=123456789,987654321,555666777
const ENV_ALLOWED = (process.env.BOT_ALLOWED_USERS || "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n));

// OPCIÓN B: Fija aquí los IDs manualmente si no usas variables de entorno.
const FALLBACK_ALLOWED = [1463335496].filter((n) => Number.isInteger(n));

const ALLOWED_USERS = new Set(
    ENV_ALLOWED.length ? ENV_ALLOWED : FALLBACK_ALLOWED
);
// ===== end Authorization =====

function getSession(ctx) {
    const chatId = ctx.chat?.id;
    if (!chatId) return {};
    if (!sessions.has(chatId)) sessions.set(chatId, {});
    return sessions.get(chatId);
}

function getActiveUserLabel(session) {
    if (!session?.lockedUser) return null;
    return session.lockedUser === "KING"
        ? "Jose Manuel Polanco Nina"
        : "Victor Manuel Diaz";
}

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
    // keep digits, dots, commas, minus, and k/m suffixes; drop currency symbols and other chars
    s = s.replace(/[^0-9.,km\-]/g, "");

    // detect suffix multiplier (k = thousand, m = million)
    let multiplier = 1;
    if (s.endsWith("k")) {
        multiplier = 1_000;
        s = s.slice(0, -1);
    } else if (s.endsWith("m")) {
        multiplier = 1_000_000;
        s = s.slice(0, -1);
    }

    // common thousand separators
    // case 1: "12,000" -> remove commas
    let numeric = s.replace(/,/g, "");
    let val = parseFloat(numeric);

    // fallback: in case someone used comma as decimal separator (e.g., "12,5k")
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

// ===== Google Sheets config =====
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID; // <-- sustituye por tu Sheet ID o usa variables de entorno

function getSheetNameForUser(userId) {
    return userId === "KING" ? "King" : "Zohan";
}

// Ensures the sheet has the correct header row.
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

// Formats current datetime as "YYYY-MM-DD HH:MM:SS" (local time) for USER_ENTERED parsing in Sheets
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

// Ensures column C (Fecha) uses DATE_TIME format so values are stored as dates, not plain text
async function ensureFechaColumnFormat(sheetName) {
    const auth = await GoogleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth });

    // Find sheetId by name
    const meta = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });
    const sheet = meta.data.sheets.find(
        (s) => s.properties?.title === sheetName
    );
    if (!sheet) return;
    const sheetId = sheet.properties.sheetId;

    // Apply number format to entire column C (index 2)
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
// ===== end Google Sheets config =====

const BotInstance = new Telegraf(process.env.BOT_API_KEY);

// Whitelist middleware: solo usuarios permitidos pueden usar el bot
BotInstance.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !ALLOWED_USERS.has(userId)) {
        // Mensaje acorde al tipo de update
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
        return; // No continuar con el resto del flujo
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

// Guard middleware: when a user is locked in, block /iniciar and any other commands except /cerrar,
// and prevent selecting a different user via callback buttons.
BotInstance.use(async (ctx, next) => {
    const s = getSession(ctx);

    // Block /iniciar and any command other than /cerrar if already locked in
    if (ctx.updateType === "message" && typeof ctx.message?.text === "string") {
        const txt = ctx.message.text.trim();
        if (txt.startsWith("/")) {
            const cmd = txt.split(" ")[0];

            // If NO user is chosen yet, only allow /iniciar or /start
            if (!s.lockedUser && cmd !== "/iniciar") {
                await ctx.reply(
                    "Primero debes elegir un usuario con /iniciar."
                );
                return;
            }

            // If a user is already locked, only allow /cerrar
            if (s.lockedUser && cmd !== "/cerrar") {
                await ctx.reply(
                    `Ya iniciaste sesión como ${s.lockedUser}. Solo puedes usar /cerrar para salir.`
                );
                return;
            }
        }
    }

    // Prevent non-user actions before choosing a user, and prevent changing to a different user via callback while locked
    if (ctx.updateType === "callback_query") {
        const data = ctx.callbackQuery?.data;

        // If NO user chosen yet, only allow choosing user via KING/ZOHAN
        if (!s.lockedUser && data !== "KING" && data !== "ZOHAN") {
            await ctx.answerCbQuery("Primero elige un usuario con /iniciar.", {
                show_alert: true,
            });
            return;
        }

        // If already locked, prevent switching to the other identity
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
    const action = ctx.callbackQuery.data; // "KING" or "ZOHAN"
    const s = getSession(ctx);

    // If not locked yet, lock to the chosen user
    if (!s.lockedUser) {
        s.lockedUser = action;
        ctx.editMessageText(`Elegiste: ${action}`);
        return sendMainMenu(ctx, s);
    }

    // If locked to the same user, just acknowledge
    if (s.lockedUser === action) {
        return ctx.answerCbQuery("Ya estás usando este usuario.");
    }

    // If trying to change, block it (the guard middleware also handles this)
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
    const label = getActiveUserLabel(s);
    // Prepare expense flow: ask for category first
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

    // If we are awaiting the 'Otros' comment in expense flow, capture it here first
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

    // If we are expecting an amount for income/expense, try to parse it with flexible formats
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

            // Persist to Google Sheets
            try {
                await appendEntryToSheet({
                    userId: s.lockedUser,
                    userLabel: label,
                    type: s.pendingEntryType, // "income" | "expense"
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

            // Offer back navigation buttons depending on the flow that just finished
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
    // clear any pending states
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
    // restore expense category selection step
    s.pendingEntryType = "expense";
    s.pendingExpenseCategory = undefined;
    s.pendingExpenseOtherComment = undefined;
    s.awaitingOtherComment = false;
    return sendExpenseCategoryMenu(ctx, s);
});

BotInstance.catch((err) => console.error("Error en bot:", err));

BotInstance.launch().then();

process.once("SIGINT", () => BotInstance.stop("SIGINT"));
process.once("SIGTERM", () => BotInstance.stop("SIGTERM"));
