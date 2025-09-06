import { join } from "path";
import { google } from "googleapis";

const GoogleAuth = new google.auth.GoogleAuth({
	keyFile: join(__dirname, "credentials.json"),
	scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export default GoogleAuth;
