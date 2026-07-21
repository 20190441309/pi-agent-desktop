// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { ShortcutsCheatsheet } from "./ShortcutsCheatsheet";

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => undefined,
}));

vi.mock("../../shortcuts/registry", () => ({
  getEffectiveShortcuts: () => [
    {
      id: "new-session",
      keys: "Ctrl+N",
      category: "session",
      labelKey: "shortcuts.items.newSession",
      descriptionKey: "shortcuts.items.newSessionDesc",
    },
    {
      id: "open-settings",
      keys: "Ctrl+,",
      category: "app",
      labelKey: "shortcuts.items.openSettings",
      descriptionKey: "shortcuts.items.openSettingsDesc",
    },
  ],
  groupByCategory: (items: Array<{ category: string }>) => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries()).map(([category, groupItems]) => ({
      category,
      items: groupItems,
    }));
  },
}));

describe("ShortcutsCheatsheet", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <I18nProvider>
        <ShortcutsCheatsheet isOpen={false} onClose={vi.fn()} />
      </I18nProvider>,
    );
    expect(container.textContent).toBe("");
  });

  it("opens dialog and closes via close button", () => {
    const onClose = vi.fn();
    render(
      <I18nProvider>
        <ShortcutsCheatsheet isOpen onClose={onClose} />
      </I18nProvider>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    const close = screen.getByRole("button", { name: /关闭|Close/i });
    expect(close.getAttribute("type")).toBe("button");
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <I18nProvider>
        <ShortcutsCheatsheet isOpen onClose={onClose} />
      </I18nProvider>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
