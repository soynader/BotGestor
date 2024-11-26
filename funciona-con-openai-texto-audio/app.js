
import path, { join } from 'path';
import fs from 'fs';
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot';
import { JsonFileDB as Database } from '@builderbot/database-json';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { appendToSheet, readSheet } from './utils.js';
// ... (other imports remain the same)
import { chat } from './openai.js';
// ... (rest of the file remains the same)
import { voiceFlow } from './voiceFlow.js';
// Cargar el archivo prompt.json
const promptData = JSON.parse(fs.readFileSync(join(process.cwd(), 'src/prompt.json'), 'utf8'));
const PORT = process.env.PORT ?? 3008;
// Define flowGPT for financial assistant
const flowGPT = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, ctxFn) => {
        const phoneNumber = ctx.from; // Número de WhatsApp del contacto
        const registros = await readSheet("CPotencial!A1:F10"); // Consultamos la hoja
        // Buscamos el número en los registros y obtenemos el estado del proceso (columna 5)
        const existingRecord = registros.find(row => row[3] === phoneNumber);
        if (existingRecord) {
            // Si ya tiene un proceso, obtener el estado desde la columna 5 (Estado del proceso)
            const estadoProceso = existingRecord[5]; // Columna 5: Estado del proceso
            // Responder al usuario con el estado del proceso
            await ctxFn.flowDynamic(`Hola, veo que ya tienes un proceso registrado. Tu estado actual es: ${estadoProceso}`);
            await ctxFn.flowDynamic("Si tienes más consultas o dudas al respecto, comunícate al WA 5730256648.");
        } else {
            // Si no tiene un registro, activar la IA como asesor experto en crédito de libranza usando el prompt.json
            // Esta respuesta será guiada por el entrenamiento de la IA en `prompt.json`
            const text = `${ctx.body}`; // El mensaje que el usuario envíe (o cualquier otro contexto relevante)
            const response = await chat(promptData.prompt, text);
            // Responder dinámicamente según el entrenamiento
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
            const phoneNumber = ctx.from; // Número de WhatsApp del contacto
            const date = new Date().toLocaleString(); // Fecha y hora actual
            // Guardar los datos incluyendo la fecha, número de teléfono y otros detalles
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