import { beforeEach, describe, expect, it } from "vitest";
import type { Attachment } from "../../types/attachments";
import { useAttachmentsStore } from "../attachments-store";

function att(id: string, name = id): Attachment {
  return { id, kind: "file", name, value: `C:/tmp/${name}` };
}

describe("attachments-store", () => {
  beforeEach(() => {
    useAttachmentsStore.setState({ byWorkspace: {} });
  });

  it("adds and lists attachments per workspace", () => {
    useAttachmentsStore.getState().add("ws-a", att("1", "a.ts"));
    useAttachmentsStore.getState().add("ws-b", att("2", "b.ts"));
    expect(useAttachmentsStore.getState().list("ws-a")).toHaveLength(1);
    expect(useAttachmentsStore.getState().list("ws-b")[0]?.name).toBe("b.ts");
    expect(useAttachmentsStore.getState().list("ws-missing")).toEqual([]);
  });

  it("removes by id without affecting other workspaces", () => {
    useAttachmentsStore.getState().add("ws-a", att("1"));
    useAttachmentsStore.getState().add("ws-a", att("2"));
    useAttachmentsStore.getState().add("ws-b", att("3"));
    useAttachmentsStore.getState().remove("ws-a", "1");
    expect(useAttachmentsStore.getState().list("ws-a").map((a) => a.id)).toEqual(["2"]);
    expect(useAttachmentsStore.getState().list("ws-b")).toHaveLength(1);
  });

  it("clears a workspace entry entirely", () => {
    useAttachmentsStore.getState().add("ws-a", att("1"));
    useAttachmentsStore.getState().clear("ws-a");
    expect(useAttachmentsStore.getState().byWorkspace["ws-a"]).toBeUndefined();
    expect(useAttachmentsStore.getState().list("ws-a")).toEqual([]);
  });

  it("enforces max 20 attachments per workspace", () => {
    for (let i = 0; i < 25; i += 1) {
      useAttachmentsStore.getState().add("ws-a", att(String(i)));
    }
    expect(useAttachmentsStore.getState().list("ws-a")).toHaveLength(20);
    expect(useAttachmentsStore.getState().list("ws-a")[0]?.id).toBe("0");
    expect(useAttachmentsStore.getState().list("ws-a")[19]?.id).toBe("19");
  });
});
