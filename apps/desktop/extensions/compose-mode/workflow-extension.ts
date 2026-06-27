import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createWorkflowTool } from "./workflow-tool.ts";
import { WorkflowRunStore } from "./workflow-run-store.ts";

export default function composeWorkflowExtension(pi: ExtensionAPI): void {
    const workflowRuns = new WorkflowRunStore();
    pi.registerTool(createWorkflowTool(workflowRuns));
}
