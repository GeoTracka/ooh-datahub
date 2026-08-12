import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "@/app/layout";
import { MAP_CONTEXT_URL } from "@/maps/mapAssets";

describe("RootLayout map prefetch", () => {
  it("preloads the exact context URL consumed by MapLibre", () => {
    const markup = renderToStaticMarkup(
      <RootLayout><main>Planner</main></RootLayout>,
    );

    expect(markup).toContain(
      `<link rel="preload" href="${MAP_CONTEXT_URL}" as="fetch"`,
    );
    expect(markup).toContain("crossorigin=\"anonymous\"");
  });
});
