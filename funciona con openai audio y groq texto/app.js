import path from 'path';
import fs from 'fs';
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot';
import { JsonFileDB as Database } from '@builderbot/database-json';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { appendToSheet, readSheet } from './utils.js';
import { chat } from './groqapi.js';
import { voiceFlow } from './voiceFlow.js';

const PORT = process.env.PORT ?? 3008;

// Cargar el archivo prompt.json
const promptData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/prompt.json'), 'utf8'));

// Define flowGPT for financial assistant
const flowGPT = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, ctxFn) => {
        const phoneNumber = ctx.from;
        const registros = await readSheet("CPotencial!A1:F10");

        const existingRecord = registros.find(row => row[3] === phoneNumber);

        if (existingRecord) {
            const estadoProceso = existingRecord[5];
            await ctxFn.flowDynamic(`Hola, veo que ya tienes un proceso registrado. Tu estado actual es: ${estadoProceso}`);
            await ctxFn.flowDynamic("Si tienes más consultas o dudas al respecto, comunícate al WA 5730256648.");
        } else {
            const text = `${ctx.body}`;
            const response = await chat(text);
            await ctxFn.flowDynamic(response);
        }
    });

// Define flowHistory for showing history
const flowHistory = addKeyword("Historial")
    .addAnswer("Este es el flujo historial", null,
        async (ctx, ctxFn) => {
            const response = await readSheet("CPotencial!A1:E10");
            console.log(response);
        }
    );

// Define flowPrincipal for handling expenses
const flowPrincipal = addKeyword(["Gastos"])
    .addAnswer('Hola bienvenido al flujo')
    .addAnswer('Nombre del gasto', { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ name: ctx.body });
        }
    )
    .addAnswer('Monto del gasto', { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ amount: ctx.body });
        }
    )
    .addAnswer('Categoria del gasto', { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ category: ctx.body });
        }
    )
    .addAnswer('Gracias. Tus datos fueron registrados', null,
        async (ctx, ctxFn) => {
            const name = ctxFn.state.get("name");
            const amount = ctxFn.state.get("amount");
            const category = ctxFn.state.get("category");
            const phoneNumber = ctx.from;
            const date = new Date().toLocaleString();

            await appendToSheet([[name, amount, category, phoneNumber, date]]);
        }
    );

// Initialize the bot with flows, provider, and database
const main = async () => {
    const adapterFlow = createFlow([flowPrincipal, flowGPT, flowHistory, voiceFlow]);
    const adapterProvider = createProvider(Provider);
    const adapterDB = new Database({ filename: 'db.json' });

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body;
            await bot.sendMessage(number, message, { media: urlMedia ?? null });
            return res.end('sended');
        })
    );

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body;
            await bot.dispatch('REGISTER_FLOW', { from: number, name });
            return res.end('trigger');
        })
    );

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body;
            await bot.dispatch('SAMPLES', { from: number, name });
            return res.end('trigger');
        })
    );

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body;
            if (intent === 'remove') bot.blacklist.remove(number);
            if (intent === 'add') bot.blacklist.add(number);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ok', number, intent }));
        })
    );

    httpServer(+PORT);
};

main();