// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary, reportError } from "./ErrorBoundary";
import { I18nProvider } from "../../i18n";

vi.mock("../../utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { logger } from "../../utils/logger";

function Boom(): React.JSX.Element {
  throw new Error("boom-render");
}

describe("ErrorBoundary / reportError", () => {
  it("reportError logs via logger channel", () => {
    const err = new Error("reported");
    reportError(err, { componentStack: "stack" } as React.ErrorInfo);
    expect(logger.error).toHaveBeenCalled();
  });

  it("renders fallback UI and retries after reset", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;
    function Flaky(): React.JSX.Element {
      if (shouldThrow) throw new Error("boom-render");
      return <div>recovered</div>;
    }

    render(
      <I18nProvider>
        <ErrorBoundary>
          <Flaky />
        </ErrorBoundary>
      </I18nProvider>,
    );

    expect(screen.getByText("boom-render")).toBeTruthy();
    const retry = screen.getByRole("button", { name: /重试|再试|Retry/i });
    expect(retry.getAttribute("type")).toBe("button");

    shouldThrow = false;
    fireEvent.click(retry);
    expect(screen.getByText("recovered")).toBeTruthy();
    consoleError.mockRestore();
  });

  it("uses custom fallback when provided", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary
        fallback={(err, reset) => (
          <div>
            <span>custom:{err.message}</span>
            <button type="button" onClick={reset}>
              reset-custom
            </button>
          </div>
        )}
      >
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("custom:boom-render")).toBeTruthy();
    consoleError.mockRestore();
  });
});
