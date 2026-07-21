// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useInputText } from "./useInputText";

function Probe() {
  const { textareaRef, inputValue, setInputValue } = useInputText();
  return (
    <div>
      <textarea
        ref={textareaRef}
        data-testid="composer"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <button type="button" data-testid="seed" onClick={() => setInputValue("line1\nline2\nline3")}>
        seed
      </button>
      <span data-testid="value">{inputValue}</span>
    </div>
  );
}

describe("useInputText", () => {
  it("starts empty and updates from typing", () => {
    render(<Probe />);
    const ta = screen.getByTestId("composer") as HTMLTextAreaElement;
    expect(ta.value).toBe("");
    fireEvent.change(ta, { target: { value: "hello" } });
    expect(screen.getByTestId("value").textContent).toBe("hello");
    expect(ta.value).toBe("hello");
  });

  it("accepts programmatic setInputValue and keeps the ref attached", () => {
    render(<Probe />);
    act(() => {
      fireEvent.click(screen.getByTestId("seed"));
    });
    const ta = screen.getByTestId("composer") as HTMLTextAreaElement;
    expect(ta.value).toBe("line1\nline2\nline3");
    // auto-height layout effect ran; jsdom may leave height as auto or a px value
    expect(ta.style.height === "auto" || /px$/.test(ta.style.height)).toBe(true);
  });
});
