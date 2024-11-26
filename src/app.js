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
        const registros = await readSheet("CPotencial!A1:M1000");

        const existingRecord = registros.find(row => row[8] === phoneNumber);

        let message = '';

        if (existingRecord) {
            const estadoProceso = existingRecord[12];
            message = `Hola, veo que ya tienes un proceso registrado. Tu estado actual es:\n\n ${estadoProceso}`;
            message += "\n\nUn asesor se pondrá en contacto contigo pronto para brindarte una respuesta a tu solicitud.";
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

// Definir flujo principal de manejo de datos
const flowPrincipal = addKeyword(["cotizo"])
    .addAnswer('¡Perfecto! Comenzaremos a registrar tus datos. Por favor, responde siguiendo las indicaciones que te daremos a continuación.')
    .addAnswer('Numero de Cedula (solo números)', { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ cedula: ctx.body });
        }
    )
    .addAnswer('Nombres y Apellidos', { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ nombresApellidos: ctx.body });
        }
    )
    .addAnswer('Edad exacta del cliente', { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ edad: ctx.body });
        }
    )
    .addAnswer('Convenio o Empresa de Nomina', { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ convenio: ctx.body });
        }
    )
    .addAnswer('Para que necesita el Dinero', { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ necesidadDinero: ctx.body });
        }
    )
    .addAnswer('Tu Credito es de Libre Inversion o Compra de Cartera', { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ tipoCredito: ctx.body });
        }
    )
    .addAnswer('Monto Solicitado', { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ montoSolicitado: ctx.body });
        }
    )
    .addAnswer('Ultimo Desprendible de Nomina (foto ó pdf)', { capture: true },
        async (ctx, ctxFn) => {
            await ctxFn.state.update({ desprendible: ctx.body });
        }
    )
    .addAnswer('Tus datos fueron registrados \n\n En breve nos pondremos en contacto contigo para brindarte una respuesta detallada a tu solicitud.', null,
        async (ctx, ctxFn) => {
            const cedula = ctxFn.state.get("cedula");
            const nombresApellidos = ctxFn.state.get("nombresApellidos");
            const edad = ctxFn.state.get("edad");
            const convenio = ctxFn.state.get("convenio");
            const necesidadDinero = ctxFn.state.get("necesidadDinero");
            const tipoCredito = ctxFn.state.get("tipoCredito");
            const montoSolicitado = ctxFn.state.get("montoSolicitado");
            const desprendible = ctxFn.state.get("desprendible");
            const phoneNumber = ctx.from;
            const date = new Date().toLocaleString();

            // Guardar los datos en la hoja de Google
            await appendToSheet([[cedula, nombresApellidos, edad, convenio, necesidadDinero, tipoCredito, montoSolicitado, desprendible, phoneNumber, date]]);
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


