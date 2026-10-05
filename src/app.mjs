import { DEFAULTS, PRESETS, calculate, formatInput, parseNumericInput, won, percent, makeSummary } from './calculator.mjs';
import { STORAGE_KEY, loadSettings, saveSettings } from './storage.mjs';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let storage;
try { storage = window.localStorage; } catch { storage = undefined; }
const loaded = loadSettings(storage);
let state = loaded.state;
let storageWorks = loaded.status !== 'unavailable';
let currentResult;
let toastTimer, announcementTimer;
function text(selector, value) { $(selector).textContent = value; }
function notify(message) {
  clearTimeout(toastTimer);
  text('#toast',message); $('#toast').hidden=false;
  toastTimer=setTimeout(()=>{$('#toast').hidden=true;},3500);
}
function storageStatus() {
  text('#storage-status', storageWorks ? '입력한 설정은 이 브라우저에 자동 저장돼요.' : '브라우저 저장이 제한되어 새로고침하면 입력값이 사라질 수 있어요.');
  $('#storage-status').parentElement.classList.toggle('storage-unavailable',!storageWorks);
}
function persist() { storageWorks=saveSettings(storage,state); storageStatus(); }
function syncControls() {
  $$('[data-field]').forEach(el=>{
    const key=el.dataset.field;
    if(el.type==='radio') el.checked=String(state[key])===el.value;
    else if(el.type==='checkbox') el.checked=Boolean(state[key]);
    else el.value=el.tagName==='SELECT' ? state[key] : formatInput(state[key]);
  });
  $('#shipping-free').checked=state.freeShipping;
  $('#shipping-paid').checked=!state.freeShipping;
  $('#shippingIncome').value=state.freeShipping ? '0' : formatInput(state.shippingIncome);
}
function paintGraph(r) {
  const bar=$('#cost-bar'), legend=$('#chart-legend');
  bar.replaceChildren(); legend.replaceChildren();
  if(!r.ok) { bar.setAttribute('aria-label','입력값을 확인하면 비용 구조를 표시합니다.'); return; }
  for(const segment of r.segments) {
    const part=document.createElement('span');
    part.className=`cost-${segment.key}`;
    part.style.width=`${segment.percent}%`;
    part.style.display=segment.percent>0?'block':'none';
    part.title=`${segment.label} ${won(segment.amount)}원 (${percent(segment.percent)}%)`;
    bar.append(part);
    const item=document.createElement('span'), dot=document.createElement('i');
    dot.className=`cost-dot cost-${segment.key}`;
    item.append(dot,document.createTextNode(segment.label)); legend.append(item);
  }
  bar.setAttribute('aria-label',r.segments.map(x=>`${x.label} ${percent(x.percent)}%`).join(', ')+(r.profit<0?' · 비용 합계 기준. 손실은 별도 표시합니다.':''));
}
function render() {
  const r=calculate(state); currentResult=r;
  const platform=PRESETS.find(p=>p.id===state.platform);
  text('#market-badge',platform?.label || '직접 설정');
  text('#platform-symbol',({smartstore:'N',ably:'A',zigzag:'Z',coupang:'C'})[state.platform] || '%');
  $('#platform').value=state.platform;
  $$('[data-mode-panel]').forEach(el=>{el.hidden=el.dataset.modePanel!==state.mode;});
  $$('[data-multiple]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.multiple)===Number(state.multiplier))));
  $('#shippingIncome').disabled=state.freeShipping;
  const direct=state.mode==='direct';
  $('#ending900').disabled=direct;
  $$('[name="roundUnit"]').forEach(el=>{el.disabled=direct || state.ending900;});
  $('#purchaseCredit').disabled=!state.includeVat;
  $('#otherCredit').disabled=!state.includeVat;
  text('#price-caption',direct?'입력한 최종 판매가':'권장 소비자 판매가');
  text('#rounding-hint',direct?'직접 입력한 가격은 그대로':state.ending900?'가장 가까운 900원 끝자리':`${won(Number(state.roundUnit))}원 단위 반올림`);
  text('#tax-summary',`${state.includeVat?'일반과세자 단순 추정':'부가세 차감 전 비교'} · 도매 매입세액 ${state.includeVat&&state.purchaseCredit?'공제 반영':'미반영'}\n소득세·광고비·쿠폰·반품비·고정비는 포함하지 않습니다.`);
  const wholesale=Number(state.wholesale), courier=Number(state.courier), shipping=state.freeShipping?0:Number(state.shippingIncome);
  text('#wholesale-total',Number.isFinite(wholesale)&&wholesale>=0 ? `${won(state.vatExclusive?wholesale*1.1:wholesale)}원`:'—');
  const difference=shipping-courier;
  text('#shipping-difference',Number.isFinite(difference)?`고객 배송비 − 출고비 = ${difference>0?'+':''}${won(difference)}원`:'배송비 입력을 확인해 주세요.');
  for(const key of ['wholesale','sourcing','packaging','courier','shippingIncome','feeRate','multiplier','targetMargin','directPrice']) {
    const message=r.errors?.[key];
    $(`#${key}`).setAttribute('aria-invalid',String(Boolean(message)));
    text(`#err-${key}`,message || ''); $(`#err-${key}`).hidden=!message;
  }
  $('#result-error').hidden=r.ok; text('#result-error',r.ok?'':r.error);
  $('.result-stack').dataset.invalid=String(!r.ok);
  $('#copy-button').disabled=!r.ok;
  text('#price-value',r.ok?won(r.price):'—');
  $('#price-value').dataset.long=String(r.ok && won(r.price).length>8);
  text('#mobile-price',r.ok?`${won(r.price)}원`:'입력 확인');
  text('#profit-value',r.ok?won(r.profit):'—');
  $('#profit-value').dataset.long=String(r.ok && won(r.profit).length>8);
  text('#margin-value',r.ok?percent(r.margin):'—');
  $('#margin-value').dataset.long=String(r.ok && percent(r.margin).length>6);
  $$('.metric-card').forEach(el=>el.classList.toggle('loss',r.ok && r.profit<0));
  text('#profit-description',r.ok&&r.profit<0?'현재 가격으로 판매 시 예상 손실':state.includeVat?'비용과 부가세를 빼고 남는 금액':'부가세 차감 전 남는 금액');
  text('#price-context',state.freeShipping?'부가세 포함 · 무료배송':'부가세 포함 · 고객 배송비 별도');
  text('#multiple-summary',r.ok && r.wholesaleNet>0?`도매 공급가 대비 ${(r.price/r.wholesaleNet).toFixed(2)}배`:r.ok?'도매 공급가 0원 · 배수 산정 불가':'입력값을 확인해 주세요.');
  text('#graph-basis',r.ok && r.profit<0?'손실 발생 · 비용 합계 기준 (손실 별도 표시)':`고객 총 결제금액 ${r.ok?`${won(r.revenue)}원 `:''}기준 · 배송비 포함`);
  for(const [id,key] of [['cost-wholesale','wholesaleGross'],['cost-fee','fee'],['cost-logistics','logistics'],['cost-vat','vat'],['total-cost','expenses']]) text(`#${id}`,r.ok?`${won(r[key])}원`:'—');
  text('#fee-description',`${state.feeRate}%${state.feeOnShipping?' · 배송비 포함':''}`);
  text('#break-even',!r.ok?'—':r.breakEven==null?'현재 조건에서 달성 불가':`${won(r.breakEven)}원`);
  paintGraph(r);
  const warnings=$('#result-warnings'); warnings.replaceChildren();
  warnings.hidden=!r.ok || !r.warnings.length;
  if(r.ok) for(const message of r.warnings) {const p=document.createElement('p');p.textContent=message;warnings.append(p);}
  clearTimeout(announcementTimer);
  announcementTimer=setTimeout(()=>text('#live-summary',r.ok?`판매가 ${won(r.price)}원, 예상 순이익 ${won(r.profit)}원, 마진율 ${percent(r.margin)}${r.margin==null?'':'%'}.`:r.error),350);
}
function positionAfterSemanticChars(value, count) {
  if(count<=0)return 0;
  let seen=0;
  for(let i=0;i<value.length;i++){if(value[i]!==',')seen++;if(seen===count)return i+1;}
  return value.length;
}
function onTextInput(event) {
  const el=event.target;
  if(!el.matches('input[type="text"][data-field]') || event.isComposing)return;
  const key=el.dataset.field, raw=el.value;
  const caret=el.selectionStart??raw.length;
  const parsed=parseNumericInput(raw,Boolean(el.dataset.decimal));
  if(parsed===null){el.value=formatInput(state[key]);notify('0 이상의 숫자만 입력해 주세요. 소수는 최대 두 자리까지 가능해요.');return;}
  let before=raw.slice(0,caret).replace(/[,\s]/g,'').length;
  if(raw.startsWith('.'))before++;
  state[key]=parsed;
  if(key==='feeRate')state.platform='custom';
  el.value=formatInput(parsed);
  const next=positionAfterSemanticChars(el.value,before);
  el.setSelectionRange(next,next);
  render();persist();
}
document.addEventListener('input',onTextInput);
document.addEventListener('compositionend',event=>onTextInput(event));
document.addEventListener('keydown',event=>{
  const el=event.target;
  if(!el.matches('input[type="text"][data-field]') || event.ctrlKey || event.metaKey || event.altKey)return;
  const p=el.selectionStart;
  if(p!==el.selectionEnd || p==null)return;
  const value=el.value;
  if(event.key==='Backspace' && p>1 && value[p-1]===','){
    event.preventDefault();el.value=value.slice(0,p-2)+value.slice(p);el.setSelectionRange(p-2,p-2);el.dispatchEvent(new Event('input',{bubbles:true}));
  } else if(event.key==='Delete' && value[p]===','){
    event.preventDefault();el.value=value.slice(0,p)+value.slice(p+2);el.setSelectionRange(p,p);el.dispatchEvent(new Event('input',{bubbles:true}));
  }
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.name==='delivery')state.freeShipping=el.value==='free';
  else if(el.matches('[data-field]') && el.type!=='text'){
    const key=el.dataset.field;
    state[key]=el.type==='checkbox'?el.checked:key==='roundUnit'?Number(el.value):el.value;
    if(key==='platform'){
      const preset=PRESETS.find(p=>p.id===state.platform);
      if(preset)state.feeRate=preset.rate;
    }
  } else return;
  syncControls();render();persist();
});
$('#calculator-form').addEventListener('submit',event=>event.preventDefault());
$$('[data-multiple]').forEach(el=>el.addEventListener('click',()=>{state.multiplier=Number(el.dataset.multiple);syncControls();render();persist();}));
function openDialog(id) {const dialog=$(id);if(!dialog.open)dialog.showModal();}
$('#reset-button').addEventListener('click',()=>openDialog('#reset-dialog'));
$('#formula-button').addEventListener('click',()=>openDialog('#formula-dialog'));
$('#privacy-button').addEventListener('click',()=>openDialog('#privacy-dialog'));
$('#reset-confirm').addEventListener('click',()=>{
  try{storage.removeItem(STORAGE_KEY);}catch{storageWorks=false;}
  state={...DEFAULTS};syncControls();render();persist();$('#reset-dialog').close();notify('기본 예시로 초기화했어요.');
});
$('#copy-button').addEventListener('click',async()=>{
  if(!currentResult.ok)return;
  const summary=makeSummary(state,currentResult);
  try {
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(summary);
    notify('판매가 및 원가 요약을 복사했어요.');
  } catch {
    $('#copy-text').value=summary;openDialog('#copy-dialog');$('#copy-text').focus();$('#copy-text').select();
  }
});
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const rect=dialog.getBoundingClientRect();
  if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)dialog.close();
}));
$$('.top-nav a').forEach(link=>link.addEventListener('click',()=>{$$('.top-nav a').forEach(el=>el.classList.toggle('active',el===link));}));
syncControls();render();storageStatus();
if(loaded.status==='recovered')notify('저장된 설정을 읽을 수 없어 기본 예시로 시작했어요.');
