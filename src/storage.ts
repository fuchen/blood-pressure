import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Assessment, Candidate, Measurement, MeasurementInput, validateMeasurement } from './domain';

let connection: Promise<SQLite.SQLiteDatabase> | undefined;
export const newId = () => Crypto.randomUUID();
export async function database() {
  if (!connection) connection = (async () => {
    const db = await SQLite.openDatabaseAsync('pressure-journal.db');
    await db.execAsync('PRAGMA journal_mode = WAL;');
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) < 1) {
      await db.withExclusiveTransactionAsync(async tx => {
        await tx.execAsync(`
          CREATE TABLE IF NOT EXISTS measurements (id TEXT PRIMARY KEY, measuredAt TEXT NOT NULL, payload TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS measurements_time ON measurements(measuredAt);
          CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, createdAt TEXT NOT NULL, payload TEXT NOT NULL);
          PRAGMA user_version = 1;
        `);
      });
    }
    return db;
  })();
  try { return await connection; } catch (error) { connection = undefined; throw error; }
}
export async function listMeasurements(): Promise<Measurement[]> {
  const rows = await (await database()).getAllAsync<{ payload: string }>('SELECT payload FROM measurements ORDER BY measuredAt DESC');
  return rows.map(row => JSON.parse(row.payload));
}
export async function saveMeasurements(inputs: (MeasurementInput & Partial<Pick<Measurement, 'id' | 'createdAt'>>)[]) {
  inputs.forEach(input => { const errors = validateMeasurement(input); if (errors.length) throw new Error(errors.join('；')); });
  const now = new Date().toISOString();
  const records: Measurement[] = inputs.map(input => ({ ...input, id: input.id ?? newId(), createdAt: input.createdAt ?? now, updatedAt: now }));
  await (await database()).withExclusiveTransactionAsync(async tx => {
    for (const record of records) await tx.runAsync('INSERT OR REPLACE INTO measurements(id, measuredAt, payload) VALUES (?, ?, ?)', record.id, record.measuredAt, JSON.stringify(record));
  });
  return records;
}
export async function commitImport(inputs: MeasurementInput[], remaining: Candidate[]) {
  inputs.forEach(input => { const errors = validateMeasurement(input); if (errors.length) throw new Error(errors.join('；')); });
  const now = new Date().toISOString();
  await (await database()).withExclusiveTransactionAsync(async tx => {
    for (const input of inputs) {
      const record: Measurement = { ...input, id: newId(), createdAt: now, updatedAt: now };
      await tx.runAsync('INSERT INTO measurements(id, measuredAt, payload) VALUES (?, ?, ?)', record.id, record.measuredAt, JSON.stringify(record));
    }
    await tx.runAsync('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)', 'importDraft', JSON.stringify(remaining));
  });
}
export async function deleteMeasurement(id: string) {
  await (await database()).runAsync('DELETE FROM measurements WHERE id = ?', id);
}
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await (await database()).getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row ? JSON.parse(row.value) : fallback;
}
export async function setSetting(key: string, value: unknown) {
  await (await database()).runAsync('INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)', key, JSON.stringify(value));
}
export const loadDraft = () => getSetting<Candidate[]>('importDraft', []);
export const saveDraft = (candidates: Candidate[]) => setSetting('importDraft', candidates);
export async function saveAssessment(assessment: Assessment) {
  await (await database()).runAsync('INSERT INTO assessments(id, createdAt, payload) VALUES (?, ?, ?)', assessment.id, assessment.createdAt, JSON.stringify(assessment));
}
export async function listAssessments(): Promise<Assessment[]> {
  const rows = await (await database()).getAllAsync<{ payload: string }>('SELECT payload FROM assessments ORDER BY createdAt DESC');
  return rows.map(row => JSON.parse(row.payload));
}
export async function clearData() {
  await (await database()).withExclusiveTransactionAsync(async tx => {
    await tx.execAsync('DELETE FROM measurements; DELETE FROM assessments; DELETE FROM settings;');
  });
}
const KEY_NAME = 'deepseek-api-key';
export const readKey = () => SecureStore.getItemAsync(KEY_NAME);
export const writeKey = (key: string) => SecureStore.setItemAsync(KEY_NAME, key.trim());
export const removeKey = () => SecureStore.deleteItemAsync(KEY_NAME);
