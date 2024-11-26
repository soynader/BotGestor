import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

dotenv.config();

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: openaiApiKey });

// Cargar el archivo prompt.txt
const promptText = fs.readFileSync(path.join(process.cwd(), 'src/prompt.txt'), 'utf8');

// Función para obtener el archivo del historial del usuario
const getUserHistoryFile = (phoneNumber) => {
    return path.join(process.cwd(), 'historials', `${phoneNumber}.json`);
};

// Función para leer el historial de conversación de un usuario
export const getUserHistory = (phoneNumber) => {
    const filePath = getUserHistoryFile(phoneNumber);
    if (fs.existsSync(filePath)) {
        const history = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(history);
    }
    return [];
};

// Función para guardar el historial de conversación del usuario
export const saveUserHistory = (phoneNumber, history) => {
    const filePath = getUserHistoryFile(phoneNumber);
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');
};

// Función para transcribir audio
export const transcribeAudio = async (filePath) => {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
    });
    return transcription.text;
  } catch (err) {
    console.error("Error al transcribir audio con OpenAI:", err);
    return "Error al transcribir audio";
  }
};

// Función para generar respuestas de chat teniendo en cuenta el historial
export const chatAudio = async (text, phoneNumber) => {
  try {
    const history = getUserHistory(phoneNumber); // Obtener el historial
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

    // Llamar a la API de OpenAI para obtener la respuesta
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
    });
    const response = completion.choices[0]?.message?.content || "Sin respuesta";

    // Guardar el historial actualizado
    const updatedHistory = [...history, { sender: 'user', message: text }, { sender: 'bot', message: response }];
    saveUserHistory(phoneNumber, updatedHistory);

    return response;
  } catch (err) {
    console.error("Error al conectar con OpenAI para audio:", err);
    return "ERROR";
  }
};
