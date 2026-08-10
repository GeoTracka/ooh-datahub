import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

export type UxReviewDiagnostics = {
  capturedAt: string;
  title: string;
  url: string;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  document: {
    clientWidth: number;
    clientHeight: number;
    scrollWidth: number;
    scrollHeight: number;
    horizontalOverflowPx: number;
  };
  activeElement: ElementDiagnostic | null;
  visibleInteractiveCount: number;
  undersizedInteractiveCandidates: ElementDiagnostic[];
  clippedTextCandidates: ElementDiagnostic[];
  nestedScrollableContainers: ElementDiagnostic[];
};

type ElementDiagnostic = {
  tag: string;
  role: string | null;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
};

function safeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function collectDiagnostics(page: Page): Promise<UxReviewDiagnostics> {
  return page.evaluate(() => {
    const describe = (element: Element): ElementDiagnostic => {
      const html = element as HTMLElement;
      const rect = html.getBoundingClientRect();
      const text = (
        html.getAttribute("aria-label")
        ?? html.getAttribute("title")
        ?? html.innerText
        ?? html.textContent
        ?? ""
      ).trim().replace(/\s+/g, " ").slice(0, 120);
      return {
        tag: html.tagName.toLowerCase(),
        role: html.getAttribute("role"),
        name: text,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
      };
    };

    const visible = (element: Element): boolean => {
      const html = element as HTMLElement;
      const rect = html.getBoundingClientRect();
      const style = window.getComputedStyle(html);
      return rect.width > 0
        && rect.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || "1") > 0;
    };

    const interactive = Array.from(document.querySelectorAll(
      "button, a[href], input:not([type='hidden']), select, textarea, [role='button'], [role='tab'], [tabindex]:not([tabindex='-1'])",
    )).filter(visible);

    const undersizedInteractiveCandidates = interactive
      .filter((element) => {
        const rect = (element as HTMLElement).getBoundingClientRect();
        return rect.width < 24 || rect.height < 24;
      })
      .slice(0, 40)
      .map(describe);

    const clippedTextCandidates = Array.from(document.querySelectorAll(
      "h1, h2, h3, h4, p, label, button, a, [role='heading'], [role='tab']",
    ))
      .filter(visible)
      .filter((element) => {
        const html = element as HTMLElement;
        const text = (html.innerText ?? html.textContent ?? "").trim();
        if (!text) return false;
        return html.scrollWidth > html.clientWidth + 1 || html.scrollHeight > html.clientHeight + 1;
      })
      .slice(0, 40)
      .map(describe);

    const nestedScrollableContainers = Array.from(document.querySelectorAll("body *"))
      .filter(visible)
      .filter((element) => {
        const html = element as HTMLElement;
        const style = window.getComputedStyle(html);
        return ["auto", "scroll"].includes(style.overflowY)
          && html.scrollHeight > html.clientHeight + 2;
      })
      .slice(0, 40)
      .map(describe);

    const root = document.documentElement;
    const scrollWidth = Math.max(root.scrollWidth, document.body?.scrollWidth ?? 0);
    const scrollHeight = Math.max(root.scrollHeight, document.body?.scrollHeight ?? 0);
    const active = document.activeElement;

    return {
      capturedAt: new Date().toISOString(),
      title: document.title,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      document: {
        clientWidth: root.clientWidth,
        clientHeight: root.clientHeight,
        scrollWidth,
        scrollHeight,
        horizontalOverflowPx: Math.max(0, scrollWidth - window.innerWidth),
      },
      activeElement: active && active !== document.body ? describe(active) : null,
      visibleInteractiveCount: interactive.length,
      undersizedInteractiveCandidates,
      clippedTextCandidates,
      nestedScrollableContainers,
    };
  });
}

export async function captureUxReview(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<UxReviewDiagnostics> {
  const project = safeName(testInfo.project.name || "default");
  const artifactName = safeName(name);
  const outputDirectory = resolve("artifacts", "ui-ux-review", project);
  await mkdir(outputDirectory, { recursive: true });

  const screenshotPath = resolve(outputDirectory, `${artifactName}.png`);
  const diagnosticsPath = resolve(outputDirectory, `${artifactName}.json`);

  await page.screenshot({
    path: screenshotPath,
    fullPage: options.fullPage ?? true,
    animations: "disabled",
    caret: "hide",
  });
  const diagnostics = await collectDiagnostics(page);
  await writeFile(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");

  await testInfo.attach(`ux-review-${artifactName}`, {
    path: screenshotPath,
    contentType: "image/png",
  });
  await testInfo.attach(`ux-review-${artifactName}-diagnostics`, {
    path: diagnosticsPath,
    contentType: "application/json",
  });

  return diagnostics;
}

export async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const scrollWidth = Math.max(root.scrollWidth, document.body?.scrollWidth ?? 0);
    return Math.max(0, scrollWidth - window.innerWidth);
  });
  expect(overflow, `${label}: page has ${overflow}px of horizontal overflow`).toBeLessThanOrEqual(1);
}

export async function assertCriticalControlInViewport(locator: Locator, label: string): Promise<void> {
  await expect(locator, `${label}: critical control should be visible`).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, `${label}: critical control should have a bounding box`).not.toBeNull();
  if (!box) return;
  const viewport = await locator.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));

  expect(box.x, `${label}: control begins left of viewport`).toBeGreaterThanOrEqual(-1);
  expect(box.y, `${label}: control begins above viewport`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${label}: control extends right of viewport`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, `${label}: control extends below viewport`).toBeLessThanOrEqual(viewport.height + 1);
  expect(box.width, `${label}: primary target is too narrow`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${label}: primary target is too short`).toBeGreaterThanOrEqual(36);
}

export async function assertFocusInside(locator: Locator, label: string): Promise<void> {
  const containsFocus = await locator.evaluate((element) => element.contains(document.activeElement));
  expect(containsFocus, `${label}: keyboard focus escaped the modal surface`).toBe(true);
}
