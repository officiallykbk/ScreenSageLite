from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    context = browser.new_context()
    page = context.new_page()
    page.goto("file:///app/popup/popup.html")
    page.screenshot(path="jules-scratch/verification/light-mode.png")
    page.click("#theme-toggle")
    page.screenshot(path="jules-scratch/verification/dark-mode.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
