import { addKeyword, EVENTS } from '@builderbot/bot';
import { downloadFileBaileys } from './downloader.js';
import { transcribeAudio, chatAudio, getUserHistory, saveUserHistory } from './openai.js'; // Importa las funciones necesarias
import { removeFile } from './remover.js';

export const voiceFlow = addKeyword(EVENTS.VOICE_NOTE)
  .addAction(async (ctx, ctxFn) => {
    try {
      // Descargamos el archivo de audio
      const fileInfo = await downloadFileBaileys(ctx);

      if (!fileInfo || !fileInfo.filePath) {
        throw new Error("No se pudo descargar el archivo de audio");
      }

      await ctxFn.flowDynamic("Procesando tu mensaje de voz, por favor espera...");

      // Transcripción del mensaje de voz
      const transcript = await transcribeAudio(fileInfo.filePath);

      if (!transcript) {
        throw new Error("No se pudo transcribir el audio");
      }

      // Obtener el historial de conversaciones del usuario
      const userId = ctx.from;  // Usamos el número de teléfono o el identificador único del usuario
      const userHistory = getUserHistory(userId); // Utilizamos la función getUserHistory

      // Concatenamos el historial con la transcripción actual para generar una respuesta contextualizada
      const fullConversation = `${userHistory.map(entry => `${entry.sender}: ${entry.message}`).join('\n')}\nUsuario: ${transcript}`;

      // Guardamos la transcripción del mensaje en el historial
      await saveUserHistory(userId, [...userHistory, { sender: 'user', message: transcript }]);

      // Obtenemos la respuesta utilizando el historial y la transcripción del mensaje
      const response = await chatAudio(transcript, userId); // Usamos chatAudio con el texto y el userId

      // Eliminamos el archivo de audio una vez procesado
      await removeFile(fileInfo.filePath);
      if (fileInfo.fileOldPath) await removeFile(fileInfo.fileOldPath);

      // Enviar la respuesta al usuario
      await ctxFn.flowDynamic(response);
    } catch (error) {
      console.error("Error en voiceFlow:", error);
      await ctxFn.flowDynamic("Lo siento, hubo un error al procesar tu mensaje de voz. Por favor, intenta con un mensaje más corto o envía tu consulta por texto.");
    }

    return ctxFn.endFlow();
  });
