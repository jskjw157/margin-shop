"""Run against built app: python e2e/check.py (requires Playwright + Chromium)."""
import os, re, shutil, unittest
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:4173')
ROOT = Path(__file__).resolve().parents[1]

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), headless=True, args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1440,'height':1100})
        self.page=self.context.new_page(); self.errors=[]
        self.page.on('pageerror', lambda err:self.errors.append(str(err)))
        self.page.goto(BASE); self.page.wait_for_selector('#price-value')
    def tearDown(self):
        self.assertEqual(self.errors,[])
        self.context.close()
    def price(self): return self.page.locator('#price-value').inner_text()
    def test_defaults_and_live_form(self):
        self.assertEqual(self.price(),'37,900')
        self.page.locator('#wholesale').fill('20000')
        self.assertEqual(self.page.locator('#wholesale').input_value(),'20,000')
        self.assertEqual(self.price(),'49,900')
    def test_direct_mode_preserves_price(self):
        self.page.locator('label[for="mode-direct"]').click()
        self.page.locator('#directPrice').fill('38765')
        self.assertEqual(self.price(),'38,765')
        self.assertTrue(self.page.locator('#ending900').is_disabled())
    def test_platform_and_custom_fee(self):
        for key,rate in [('ably','13.5'),('zigzag','12.5'),('coupang','10.8'),('smartstore','5.8')]:
            self.page.select_option('#platform',key)
            self.assertEqual(self.page.locator('#feeRate').input_value(),rate)
        self.page.locator('#feeRate').fill('7.25')
        self.assertEqual(self.page.locator('#platform').input_value(),'custom')
    def test_free_shipping_and_restore(self):
        before=self.page.locator('#profit-value').inner_text()
        self.page.locator('label[for="shipping-free"]').click()
        self.assertEqual(self.page.locator('#shippingIncome').input_value(),'0')
        self.assertTrue(self.page.locator('#shippingIncome').is_disabled())
        self.assertNotEqual(before,self.page.locator('#profit-value').inner_text())
        self.page.locator('label[for="shipping-paid"]').click()
        self.assertEqual(self.page.locator('#shippingIncome').input_value(),'3,000')
    def test_margin_mode_and_unsolvable(self):
        self.page.locator('label[for="mode-margin"]').click()
        self.assertNotEqual(self.price(),'—')
        self.page.locator('#targetMargin').fill('99')
        self.assertEqual(self.price(),'—')
        self.assertTrue(self.page.locator('#result-error').is_visible())
        self.assertTrue(self.page.locator('#copy-button').is_disabled())
    def test_empty_and_negative(self):
        self.page.locator('#wholesale').fill('')
        self.assertEqual(self.price(),'—')
        self.assertEqual(self.page.locator('#wholesale').get_attribute('aria-invalid'),'true')
        self.page.locator('#wholesale').fill('15000')
        self.page.locator('#wholesale').fill('-100')
        self.assertEqual(self.page.locator('#wholesale').input_value(),'15,000')
    def test_persistence_and_confirmed_reset(self):
        self.page.locator('#sourcing').fill('888')
        self.page.reload(); self.assertEqual(self.page.locator('#sourcing').input_value(),'888')
        self.page.locator('#reset-button').click()
        self.assertTrue(self.page.locator('#reset-dialog').is_visible())
        self.page.locator('#reset-cancel').click()
        self.assertEqual(self.page.locator('#sourcing').input_value(),'888')
        self.page.locator('#reset-button').click(); self.page.locator('#reset-confirm').click()
        self.assertEqual(self.page.locator('#sourcing').input_value(),'500')
    def test_corrupt_storage(self):
        self.page.evaluate("localStorage.setItem('margin-shop:settings:v1','{bad')")
        self.page.reload(); self.assertEqual(self.price(),'37,900')
    def test_blocked_storage(self):
        self.page.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
        self.page.reload(); self.assertEqual(self.price(),'37,900')
        self.page.locator('#sourcing').fill('888'); self.assertNotEqual(self.price(),'—')
        self.assertIn('저장',self.page.locator('#storage-status').inner_text())
    def test_clipboard_success(self):
        self.context.grant_permissions(['clipboard-read','clipboard-write'])
        self.page.locator('#copy-button').click()
        text=self.page.evaluate('navigator.clipboard.readText()')
        self.assertIn('최종 판매가\t37,900',text)
        self.assertIn('부가세',text)
    def test_clipboard_fallback_dialog(self):
        self.page.evaluate("Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))},configurable:true})")
        self.page.locator('#copy-button').click()
        self.page.wait_for_selector('#copy-dialog[open]')
        self.assertIn('37,900',self.page.locator('#copy-text').input_value())
        self.page.keyboard.press('Escape'); self.assertFalse(self.page.locator('#copy-dialog').is_visible())
    def test_comma_backspace_and_delete(self):
        field=self.page.locator('#wholesale'); field.fill('12345'); field.focus()
        field.evaluate('(el)=>el.setSelectionRange(3,3)')
        self.page.keyboard.press('Backspace')
        self.assertEqual(field.input_value(),'1,345')
        field.fill('12345'); field.evaluate('(el)=>el.setSelectionRange(2,2)')
        self.page.keyboard.press('Delete')
        self.assertEqual(field.input_value(),'1,245')
    def test_decimal_entry_and_long_price(self):
        field=self.page.locator('#multiplier'); field.fill('2.'); self.page.keyboard.type('75')
        self.assertEqual(field.input_value(),'2.75')
        self.page.locator('label[for="mode-direct"]').click()
        self.page.locator('#directPrice').fill('999999999')
        self.assertEqual(self.price(),'999,999,999')
    def test_responsive_and_screenshots(self):
        output=ROOT.parent/'margin-shop-preview'; output.mkdir(exist_ok=True)
        for width in [320,390,768,1440]:
            self.page.set_viewport_size({'width':width,'height':1000})
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),f'overflow at {width}')
            self.assertTrue(self.page.locator('#wholesale').is_visible())
            if width in [390,1440]: self.page.screenshot(path=str(output/f'{width}.png'),full_page=True)
    def test_zero_price_and_loss(self):
        self.page.locator('label[for="mode-direct"]').click(); self.page.locator('#directPrice').fill('0')
        self.assertEqual(self.page.locator('#margin-value').inner_text(),'—')
        self.assertIn('손실',self.page.locator('#result-warnings').inner_text())
        self.assertNotIn('NaN',self.page.locator('body').inner_text())
    def test_mobile_readability_and_extreme_loss(self):
        self.page.set_viewport_size({'width':390,'height':1000})
        self.assertGreaterEqual(self.page.locator('label[for="wholesale"]').evaluate('(el)=>parseFloat(getComputedStyle(el).fontSize)'),12)
        self.assertGreaterEqual(self.page.locator('.guide-card p').first.evaluate('(el)=>parseFloat(getComputedStyle(el).fontSize)'),13)
        self.page.locator('label[for="mode-direct"]').click()
        self.page.locator('#directPrice').fill('1')
        self.page.locator('#wholesale').fill('1000000000')
        self.page.locator('#sourcing').fill('1000000000')
        self.page.set_viewport_size({'width':320,'height':1000})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
        self.assertTrue(self.page.locator('.metric-card').evaluate_all('(cards)=>cards.every(el=>el.scrollWidth<=el.clientWidth+1)'))
    def test_static_guide_and_dialog_keyboard(self):
        self.assertEqual(self.page.locator('h1').count(),1)
        self.assertGreaterEqual(self.page.locator('#guide h3').count(),3)
        self.page.locator('#formula-button').click(); self.assertTrue(self.page.locator('#formula-dialog').is_visible())
        self.page.keyboard.press('Escape'); self.assertFalse(self.page.locator('#formula-dialog').is_visible())
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'formula-button')
    def test_offline_single_file_without_requests(self):
        requests=[]; p=self.context.new_page(); p.on('request',lambda req:requests.append(req.url))
        p.goto((ROOT/'index.html').as_uri()); self.assertEqual(p.locator('#price-value').inner_text(),'37,900')
        p.locator('#wholesale').fill('20000'); self.assertEqual(p.locator('#price-value').inner_text(),'49,900')
        self.assertFalse(any(url.startswith(('https://','http://')) for url in requests))
        p.close()

if __name__=='__main__': unittest.main(verbosity=2)
