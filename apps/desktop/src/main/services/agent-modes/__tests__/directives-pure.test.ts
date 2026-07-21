import { describe, expect, it } from "vitest";
import {
  BUILD_SWITCH,
  COMPOSE_DIRECTIVE,
  PLAN_DIRECTIVE_TEMPLATE,
  formatComposeDocsBlock,
  formatPlanDirective,
} from "../directives";
import { PLAN_DIRECTIVE } from "../plan-prompt";

describe("formatPlanDirective", () => {
  it("substitutes create path when plan file does not exist", () => {
    const text = formatPlanDirective(".pi/plans/new.md", false);
    expect(text).toContain("No plan file exists yet");
    expect(text).toContain(".pi/plans/new.md");
    expect(text).not.toContain("{{PLAN_FILE_INFO}}");
    expect(text).toContain("Plan mode is active");
  });

  it("substitutes edit path when plan file exists", () => {
    const text = formatPlanDirective(".pi/plans/existing.md", true);
    expect(text).toContain("A plan file already exists at .pi/plans/existing.md");
    expect(text).toContain("incremental edits");
    expect(text).not.toContain("{{PLAN_FILE_INFO}}");
  });

  it("keeps PLAN_DIRECTIVE_TEMPLATE placeholder for tests", () => {
    expect(PLAN_DIRECTIVE_TEMPLATE).toContain("{{PLAN_FILE_INFO}}");
    expect(PLAN_DIRECTIVE_TEMPLATE).toContain("Plan mode is active");
    expect(PLAN_DIRECTIVE_TEMPLATE).toContain("Phase 4: Final Plan");
  });
});

describe("formatComposeDocsBlock / constants", () => {
  it("formats compose docs directory block", () => {
    const block = formatComposeDocsBlock(".pi/compose");
    expect(block).toContain("<compose_docs_dir>");
    expect(block).toContain("`.pi/compose/specs`");
    expect(block).toContain("`.pi/compose/plans`");
    expect(block).toContain("`.pi/compose/reports`");
    expect(block).toContain("</compose_docs_dir>");
  });

  it("exposes compose and build-switch reminders", () => {
    expect(COMPOSE_DIRECTIVE).toContain("Compose Agent");
    expect(COMPOSE_DIRECTIVE).toContain("compose:ask");
    expect(BUILD_SWITCH).toContain("plan to build");
    expect(BUILD_SWITCH).toContain("no longer in read-only mode");
  });
});

describe("plan-prompt PLAN_DIRECTIVE", () => {
  it("keeps short read-only contract for message prepend", () => {
    expect(PLAN_DIRECTIVE).toContain("Plan mode is active");
    expect(PLAN_DIRECTIVE).toContain(".pi/plans/");
    expect(PLAN_DIRECTIVE).toContain("read-only");
  });
});
