/**
 * Executive Report Module
 * 
 * Daily executive summary email for Warehouse Tire Direct.
 * 
 * @created 2026-06-11
 */

export { generateExecutiveReport, type ExecutiveReportData } from "./generator";
export { generateHtmlEmail, generatePlainTextEmail } from "./template";
export { sendExecutiveReport, getLastSuccessfulSend } from "./sender";
