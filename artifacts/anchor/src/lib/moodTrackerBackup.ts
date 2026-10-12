// MoodTracker v1 portable backup contract. Kept strict so imports never reinterpret scores.
import { validBalanceDate as validDate } from './dailyBalance';
export const SCALE_VERSION = 1;
export const BACKUP_VERSION = 1;
export const APP_ID = 'moodtracker';
export type Rating = number | null;
export type Theme = 'system' | 'light' | 'dark';
export interface DailyForm {
  date: string;
  mainHours: string;
  mainMinutes: string;
  additionalHours: string;
  additionalMinutes: string;
  mood: Rating;
  drive: Rating;
  fatigue: Rating;
  enjoyment: Rating;
  craving: Rating;
  use: 'none' | 'occurred' | 'prefer-not' | null;
  significantChange: boolean | null;
  changeNote: string;
  supportedBy: string;
  note: string;
}
export interface DailyEntry {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  scaleVersion: number;
  mainSleep: number | null;
  additionalSleep: number | null;
  mood: Rating;
  drive: Rating;
  fatigue: Rating;
  enjoyment: Rating;
  craving: Rating;
  use: DailyForm['use'];
  significantChange: boolean | null;
  changeNote: string;
  supportedBy: string;
  note: string;
}
export interface DraftRecord { date: string; revision: number; updatedAt: string; form: DailyForm }
export interface Settings {
  theme: Theme;
  timezone: string;
  contactName: string;
  contactDetails: string;
  clinician: string;
  supportPlan: string;
  lastExportAt: string | null;
}
export const DEFAULT_SETTINGS: Settings = { theme: 'system', timezone: 'Europe/Amsterdam', contactName: '', contactDetails: '', clinician: '', supportPlan: '', lastExportAt: null };
export const SCALES = {
  mood: { label: 'Mood', min: -2, max: 2, labels: ['Very low', 'Low', 'Okay / neutral', 'Good', 'Very good'] },
  drive: { label: 'Mental drive', min: -2, max: 2, labels: ['Very slowed', 'Slower', 'Usual', 'Faster / more driven', 'Hard to slow down'] },
  fatigue: { label: 'Physical fatigue', min: 0, max: 3, labels: ['None', 'Mild', 'Moderate', 'Strong'] },
  enjoyment: { label: 'Interest / enjoyment', min: 0, max: 3, labels: ['None', 'A little', 'Some', 'Plenty'] },
  craving: { label: 'Strongest craving', min: 0, max: 3, labels: ['None', 'Manageable', 'Intrusive', 'Hard to resist'] },
} as const;
export type Metric = keyof typeof SCALES;
export interface Backup {
  app: 'moodtracker';
  version: number;
  exportedAt: string;
  scaleDefinitions: typeof SCALES;
  entries: DailyEntry[];
  drafts: DraftRecord[];
  settings: Settings;
}
export const emptyForm = (date: string): DailyForm => ({ date, mainHours: '', mainMinutes: '', additionalHours: '', additionalMinutes: '', mood: null, drive: null, fatigue: null, enjoyment: null, craving: null, use: null, significantChange: null, changeNote: '', supportedBy: '', note: '' });

const MAX_RECORDS = 50_000;
type ObjectValue = Record<string, unknown>;
function fail(message: string): never { throw new Error(`Invalid backup: ${message}`); }
function object(value: unknown, label: string): ObjectValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as ObjectValue;
}
function keys(value: ObjectValue, expected: string[], label: string) {
  if (Object.keys(value).length !== expected.length || expected.some(key => !Object.hasOwn(value, key))) fail(`${label} has missing or unsupported fields.`);
}
function string(value: unknown, label: string, maximum = 4000, nonempty = false): asserts value is string {
  if (typeof value !== 'string' || value.length > maximum || (nonempty && value.trim() === '')) fail(`${label} must be ${nonempty ? 'a nonempty' : 'a'} string of at most ${maximum} characters.`);
}
function timestamp(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !validDate(value.slice(0, 10))) fail(`${label} must be a valid UTC timestamp.`);
  const [, h, m, s] = value.slice(10).match(/^T(\d{2}):(\d{2}):(\d{2})/) ?? [];
  if (Number(h) > 23 || Number(m) > 59 || Number(s) > 59 || !Number.isFinite(Date.parse(value))) fail(`${label} must be a valid UTC timestamp.`);
}
function revision(value: unknown, label: string) { if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${label} must be a nonnegative whole number.`); }
function date(value: unknown, label: string): asserts value is string { if (!validDate(value)) fail(`${label} must be a valid calendar date.`); }
function rating(value: unknown, metric: Metric, label: string) {
  const scale = SCALES[metric];
  if (value !== null && (typeof value !== 'number' || !Number.isInteger(value) || value < scale.min || value > scale.max)) fail(`${label} has an invalid rating.`);
}
function nullableChoices(value: unknown, label: string) {
  if (value !== null && value !== 'none' && value !== 'occurred' && value !== 'prefer-not') fail(`${label} has an invalid substance-use answer.`);
}
function nullableBoolean(value: unknown, label: string) { if (value !== null && typeof value !== 'boolean') fail(`${label} must be true, false, or null.`); }
function sleep(value: unknown, label: string) { if (value !== null && (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1440)) fail(`${label} must be null or a whole number of minutes from 0 to 1440.`); }

const ratingKeys = Object.keys(SCALES) as Metric[];
const writtenKeys = ['changeNote', 'supportedBy', 'note'] as const;
const formKeys = ['date', 'mainHours', 'mainMinutes', 'additionalHours', 'additionalMinutes', ...ratingKeys, 'use', 'significantChange', ...writtenKeys];
function validateForm(value: unknown, label: string): DailyForm {
  const form = object(value, label); keys(form, formKeys, label); date(form.date, `${label}.date`);
  // Drafts can contain an unfinished or invalid duration; restore must preserve the user's work.
  for (const field of ['mainHours', 'mainMinutes', 'additionalHours', 'additionalMinutes']) string(form[field], `${label}.${field}`, 4000);
  for (const metric of ratingKeys) rating(form[metric], metric, `${label}.${metric}`);
  nullableChoices(form.use, label); nullableBoolean(form.significantChange, `${label}.significantChange`);
  for (const field of writtenKeys) string(form[field], `${label}.${field}`);
  return form as unknown as DailyForm;
}

function validateEntry(value: unknown, index: number): DailyEntry {
  const label = `entries[${index}]`; const entry = object(value, label);
  keys(entry, ['id', 'date', 'createdAt', 'updatedAt', 'revision', 'scaleVersion', 'mainSleep', 'additionalSleep', ...ratingKeys, 'use', 'significantChange', ...writtenKeys], label);
  string(entry.id, `${label}.id`, 200, true); date(entry.date, `${label}.date`);
  timestamp(entry.createdAt, `${label}.createdAt`); timestamp(entry.updatedAt, `${label}.updatedAt`); revision(entry.revision, `${label}.revision`);
  if (entry.scaleVersion !== SCALE_VERSION) fail(`${label} uses an unsupported rating scale.`);
  sleep(entry.mainSleep, `${label}.mainSleep`); sleep(entry.additionalSleep, `${label}.additionalSleep`);
  for (const metric of ratingKeys) rating(entry[metric], metric, `${label}.${metric}`);
  nullableChoices(entry.use, label); nullableBoolean(entry.significantChange, `${label}.significantChange`);
  for (const field of writtenKeys) string(entry[field], `${label}.${field}`);
  return entry as unknown as DailyEntry;
}

function validateSettings(value: unknown): Settings {
  const settings = object(value, 'settings');
  keys(settings, ['theme', 'timezone', 'contactName', 'contactDetails', 'clinician', 'supportPlan', 'lastExportAt'], 'settings');
  if (!['system', 'light', 'dark'].includes(settings.theme as string)) fail('settings.theme is unsupported.');
  string(settings.timezone, 'settings.timezone', 100, true);
  try { new Intl.DateTimeFormat('en', { timeZone: settings.timezone }); } catch { fail('settings.timezone is unsupported.'); }
  for (const field of ['contactName', 'contactDetails', 'clinician', 'supportPlan']) string(settings[field], `settings.${field}`);
  if (settings.lastExportAt !== null) timestamp(settings.lastExportAt, 'settings.lastExportAt');
  return settings as unknown as Settings;
}

function validateScales(value: unknown) {
  const scales = object(value, 'scaleDefinitions'); keys(scales, ratingKeys, 'scaleDefinitions');
  for (const metric of ratingKeys) {
    const expected = SCALES[metric]; const found = object(scales[metric], `scaleDefinitions.${metric}`);
    keys(found, ['label', 'min', 'max', 'labels'], `scaleDefinitions.${metric}`);
    if (found.label !== expected.label || found.min !== expected.min || found.max !== expected.max || !Array.isArray(found.labels) || found.labels.length !== expected.labels.length || found.labels.some((label, index) => label !== expected.labels[index])) fail('rating scale definitions have changed or are unsupported.');
  }
}

/** Validate the entire backup before any caller is allowed to mutate the journal. */
export function validateBackup(value: unknown): Backup {
  const backup = object(value, 'root'); keys(backup, ['app', 'version', 'exportedAt', 'scaleDefinitions', 'entries', 'drafts', 'settings'], 'root');
  if (backup.app !== APP_ID) fail('this file belongs to a different application.');
  if (backup.version !== BACKUP_VERSION) fail('this backup version is unsupported.');
  timestamp(backup.exportedAt, 'exportedAt'); validateScales(backup.scaleDefinitions);
  if (!Array.isArray(backup.entries) || backup.entries.length > MAX_RECORDS || !Array.isArray(backup.drafts) || backup.drafts.length > MAX_RECORDS) fail(`entries and drafts must be arrays with no more than ${MAX_RECORDS} records each.`);
  const entries = backup.entries.map(validateEntry); const ids = new Set<string>(); const dates = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id) || dates.has(entry.date)) fail('entries contain duplicate IDs or dates.');
    ids.add(entry.id); dates.add(entry.date);
  }
  const draftDates = new Set<string>();
  const drafts: DraftRecord[] = backup.drafts.map((value, index) => {
    const label = `drafts[${index}]`; const draft = object(value, label); keys(draft, ['date', 'revision', 'updatedAt', 'form'], label);
    date(draft.date, `${label}.date`); revision(draft.revision, `${label}.revision`); timestamp(draft.updatedAt, `${label}.updatedAt`);
    const form = validateForm(draft.form, `${label}.form`);
    if (form.date !== draft.date || draftDates.has(draft.date)) fail('draft dates must match their form and cannot be duplicated.');
    draftDates.add(draft.date);
    return draft as unknown as DraftRecord;
  });
  const settings = validateSettings(backup.settings);
  return structuredClone({ app: APP_ID, version: BACKUP_VERSION, exportedAt: backup.exportedAt as string, scaleDefinitions: SCALES, entries, drafts, settings });
}
