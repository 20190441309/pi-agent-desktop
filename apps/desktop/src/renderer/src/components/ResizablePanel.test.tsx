// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResizablePanel } from "./ResizablePanel";

describe("ResizablePanel", () => {
  it("renders children at defaultWidth", () => {
    const { container } = render(
      <ResizablePanel defaultWidth={200} minWidth={100} maxWidth={400} side="left">
        <div>panel body</div>
      </ResizablePanel>,
    );
    expect(screen.getByText("panel body")).toBeTruthy();
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe("200px");
  });

  it("clamps drag width on left side between min and max", () => {
    const { container } = render(
      <ResizablePanel defaultWidth={200} minWidth={120} maxWidth={300} side="left">
        content
      </ResizablePanel>,
    );
    const root = container.firstElementChild as HTMLElement;
    const handle = root.querySelector(".cursor-col-resize") as HTMLElement;
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document, { clientX: 50 });
    expect(root.style.width).toBe("120px");
    fireEvent.mouseMove(document, { clientX: 900 });
    expect(root.style.width).toBe("300px");
    fireEvent.mouseUp(document);
  });

  it("computes right-side width from window.innerWidth - clientX", () => {
    const original = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
    const { container } = render(
      <ResizablePanel defaultWidth={220} minWidth={100} maxWidth={500} side="right">
        right
      </ResizablePanel>,
    );
    const root = container.firstElementChild as HTMLElement;
    const handle = root.querySelector(".cursor-col-resize") as HTMLElement;
    fireEvent.mouseDown(handle);
    fireEvent.mouseMove(document, { clientX: 700 });
    expect(root.style.width).toBe("300px");
    fireEvent.mouseUp(document);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: original });
  });
});
