import fs from 'fs';
import path from 'path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

// Importamos `downloadMediaMessage` desde CommonJS
import pkg from '@adiwajshing/baileys';
const { downloadMediaMessage } = pkg;

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const convertAudio = async (filePath, format = 'mp3') => {
    const formats = { mp3: { code: 'libmp3lame', ext: 'mp3' } };
    const convertedFilePath = path.join(
        path.dirname(filePath),
        `${path.basename(filePath, path.extname(filePath))}.${formats[format].ext}`
    );

    await new Promise((resolve, reject) => {
        ffmpeg(filePath)
            .audioCodec(formats[format].code)
            .audioBitrate('128k')
            .format(formats[format].ext)
            .output(convertedFilePath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });

    return convertedFilePath;
};

export const downloadFileBaileys = async (ctx) => {
    try {
        const buffer = await downloadMediaMessage(ctx, 'buffer', {});
        const tmpDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const fileName = `file-${Date.now()}.ogg`;
        const filePath = path.join(tmpDir, fileName);
        await fs.promises.writeFile(filePath, buffer);

        const finalFilePath = await convertAudio(filePath, 'mp3');
        const finalExtension = 'mp3';

        return {
            fileName: path.basename(finalFilePath),
            fileOldPath: filePath,
            filePath: finalFilePath,
            fileBuffer: await fs.promises.readFile(finalFilePath),
            extension: finalExtension,
        };
    } catch (err) {
        console.error("Error al descargar o procesar el archivo de audio:", err);
        throw err; // Re-throw the error to be handled by the caller
    }
};

export default { downloadFileBaileys };