import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const groqApiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: groqApiKey });

// Cargar el archivo prompt.json
const promptText = fs.readFileSync(path.join(process.cwd(), 'src/prompt.txt'), 'utf8');

// Función para obtener el archivo del historial del usuario
const getUserHistoryFile = (phoneNumber) => {
    return path.join(process.cwd(), 'historials', `${phoneNumber}.json`);
};

// Función para leer el historial de conversación de un usuario
const getUserHistory = (phoneNumber) => {
    const filePath = getUserHistoryFile(phoneNumber);
    if (fs.existsSync(filePath)) {
        const history = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(history);
    }
    return [];
};

// Función para generar la conversación teniendo en cuenta el historial
export const chat = async (text, phoneNumber) => {
    try {
        const history = getUserHistory(phoneNumber); // Obtiene el historial de conversación
        let messages = [
            { role: "system", content: promptText },
        ];

        // Añadir los mensajes previos al contexto del chat
        history.forEach(entry => {
            if (entry.sender === 'user') {
                messages.push({ role: "user", content: entry.message });
            } else if (entry.sender === 'bot') {
                messages.push({ role: "assistant", content: entry.message });
            }
        });

        // Añadir el mensaje actual del usuario
        messages.push({ role: "user", content: text });

        // Llamar a la API para obtener la respuesta del chatbot
        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "llama3-8b-8192",
        });

        const response = chatCompletion.choices[0]?.message?.content || "Sin respuesta";
        
        return response;
    } catch (err) {
        console.error("Error al conectar con Groq:", err);
        return "ERROR";
    }
};
