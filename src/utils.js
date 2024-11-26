import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config(); // Carga las variables de entorno desde .env

// Obtén las credenciales de Google de la variable de entorno
const googleCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

if (!googleCredentials) {
    throw new Error("GOOGLE_CREDENTIALS no está definida en las variables de entorno.");
}

// Configura la autenticación con GoogleAuth usando las credenciales directamente
const auth = new google.auth.GoogleAuth({
    credentials: googleCredentials, // Pasa las credenciales directamente
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// Ahora puedes usar `auth` en tus llamadas a la API
const spreadsheetId = '1FdanEyxXpXqx2hz5XuM8QqdeifY3MOmlC8KKCQhFzD0';

async function appendToSheet(values) {
    const sheets = google.sheets({ version: 'v4', auth }); // Crea una instancia del cliente de Sheets API
    const range = 'CPotencial!A1'; // El rango en la hoja donde se agregará la información
    const valueInputOption = 'USER_ENTERED'; // Forma de interpretar los datos ingresados

    const resource = { values: values };

    try {
        const res = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption,
            resource,
        });
        return res; // Devuelve la respuesta de la API
    } catch (error) {
        console.error('Error:', error); // Muestra errores
    }
}

async function readSheet(range) {
    const sheets = google.sheets({
        version: 'v4', auth
    });

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });
        return response.data.values; // Devuelve las filas de la hoja
    } catch (error) {
        console.error('API error: ' + error);
    }
}

export { appendToSheet, readSheet };
