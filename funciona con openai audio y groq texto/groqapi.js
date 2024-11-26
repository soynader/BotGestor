import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const groqApiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: groqApiKey });

// Cargar el archivo prompt.json
const promptData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/prompt.json'), 'utf8'));

export const chat = async (text) => {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: promptData.prompt },
                { role: "user", content: text },
            ],
            model: "llama3-8b-8192",
        });

        const answ = chatCompletion.choices[0]?.message?.content || "Sin respuesta";
        return answ;
    } catch (err) {
        console.error("Error al conectar con Groq:", err);
        return "ERROR";
    }
};
