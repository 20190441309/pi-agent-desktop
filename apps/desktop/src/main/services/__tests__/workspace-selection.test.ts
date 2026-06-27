import { describe, expect, it } from "vitest";
import { getMostRecentlyActiveWorkspace } from "../workspace-selection";

describe("workspace-selection", () => {
    it("prefers the most recently active workspace instead of the first entry", () => {
        expect(
            getMostRecentlyActiveWorkspace([
                {
                    id: "default",
                    name: "Default",
                    path: "C:/repo/default",
                    createdAt: 100,
                    lastActiveAt: 100,
                },
                {
                    id: "target",
                    name: "Target",
                    path: "C:/repo/target",
                    createdAt: 200,
                    lastActiveAt: 500,
                },
            ]),
        ).toMatchObject({
            id: "target",
            path: "C:/repo/target",
        });
    });

    it("falls back to createdAt when lastActiveAt is missing", () => {
        expect(
            getMostRecentlyActiveWorkspace([
                {
                    id: "older",
                    name: "Older",
                    path: "C:/repo/older",
                    createdAt: 100,
                },
                {
                    id: "newer",
                    name: "Newer",
                    path: "C:/repo/newer",
                    createdAt: 300,
                },
            ]),
        ).toMatchObject({
            id: "newer",
            path: "C:/repo/newer",
        });
    });
});
