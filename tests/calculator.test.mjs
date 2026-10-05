import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, PRESETS, calculate, evaluate, solveTarget, roundPrice, formatInput, parseNumericInput } from '../src/calculator.mjs';
const s = (p = {}) => ({ ...DEFAULTS, ...p });
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a-b) < eps, `${a} != ${b}`);

test('requested example fee presets are retained', () => assert.deepEqual(PRESETS.map(p => p.rate), [5.8, 13.5, 12.5, 10.8]));
test('default multiple uses supply price; nearest 900 ending produces 37900', () => {
 const r = calculate(s()); assert.equal(r.ok,true); assert.equal(r.price,37900); assert.equal(r.wholesaleGross,16500);
 near(r.fee,2198.2); near(r.vat,40900/11-1500); near(r.profit,40900-16500-3700-2198.2-(40900/11-1500)); near(r.margin,r.profit/37900*100);
});
test('VAT-inclusive and exclusive wholesale quotes are equivalent', () => {
 const a=calculate(s()); const b=calculate(s({wholesale:16500,vatExclusive:false})); near(a.price,b.price); near(a.profit,b.profit);
});
test('direct selling price is never rounded', () => assert.equal(calculate(s({mode:'direct',directPrice:38765})).price,38765));
test('free shipping reduces profit by shipping revenue less output VAT', () => {
 const a=calculate(s({mode:'direct'})); const b=calculate(s({mode:'direct',freeShipping:true})); near(a.profit-b.profit,3000*10/11);
});
test('shipping fee basis is opt-in', () => {
 const a=calculate(s({mode:'direct'})); const b=calculate(s({mode:'direct',feeOnShipping:true})); near(b.fee-a.fee,174);
});
test('non-creditable wholesale VAT is not deducted twice or silently credited', () => {
 const a=calculate(s({mode:'direct'})); const b=calculate(s({mode:'direct',purchaseCredit:false})); near(a.profit-b.profit,1500);
});
test('eligible other-cost input VAT includes gross fee once', () => {
 const a=calculate(s({mode:'direct'})); const b=calculate(s({mode:'direct',otherCredit:true})); near(b.profit-a.profit,(a.logistics+a.fee)/11);
});
test('VAT-off is a before-VAT simulation', () => {
 const a=calculate(s({mode:'direct'})); const b=calculate(s({mode:'direct',includeVat:false})); near(b.profit-a.profit,a.vat); assert.equal(b.vat,0);
});
test('negative VAT is conservatively floored to zero', () => { const r=evaluate(s(),1000); assert.equal(r.vat,0); assert.ok(r.profit<0); });
test('target inverse reaches exactly 30 percent before price rounding', () => { const q=s({mode:'margin'}); const p=solveTarget(q,30); near(evaluate(q,p).margin,30); });
test('inverse accounts for each credit and fee basis combination', () => {
 for (const includeVat of [true,false]) for (const purchaseCredit of [true,false]) for (const otherCredit of [true,false]) for(const feeOnShipping of [true,false]) {
 const q=s({includeVat,purchaseCredit,otherCredit,feeOnShipping}); near(evaluate(q,solveTarget(q,30)).margin,30);
 }
});
test('target inverse handles zero-VAT branch', () => { const q=s({wholesale:100,shippingIncome:300,sourcing:0,packaging:0,courier:0}); const p=solveTarget(q,20); assert.ok(evaluate(q,p).margin>=20-1e-6); });
test('target below rounded result warns and supplies safe alternative', () => {
 const r=calculate(s({mode:'margin',roundUnit:1000,ending900:false})); assert.equal(r.ok,true);
 if(r.margin<30) { assert.ok(r.warnings.some(w=>w.includes('목표'))); assert.ok(evaluate(s(),r.safePrice).margin>=30-1e-6); }
});
test('impossible target returns friendly error not Infinity', () => {
 const r=calculate(s({mode:'margin',targetMargin:99})); assert.equal(r.ok,false); assert.match(r.error,/달성|범위/);
});
test('100 percent fee yields no break-even and negative direct profit', () => { const q=s({feeRate:100,mode:'direct'}); const r=calculate(q); assert.equal(r.ok,true); assert.equal(r.breakEven,null); assert.ok(r.profit<0); });
test('zero selling price has no percentage, not NaN', () => { const r=calculate(s({mode:'direct',directPrice:0})); assert.equal(r.ok,true); assert.equal(r.margin,null); assert.ok(Number.isFinite(r.profit)); });
test('zero wholesale price does not force a 900 won price', () => assert.equal(calculate(s({wholesale:0})).price,0));
test('loss graph has no negative widths and reconciles expenses', () => {
 const r=calculate(s({mode:'direct',directPrice:1000})); assert.ok(r.profit<0); assert.ok(r.segments.every(x=>x.percent>=0 && Number.isFinite(x.percent))); near(r.segments.reduce((v,x)=>v+x.percent,0),100);
});
test('positive graph reconciles the customer payment including shipping', () => { const r=calculate(s()); near(r.segments.reduce((v,x)=>v+x.amount,0),r.revenue); near(r.segments.reduce((v,x)=>v+x.percent,0),100); });
test('shipping surplus does not create a negative logistics bar', () => { const r=calculate(s({shippingIncome:99999})); assert.ok(r.segments.every(x=>x.amount>=0)); near(r.segments.reduce((v,x)=>v+x.percent,0),100); });
test('round to hundreds, thousands, nearest 900 and ceiling 900', () => {
 assert.equal(roundPrice(38849,100,false),38800); assert.equal(roundPrice(38500,1000,false),39000); assert.equal(roundPrice(39000,100,true),38900); assert.equal(roundPrice(38901,100,true,true),39900); assert.equal(roundPrice(0,100,true),0);
});
test('large recommendation outside the supported range is rejected', () => assert.equal(calculate(s({wholesale:1e9,multiplier:100})).ok,false));
test('negative, nonfinite and excessive inputs are rejected', () => {
 for(const value of [-1,NaN,Infinity,1000000001,'hello','1e6']) assert.equal(calculate(s({wholesale:value})).ok,false);
 assert.equal(calculate(s({feeRate:101})).ok,false); assert.equal(calculate(s({targetMargin:100,mode:'margin'})).ok,false);
});
test('blank active required input invalid; blank optional cost equals zero', () => {
 assert.equal(calculate(s({wholesale:''})).ok,false); assert.equal(calculate(s({mode:'direct',directPrice:''})).ok,false); assert.equal(calculate(s({sourcing:''})).ok,true);
});
test('inactive target input does not block other pricing modes', () => assert.equal(calculate(s({targetMargin:'',directPrice:''})).ok,true));
test('numeric formatting preserves decimal typing, zero and blank', () => {
 assert.equal(formatInput('12345'),'12,345'); assert.equal(formatInput('2.'),'2.'); assert.equal(formatInput('2.20'),'2.20'); assert.equal(formatInput(''),''); assert.equal(formatInput('0'),'0');
});
test('input parsing accepts formatted paste but rejects negative and exponent', () => {
 assert.equal(parseNumericInput('15,000'),'15000'); assert.equal(parseNumericInput('2.',true),'2.'); assert.equal(parseNumericInput('.5',true),'0.5'); assert.equal(parseNumericInput('-100'),null); assert.equal(parseNumericInput('1e3'),null); assert.equal(parseNumericInput('2.345',true),null);
});

test('never calls an upward-rounded price safe when shipping surplus makes its margin fall',()=>{
  const r=calculate({...DEFAULTS,wholesale:0,sourcing:0,packaging:0,courier:0,shippingIncome:1,feeRate:90,mode:'margin',targetMargin:50,ending900:true});
  assert.equal(r.ok,true);assert.ok(r.margin<50);assert.equal(r.safePrice,null);
  assert.ok(r.warnings.some(message=>message.includes('확보할 수 없어요')));
});
test('zero target margin still requires a positive price but break-even can be zero',()=>{
  const r=calculate({...DEFAULTS,wholesale:0,sourcing:0,packaging:0,courier:0,shippingIncome:0,feeRate:0,mode:'margin',targetMargin:0,ending900:true});
  assert.equal(r.ok,true);assert.ok(r.price>0);assert.ok(r.margin>=0);assert.equal(r.breakEven,0);
});
test('inverse and fee/VAT forward accounting agree across 2000 deterministic scenarios',()=>{
  let seed=157;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  let solved=0;
  for(let i=0;i<2000;i++){
    const q=s({wholesale:Math.floor(rand()*50000),sourcing:Math.floor(rand()*2000),packaging:Math.floor(rand()*1000),courier:Math.floor(rand()*4000),shippingIncome:Math.floor(rand()*5000),feeRate:Math.floor(rand()*9000)/100,includeVat:rand()>.25,purchaseCredit:rand()>.5,otherCredit:rand()>.5,feeOnShipping:rand()>.5,vatExclusive:rand()>.5});
    const target=Math.floor(rand()*7000)/100;
    const price=solveTarget(q,target,true);
    if(price===null)continue;
    solved++;
    const gross=q.vatExclusive?q.wholesale*1.1:q.wholesale;
    const net=q.vatExclusive?q.wholesale:q.wholesale/1.1;
    const logistics=q.sourcing+q.packaging+q.courier;
    const fee=(price+(q.feeOnShipping?q.shippingIncome:0))*q.feeRate/100;
    const tax=q.includeVat?Math.max(0,(price+q.shippingIncome)/11-(q.purchaseCredit?gross-net:0)-(q.otherCredit?(logistics+fee)/11:0)):0;
    const profit=price+q.shippingIncome-gross-logistics-fee-tax;
    near(evaluate(q,price).profit,profit,1e-5);
    assert.ok(profit/price*100>=target-1e-5);
  }
  assert.ok(solved>500);
});
