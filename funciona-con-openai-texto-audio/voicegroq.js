import { chat } from './openai.js';
// ... (rest of the file remains the same)
    

    export const voice2text = async (path) => {
        if (!fs.existsSync(path)) {
            throw new Error("No se encuentra el archivo");
        }

        try {
            const response = await chat("transcribe", path); // Utiliza la función de Groq para transcripción
            return response.text || "Transcripción no disponible";
        } catch (err) {
            console.error("Error al transcribir audio:", err);
            return "Error al procesar el audio";
        }
    };