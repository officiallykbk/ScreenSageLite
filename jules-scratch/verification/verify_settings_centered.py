
import asyncio
from playwright.sync_api import sync_playwright
import os
import re

def run():
    with sync_playwright() as p:
        extension_path = os.path.abspath('.')
        user_data_dir = '/tmp/test-user-data-dir'

        browser_context = p.chromium.launch_persistent_context(
            user_data_dir,
            headless=False,
            args=[
                f'--disable-extensions-except={extension_path}',
                f'--load-extension={extension_path}',
            ]
        )

        # Get the background service worker
        service_worker = None
        if browser_context.service_workers:
            service_worker = browser_context.service_workers[0]
        if not service_worker:
            service_worker = browser_context.wait_for_event('serviceworker')

        if not service_worker:
            print("Error: Could not find the extension's service worker.")
            browser_context.close()
            return

        # Extract the extension ID from the service worker's URL
        extension_id_match = re.search(r'chrome-extension://([^/]+)', service_worker.url)
        if not extension_id_match:
            print(f"Error: Could not extract extension ID from URL: {service_worker.url}")
            browser_context.close()
            return
        extension_id = extension_id_match.group(1)

        page = browser_context.new_page()

        # Navigate to the popup page
        page.goto(f'chrome-extension://{extension_id}/popup/settings.html')

        # Take a screenshot
        screenshot_path = 'jules-scratch/verification/settings-page-centered.png'
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser_context.close()

run()
