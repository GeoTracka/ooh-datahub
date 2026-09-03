import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("does not preload the map for non-map routes", () => {
    const { container } = render(<RootLayout><div>Chat</div></RootLayout>);
    expect(container.querySelector('link[rel="preload"][href*="map"]')).toBeNull();
  });
});
