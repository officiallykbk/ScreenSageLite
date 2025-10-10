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
                        callback(data);
                    },
                    clear: (callback) => {
                        if (callback) callback();
                    }
                }
            }
        };
        """
        page.add_init_script(mock_chrome_api)

        # Get the absolute path to the popup.html file
        absolute_path = os.path.abspath("popup.html")

        # Navigate to the local popup.html file
        page.goto(f"file://{absolute_path}")

        # Wait for the initial data to load
        expect(page.locator("#output")).to_contain_text("Recent activity:")

        # The chart should be hidden initially
        expect(page.locator(".chart-container")).to_have_class(re.compile(r"\bhidden\b"))

        # Take a screenshot of the initial compact view
        page.screenshot(path="jules-scratch/verification/compact_view.png")

        # Use the button's ID as a stable locator
        show_chart_btn = page.locator("#showChartBtn")

        # Click the "Show Chart" button
        show_chart_btn.click()

        # The chart container should now be visible
        expect(page.locator(".chart-container")).not_to_have_class(re.compile(r"\bhidden\b"))
        expect(page.locator("#usageChart")).to_be_visible()

        # The button text should update
        expect(show_chart_btn).to_have_text("🙈 Hide Chart")

        # Wait for the chart animation to complete
        page.wait_for_timeout(1000)

        # Take a screenshot of the expanded view
        page.screenshot(path="jules-scratch/verification/expanded_view.png")

        # Click the "Hide Chart" button
        show_chart_btn.click()

        # The chart should be hidden again
        expect(page.locator(".chart-container")).to_have_class(re.compile(r"\bhidden\b"))
        expect(show_chart_btn).to_have_text("📊 Show Chart")

        browser.close()

run()