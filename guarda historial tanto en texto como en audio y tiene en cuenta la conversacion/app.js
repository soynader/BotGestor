import path from 'path';
import fs from 'fs';
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot';
import { JsonFileDB as Database } from '@builderbot/database-json';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { appendToSheet, readSheet } from './utils.js';
import { chat } from './groqapi.js';
import { voiceFlow } from './voiceFlow.js';

// Puerto de la aplicación
const PORT = process.env.PORT ?? 3008;

// Cargar el archivo prompt.txt
const promptText = fs.readFileSync(path.join(process.cwd(), 'src/prompt.txt'), 'utf8');

// Función para guardar el mensaje en el historial del usuario
const saveMessageToHistory = (phoneNumber, message, sender) => {
    const filePath = path.join(process.cwd(), 'historials', `${phoneNumber}.json`);

    let history = [];
    if (fs.existsSync(filePath)) {
        history = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    history.push({ sender, message });

    fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
};

// Definir flujo de bienvenida y consultas
const flowGPT = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, ctxFn) => {
        const phoneNumber = ctx.from;
        const registros = await readSheet("CPotencial!A1:F10");

        const existingRecord = registros.find(row => row[3] === phoneNumber);

        let message = '';

        if (existingRecord) {
            const estadoProceso = existingRecord[5];
            message = `Hola, veo que ya tienes un proceso registrado. Tu estado actual es: ${estadoProceso}`;
            message += "\nSi tienes más consultas o dudas al respecto, comunícate al WA 5730256648.";
        } else {
            const text = `${ctx.body}`;
            const response = await chat(text, phoneNumber); // Pasar el número de teléfono para obtener el historial
            message = response;
        }

        // Guardar el mensaje del usuario y el mensaje del chatbot en el historial
        saveMessageToHistory(phoneNumber, ctx.body, 'user');
        saveMessageToHistory(phoneNumber, message, 'bot');

        await ctxFn.flowDynamic(message);
    });

// Definir flujo de historial
const flowHistory = addKeyword("Historial")
    .addAnswer("Este es el flujo historial", null,
        async (ctx, ctxFn) => {
            const phoneNumber = ctx.from;
            const historyFilePath = path.join(process.cwd(), 'historials', `${phoneNumber}.json`);

            if (fs.existsSync(historyFilePath)) {
                const history = JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
                let historyText = "Historial de conversación:\n";

                history.forEach(entry => {
                    historyText += `${entry.sender === 'user' ? 'Usuario' : 'Bot'}: ${entry.message}\n`;
                });

                await ctxFn.flowDynamic(historyText);
            } else {
                await ctxFn.flowDynamic("No se encontró historial de conversación.");
            }
        }
    );

// Definir flujo principal de manejo de gastos
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

// Inicializar el bot con los flujos, proveedor y base de datos
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

