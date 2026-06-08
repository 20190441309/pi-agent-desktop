// @vitest-environment jsdom
//
// 2026-06-06 hotfix: PersistenceBanner 测试
//   - persistErrorCount = 0 → 不渲染
//   - persistErrorCount > 0 → 渲染 banner + 错误数
//   - 点 ✕ 调 clearPersistErrors → 重置 + 不再渲染

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { PersistenceBanner } from "./PersistenceBanner";
import { useSessionStore } from "../../stores/session-store";

beforeEach(() => {
    useSessionStore.setState({
        sessions: [],
        currentSessionId: null,
        persistErrorCount: 0,
        lastPersistError: null,
    });
});

describe("PersistenceBanner", () => {
    it("persistErrorCount = 0 时不渲染", () => {
        const { container } = render(<PersistenceBanner />);
        expect(container.firstChild).toBeNull();
    });

    it("persistErrorCount > 0 时渲染 banner + 错误数 + lastPersistError", () => {
        useSessionStore.setState({ persistErrorCount: 3, lastPersistError: "disk full" });
        render(<PersistenceBanner />);
        const banner = screen.getByRole("alert");
        expect(banner.textContent).toContain("会话数据持久化失败");
        expect(banner.textContent).toContain("3");
        expect(banner.textContent).toContain("disk full");
    });

    it("点 ✕ 调 clearPersistErrors → 重置计数 + 重新不渲染", () => {
        useSessionStore.setState({ persistErrorCount: 5, lastPersistError: "x" });
        const { container } = render(<PersistenceBanner />);
        expect(screen.getByRole("alert")).toBeTruthy();

        fireEvent.click(screen.getByRole("button"));
        expect(useSessionStore.getState().persistErrorCount).toBe(0);
        expect(useSessionStore.getState().lastPersistError).toBeNull();
        // 重新查询: banner 已不渲染
        expect(container.firstChild).toBeNull();
    });
});
