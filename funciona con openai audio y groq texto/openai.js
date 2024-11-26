import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

dotenv.config();

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: openaiApiKey });

// Cargar el archivo prompt.json
const promptData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/prompt.json'), 'utf8'));

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

export const chatAudio = async (text) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: promptData.prompt },
        { role: "user", content: text },
      ],
    });
    return completion.choices[0].message.content;
  } catch (err) {
    console.error("Error al conectar con OpenAI para audio:", err);
    return "ERROR";
  }
};