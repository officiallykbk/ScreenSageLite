from playwright.sync_api import sync_playwright, expect
import os
import re

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Mock the chrome APIs that the extension's script uses.
        mock_chrome_api = """
        window.chrome = {
            runtime: {
                lastError: null
            },
            storage: {
                local: {
                    get: (keys, callback) => {
                        const data = {
                            usage: {
                                'github.com': 180000,
                                'stackoverflow.com': 90000,
                                'example.com': 60000,
                                'test.com': 120000,
                                'google.com': 30000
                            }
                        };
                        if (callback) {
                            callback(data);
                        }
                    },
                    clear: (callback) => {
                        if (callback) callback();
                    }
                }
            }
        };
        """
        page.add_init_script(mock_chrome_api)

        # Navigate to the popup using the local HTTP server
        page.goto("http://localhost:8000/popup.html")

        # Wait for the initial data to load and the fade-in animation
        expect(page.locator("#output")).to_contain_text("Recent activity:", timeout=10000)
        page.wait_for_timeout(500) # Wait for fade-in

        # The chart should be hidden initially
        expect(page.locator(".chart-container")).to_have_class(re.compile(r"\bhidden\b"))

        # Take a screenshot of the initial compact view
        page.screenshot(path="jules-scratch/verification/final_compact_view.png")

        # Use the button's ID as a stable locator
        show_chart_btn = page.locator("#showChartBtn")

        # Click the "Show Chart" button
        show_chart_btn.click()

        # Wait for the expand animation to complete
        page.wait_for_timeout(500)

        # The chart container should now be visible
        expect(page.locator(".chart-container")).not_to_have_class(re.compile(r"\bhidden\b"))
        expect(page.locator("#usageChart")).to_be_visible()

        # Take a screenshot of the expanded view
        page.screenshot(path="jules-scratch/verification/final_expanded_view.png")

        browser.close()

run()