import { expect, type ElectronApplication, type Page } from "@playwright/test";

export async function getWindowByUrl(
    app: ElectronApplication,
    urlPart: string,
    timeout = 15_000,
): Promise<Page> {
    await expect.poll(async () => {
        return app.windows().some((candidate) => candidate.url().includes(urlPart));
    }, { timeout }).toBe(true);

    const page = app.windows().find((candidate) => candidate.url().includes(urlPart));
    if (!page) {
        throw new Error(`Window page not found for ${urlPart}`);
    }
    await page.waitForLoadState("domcontentloaded");
    return page;
}
