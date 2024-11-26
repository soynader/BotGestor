import { addKeyword, EVENTS } from '@builderbot/bot';
import { downloadFileBaileys } from './downloader.js';
import { transcribeAudio, chatAudio } from './openai.js';
import { removeFile } from './remover.js';

export const voiceFlow = addKeyword(EVENTS.VOICE_NOTE)
  .addAction(async (ctx, ctxFn) => {
    try {
      const fileInfo = await downloadFileBaileys(ctx);

      if (!fileInfo || !fileInfo.filePath) {
        throw new Error("Failed to download audio file");
      }

      await ctxFn.flowDynamic("Procesando tu mensaje de voz, por favor espera...");

      const transcript = await transcribeAudio(fileInfo.filePath);

      if (!transcript) {
        throw new Error("Failed to transcribe audio");
      }

      const response = await chatAudio(transcript);

      await removeFile(fileInfo.filePath);
      if (fileInfo.fileOldPath) await removeFile(fileInfo.fileOldPath);

      await ctxFn.flowDynamic(response);
    } catch (error) {
      console.error("Error in voiceFlow:", error);
      await ctxFn.flowDynamic("Lo siento, hubo un error al procesar tu mensaje de voz. Por favor, intenta con un mensaje más corto o envía tu consulta por texto.");
    }

    return ctxFn.endFlow();
  });