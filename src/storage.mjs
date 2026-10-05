import { DEFAULTS, FIELD_LIMITS, PRESETS } from './calculator.mjs';
export const STORAGE_KEY = 'margin-shop:settings:v1';
const ENUMS = { platform:['smartstore','ably','zigzag','coupang','custom'], mode:['multiplier','margin','direct'], roundUnit:[100,1000] };
/** Only known settings are trusted; no arbitrary persisted keys enter application state. */
export function sanitizeSettings(input) {
  const clean = {...DEFAULTS};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return clean;
  for (const key of Object.keys(DEFAULTS)) {
    const value = input[key];
    if (Object.hasOwn(FIELD_LIMITS,key)) {
      const typed = typeof value==='number' || (typeof value==='string' && /^\d*(?:\.\d{0,2})?$/.test(value));
      const n=Number(value);
      if (typed && Number.isFinite(n) && n>=0 && n<=FIELD_LIMITS[key] && (FIELD_LIMITS[key]!==1e9 || Number.isInteger(n))) clean[key]=value;
    } else if (ENUMS[key]?.includes(value) || (typeof DEFAULTS[key]==='boolean' && typeof value==='boolean')) clean[key]=value;
  }
  const preset = PRESETS.find(p=>p.id===clean.platform);
  if (preset && Number(clean.feeRate)!==preset.rate) clean.platform='custom';
  return clean;
}
export function loadSettings(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {state:{...DEFAULTS},status:'ready'};
    const parsed=JSON.parse(raw);
    if (!parsed || parsed.version!==1 || !parsed.settings || typeof parsed.settings!=='object' || Array.isArray(parsed.settings)) return {state:{...DEFAULTS},status:'recovered'};
    return {state:sanitizeSettings(parsed.settings),status:'restored'};
  } catch (error) {
    return {state:{...DEFAULTS},status:error instanceof SyntaxError?'recovered':'unavailable'};
  }
}
export function saveSettings(storage,state) {
  try { storage.setItem(STORAGE_KEY,JSON.stringify({version:1,settings:sanitizeSettings(state)})); return true; }
  catch { return false; }
}
