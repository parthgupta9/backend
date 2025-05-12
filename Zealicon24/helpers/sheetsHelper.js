import { google } from "googleapis";
import path from "path";

const auth = new google.auth.GoogleAuth({
  keyFile: path.join("config", "google-credentials.json"),
  credentials: {
    type: "service_account",
    project_id: "zealicon25",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    universe_domain: "googleapis.com",
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
});

const sheets = google.sheets({ version: "v4", auth });

const drive = google.drive({ version: "v3", auth });

export const createSpreadsheet = async (title) => {
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: title,
      },
    },
  });

  drive.permissions.create({
    fileId: spreadsheet.data.spreadsheetId, // ID of the created spreadsheet
    requestBody: {
      role: "reader",
      type: "anyone", // allows public access
    },
  });

  return spreadsheet.data.spreadsheetId;
};

export const addRowToSheet = async (spreadsheetId, rowData) => {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `Sheet1!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [rowData],
    },
  });
};

export const removeRowFromSheet = async (spreadsheetId, userIdColumnIndex, userId) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `Sheet1!A1:Z1000`,
  });

  const rows = response.data.values;
  const rowIndex = rows.findIndex((row, i) => row[userIdColumnIndex] === userId && i > 0);

  if (rowIndex > 0) {
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = sheetMeta.data.sheets.find((s) => s.properties.title === "Sheet1");

    if (!sheet) {
      throw new Error("Sheet1 not found");
    }

    const sheetId = sheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
  }
};
