from playwright.sync_api import sync_playwright, expect
import os

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

        # Wait for the initial data to load and check the summary text
        expect(page.locator("#output")).to_contain_text("Recent activity:")

        # The chart should be hidden initially
        expect(page.locator(".chart-container")).to_be_hidden()

        # Click the "Show Chart" button
        page.get_by_role("button", name="📊 Show Chart").click()

        # The chart container and the canvas should now be visible
        expect(page.locator(".chart-container")).to_be_visible()
        expect(page.locator("#usageChart")).to_be_visible()

        # Wait for the chart animation to complete for a stable screenshot
        page.wait_for_timeout(1000)

        # Take a screenshot to verify the final state
        page.screenshot(path="jules-scratch/verification/verification.png")

        browser.close()

run()