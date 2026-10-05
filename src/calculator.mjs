/** Pure KRW pricing model. No browser, network, or persistence dependencies. */
export const MAX_MONEY = 1_000_000_000;
export const PRESETS = Object.freeze([
  { id: 'smartstore', label: '스마트스토어', rate: 5.8 },
  { id: 'ably', label: '에이블리', rate: 13.5 },
  { id: 'zigzag', label: '지그재그', rate: 12.5 },
  { id: 'coupang', label: '쿠팡 윙', rate: 10.8 },
]);
export const DEFAULTS = Object.freeze({
  wholesale: 15000, vatExclusive: true, sourcing: 500, packaging: 400,
  courier: 2800, shippingIncome: 3000, freeShipping: false,
  platform: 'smartstore', feeRate: 5.8, feeOnShipping: false,
  mode: 'multiplier', multiplier: 2.5, targetMargin: 30, directPrice: 38900,
  roundUnit: 100, ending900: true, includeVat: true,
  purchaseCredit: true, otherCredit: false,
});
export const FIELD_LIMITS = Object.freeze({
  wholesale: MAX_MONEY, sourcing: MAX_MONEY, packaging: MAX_MONEY,
  courier: MAX_MONEY, shippingIncome: MAX_MONEY, feeRate: 100,
  multiplier: 100, targetMargin: 99.99, directPrice: MAX_MONEY,
});
const LABELS = { wholesale:'도매 사입가', sourcing:'삼촌비', packaging:'부자재비', courier:'출고 택배비', shippingIncome:'고객 부담 배송비', feeRate:'수수료율', multiplier:'원하는 배수', targetMargin:'목표 순마진율', directPrice:'최종 판매가' };
export const won = value => value == null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('ko-KR', {maximumFractionDigits:0}).format(Object.is(Math.round(value),-0) ? 0 : value);
export const percent = value => value == null || !Number.isFinite(value) ? '—' : value.toFixed(1);
export function formatInput(value) {
  const [integer, fraction] = String(value).split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction !== undefined ? `.${fraction}` : '');
}
/** Returns null for rejected edits: never turns -100 or 1e3 into another number. */
export function parseNumericInput(value, decimal = false) {
  const raw = String(value).replace(/[,\s]/g, '');
  if (!(decimal ? /^\d*(?:\.\d{0,2})?$/ : /^\d*$/).test(raw)) return null;
  const normalized = raw.startsWith('.') ? `0${raw}` : raw;
  return normalized.replace(/^0+(?=\d)/, '');
}
function numeric(value) { return Number(value === '' ? 0 : value); }
function basis(settings) {
  const s = { ...DEFAULTS, ...settings };
  const wholesaleNet = s.vatExclusive ? numeric(s.wholesale) : numeric(s.wholesale) / 1.1;
  const wholesaleGross = s.vatExclusive ? numeric(s.wholesale) * 1.1 : numeric(s.wholesale);
  const purchaseVat = wholesaleGross - wholesaleNet;
  const logistics = numeric(s.sourcing) + numeric(s.packaging) + numeric(s.courier);
  const shippingIncome = s.freeShipping ? 0 : numeric(s.shippingIncome);
  const feeRate = numeric(s.feeRate) / 100;
  const shippingFee = s.feeOnShipping ? shippingIncome * feeRate : 0;
  return { s, wholesaleNet, wholesaleGross, purchaseVat, logistics, shippingIncome, feeRate, shippingFee };
}
/** Forward calculation keeps full precision. Only presentation rounds to whole KRW. */
export function evaluate(settings, price) {
  const {s, wholesaleNet, wholesaleGross, purchaseVat, logistics, shippingIncome, feeRate, shippingFee} = basis(settings);
  const fee = price * feeRate + shippingFee;
  const revenue = price + shippingIncome;
  const inputVat = (s.purchaseCredit ? purchaseVat : 0) + (s.otherCredit ? (logistics + fee) / 11 : 0);
  const vat = s.includeVat ? Math.max(0, revenue / 11 - inputVat) : 0;
  const expenses = wholesaleGross + logistics + fee + vat;
  const profit = revenue - expenses;
  return { price, wholesaleNet, wholesaleGross, purchaseVat, logistics, shippingIncome, fee, inputVat, vat, revenue, expenses, profit, margin: price > 0 ? profit / price * 100 : null };
}
/** Analytic inverse, split at the zero-VAT boundary. Also handles shipping surplus. */
export function solveTarget(settings, targetPercent = 0, requirePositivePrice = false) {
  const {s, wholesaleGross, purchaseVat, logistics, shippingIncome, feeRate, shippingFee} = basis(settings);
  const target = targetPercent / 100;
  const a = 1 - feeRate;
  const b = shippingIncome - wholesaleGross - logistics - shippingFee;
  const taxA = s.includeVat ? (1 - (s.otherCredit ? feeRate : 0)) / 11 : 0;
  const taxB = s.includeVat ? shippingIncome / 11 - (s.purchaseCredit ? purchaseVat : 0) - (s.otherCredit ? (logistics + shippingFee) / 11 : 0) : 0;
  const minimum = requirePositivePrice || targetPercent > 0 ? 1 : 0;
  const intervals = [];
  if (!s.includeVat || (taxA === 0 && taxB <= 0)) intervals.push([minimum, MAX_MONEY, a, b]);
  else if (taxA === 0 || taxB >= 0) intervals.push([minimum, MAX_MONEY, a - taxA, b - taxB]);
  else {
    const boundary = -taxB / taxA;
    if (boundary >= minimum) intervals.push([minimum, Math.min(MAX_MONEY, boundary), a, b]);
    if (boundary <= MAX_MONEY) intervals.push([Math.max(minimum, boundary), MAX_MONEY, a - taxA, b - taxB]);
  }
  for (const [low, high, slope, intercept] of intervals) {
    const m = slope - target;
    if (m * low + intercept >= -1e-7) return low;
    if (m <= 1e-12) continue;
    const candidate = -intercept / m;
    if (Number.isFinite(candidate) && candidate >= low - 1e-7 && candidate <= high + 1e-7) return Math.max(low, Math.min(high, candidate));
  }
  return null;
}
export function roundPrice(value, unit = 100, ending900 = false, up = false) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const round = up ? x => Math.ceil(x - 1e-10) : Math.round;
  if (ending900) return Math.max(900, round((value - 900) / 1000) * 1000 + 900);
  return Math.max(0, round(value / unit) * unit);
}
function validate(settings) {
  const errors = {};
  const inactive = { multiplier: ['targetMargin','directPrice'], margin: ['multiplier','directPrice'], direct: ['multiplier','targetMargin'] }[settings.mode] || [];
  for (const [key, max] of Object.entries(FIELD_LIMITS)) {
    if (inactive.includes(key) || (key === 'shippingIncome' && settings.freeShipping)) continue;
    const value = settings[key];
    const required = key === 'wholesale' || ['multiplier','targetMargin','directPrice','feeRate'].includes(key);
    const n = numeric(value);
    const money = max === MAX_MONEY;
    if (required && String(value).trim() === '') errors[key] = `${LABELS[key]}를 입력해 주세요.`;
    else if ((typeof value !== 'number' && !/^\d*(?:\.\d{0,2})?$/.test(String(value))) || !Number.isFinite(n) || n < 0 || n > max || (money && !Number.isInteger(n))) errors[key] = `${LABELS[key]}: 0~${won(max)}${money ? '원(정수)' : key === 'multiplier' ? '배' : '%'} 범위로 입력해 주세요.`;
  }
  if (!['multiplier','margin','direct'].includes(settings.mode)) errors.mode = '판매가 책정 방식을 선택해 주세요.';
  if (![100,1000].includes(Number(settings.roundUnit))) errors.roundUnit = '반올림 단위를 확인해 주세요.';
  return errors;
}
export function calculate(settings) {
  const s = { ...DEFAULTS, ...settings };
  const errors = validate(s);
  if (Object.keys(errors).length) return { ok:false, errors, error:Object.values(errors)[0] };
  const rawPrice = s.mode === 'direct' ? numeric(s.directPrice) : s.mode === 'multiplier' ? basis(s).wholesaleNet * numeric(s.multiplier) : solveTarget(s,numeric(s.targetMargin),true);
  if (rawPrice == null || rawPrice > MAX_MONEY) return {ok:false, errors:{}, error:'현재 수수료·비용과 계산 범위에서 목표 가격을 달성할 수 없어요. 목표 마진율이나 배수를 낮춰 주세요.'};
  const price = s.mode === 'direct' ? rawPrice : roundPrice(rawPrice,Number(s.roundUnit),s.ending900);
  if (price > MAX_MONEY) return {ok:false, errors:{}, error:'정리된 판매가가 계산 범위(10억 원)를 초과해요.'};
  const r = evaluate(s,price);
  const breakEvenRaw = solveTarget(s,0);
  const breakEven = breakEvenRaw == null ? null : Math.max(0,Math.ceil(breakEvenRaw - 1e-9));
  const roundedTarget = s.mode === 'margin' ? roundPrice(rawPrice,Number(s.roundUnit),s.ending900,true) : null;
  // With a shipping surplus, margin can decrease as price rises: validate the suggestion.
  const safePrice = roundedTarget != null && roundedTarget > 0 && roundedTarget <= MAX_MONEY && evaluate(s,roundedTarget).margin + 1e-7 >= numeric(s.targetMargin) ? roundedTarget : null;
  const warnings = [];
  if (r.profit < 0) warnings.push('현재 판매가로 판매하면 건당 손실이 발생해요.');
  if (s.mode === 'margin' && (r.margin == null || r.margin + 1e-7 < numeric(s.targetMargin))) warnings.push(`반올림 후 목표 ${s.targetMargin}%보다 낮아요.${safePrice != null ? ` 목표 확보 가격은 ${won(safePrice)}원이에요.` : ' 현재 범위에서는 끝자리 정리로 목표를 확보할 수 없어요.'}`);
  if (!s.includeVat) warnings.push('부가세를 차감하지 않은 세전 비교 결과예요. 간이과세자 세액 계산이 아닙니다.');
  const segments = [
    {label:'도매원가',key:'wholesale',amount:r.wholesaleGross},
    {label:'수수료',key:'fee',amount:r.fee},
    {label:'물류·부자재',key:'logistics',amount:r.logistics},
    {label:'부가세 추정',key:'vat',amount:r.vat},
    {label:'순이익',key:'profit',amount:Math.max(0,r.profit)},
  ];
  const denominator = r.profit >= 0 ? r.revenue : r.expenses;
  return {ok:true,...r,rawPrice,breakEven,safePrice,warnings,segments:segments.map(x=>({...x,percent:denominator>0 ? x.amount/denominator*100 : 0}))};
}
export function makeSummary(settings, result) {
  if (!result.ok) return '';
  const name = PRESETS.find(p=>p.id===settings.platform)?.label || '직접 입력';
  const mode = {multiplier:'도매 공급가 × 배수',margin:'목표 순마진율',direct:'판매가 직접 입력'}[settings.mode];
  const rows = [
    ['Margin Shop · 판매가 및 원가 요약','원 / 건'],
    ['플랫폼',`${name} (예시/직접 설정 ${settings.feeRate}%, VAT 포함 실부담)`],
    ['책정 방식',mode], ['최종 판매가',won(result.price)],
    ['건당 순이익 (추정)',won(result.profit)], ['최종 순마진율',result.margin == null ? '산정 불가 (판매가 0원)' : `${percent(result.margin)}%`],
    ['도매 공급가',won(result.wholesaleNet)], ['도매 매입 VAT',won(result.purchaseVat)],
    ['실제 도매 매입금액 (VAT 포함)',won(result.wholesaleGross)],
    ['삼촌비',won(numeric(settings.sourcing))], ['부자재비',won(numeric(settings.packaging))], ['출고 택배비',won(numeric(settings.courier))],
    ['고객 부담 배송비 수입',won(result.shippingIncome)], ['고객 총 결제금액',won(result.revenue)],
    ['플랫폼 수수료',won(result.fee)], ['배송비 수수료 적용',settings.feeOnShipping ? '동일 요율 적용' : '미적용'],
    ['부가세 추정 차감',settings.includeVat ? won(result.vat) : '미반영 (세전 비교)'],
    ['매입 공제 가정',`도매 ${settings.purchaseCredit?'반영':'미반영'} / 기타 ${settings.otherCredit?'반영':'미반영'}`],
    ['손익분기 판매가',result.breakEven == null ? '달성 불가' : won(result.breakEven)],
    ['안내','일반과세자 단순 추정 / 소득세·광고·반품·고정비 제외 / 금액 표시는 원 단위 반올림'],
  ];
  return rows.map(row=>row.join('\t')).join('\n');
}
