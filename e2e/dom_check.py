"""DOM interaction harness for navigation-restricted environments.

Loads the built document into a blank Chromium page with set_content; does NOT
navigate around browser administrator policy. Storage and clipboard are explicitly
in-memory test doubles. Real-origin tests remain in check.py for unrestricted CI.
"""
import json
import unittest
import check


class DomHarnessTests(check.BrowserTests):
    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 1100})
        self.errors = []
        self._load({})

    def _load(self, values=None, blocked=False):
        old = getattr(self, 'page', None)
        self.page = self.context.new_page()
        if old:
            old.close()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        if blocked:
            self.page.evaluate("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
        else:
            self.page.evaluate("""values => {
                window.__testStorage = values;
                Object.defineProperty(window, 'localStorage', {value: {
                    getItem: key => window.__testStorage[key] ?? null,
                    setItem: (key, value) => {window.__testStorage[key] = String(value)},
                    removeItem: key => {delete window.__testStorage[key]},
                    clear: () => {window.__testStorage = {}}
                }});
            }""", values or {})
        self.page.set_content((check.ROOT / 'index.html').read_text(), wait_until='domcontentloaded')
        self.page.wait_for_selector('#price-value')

    def test_persistence_and_confirmed_reset(self):
        self.page.locator('#sourcing').fill('888')
        values = self.page.evaluate('window.__testStorage')
        self.assertIn('margin-shop:settings:v1', values)
        self._load(values)
        self.assertEqual(self.page.locator('#sourcing').input_value(), '888')
        self.page.locator('#reset-button').click()
        self.assertTrue(self.page.locator('#reset-dialog').is_visible())
        self.page.locator('#reset-cancel').click()
        self.assertEqual(self.page.locator('#sourcing').input_value(), '888')
        self.page.locator('#reset-button').click()
        self.page.locator('#reset-confirm').click()
        self.assertEqual(self.page.locator('#sourcing').input_value(), '500')

    def test_corrupt_storage(self):
        self._load({'margin-shop:settings:v1': '{bad'})
        self.assertEqual(self.price(), '37,900')

    def test_blocked_storage(self):
        self._load(blocked=True)
        self.assertEqual(self.price(), '37,900')
        self.page.locator('#sourcing').fill('888')
        self.assertNotEqual(self.price(), '—')
        self.assertIn('저장', self.page.locator('#storage-status').inner_text())

    def test_clipboard_success(self):
        self.page.evaluate("""Object.defineProperty(navigator,'clipboard',{value:{
            writeText: async text => { window.__copiedText = text }
        },configurable:true})""")
        self.page.locator('#copy-button').click()
        text = self.page.evaluate('window.__copiedText')
        self.assertIn('최종 판매가\t37,900', text)
        self.assertIn('부가세', text)

    def test_offline_single_file_without_requests(self):
        # This test verifies rendering and zero outgoing requests, not file:// policy.
        requests = []
        p = self.context.new_page()
        p.on('request', lambda request: requests.append(request.url))
        p.set_content((check.ROOT / 'index.html').read_text(), wait_until='domcontentloaded')
        self.assertEqual(p.locator('#price-value').inner_text(), '37,900')
        p.locator('#wholesale').fill('20000')
        self.assertEqual(p.locator('#price-value').inner_text(), '49,900')
        self.assertEqual(requests, [])
        p.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
