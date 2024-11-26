import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const transcribeAudio = async (filePath) => {
  try {
    const audioFile = createReadStream(filePath);
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });
    return response.text;
  } catch (error) {
    console.error("Error al transcribir audio con OpenAI:", error);
    throw error;
  }
};

export const chat = async (prompt, text) => {
  try {
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: text },
      ],
      model: "gpt-3.5-turbo",
    });

    return chatCompletion.choices[0]?.message?.content || "Sin respuesta";
  } catch (error) {
    console.error("Error al chatear con OpenAI:", error);
    return "ERROR";
  }
};