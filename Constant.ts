const INACTIVITY_MS: number = 100_0000;
const SAFE_TOKEN_RE: RegExp = /(bot|user)(\d+):[^/]+/g;
const SPREADSHEET_ID: string = process.env.GOOGLE_SHEET_ID || "";

export { INACTIVITY_MS, SAFE_TOKEN_RE, SPREADSHEET_ID };
