// @vitest-environment jsdom

import type { ReactElement } from "react";
import { render as rtlRender } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { getLanguageFromFilename, MonacoEditor } from "./MonacoEditor";
import { useSettingsStore } from "../../stores/settings-store";

const monacoMocks = vi.hoisted(() => ({
  loaderConfig: vi.fn(),
}));

let lastOptions: Record<string, unknown> | null = null;
let lastHeight: string | undefined;
let lastWidth: string | undefined;
let lastLanguage: string | undefined;
let lastEditor: {
  addAction: (action: unknown) => void;
  executeEdits: (source: string, edits: Array<{ text: string }>) => void;
  focus: () => void;
  getModel: () => { getFullModelRange: () => { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number } };
  getValue: () => string;
  setValue: (value: string) => void;
} | null = null;

vi.mock("@monaco-editor/react", () => ({
  default: function MockEditor({
    height,
    language,
    onMount,
    options,
    value,
    width,
  }: {
    height?: string;
    language?: string;
    onMount?: (editor: NonNullable<typeof lastEditor>, monacoApi: { KeyCode: { KeyS: number }; KeyMod: { CtrlCmd: number } }) => void;
    options: Record<string, unknown>;
    value?: string;
    width?: string;
  }) {
    lastHeight = height;
    lastLanguage = language;
    lastOptions = options;
    lastWidth = width;
    let currentValue = value ?? "";
    lastEditor = {
      addAction: vi.fn(),
      executeEdits: vi.fn((_source: string, edits: Array<{ text: string }>) => {
        currentValue = edits[0]?.text ?? currentValue;
      }),
      focus: vi.fn(),
      getModel: () => ({
        getFullModelRange: () => ({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: currentValue.length + 1 }),
      }),
      getValue: () => currentValue,
      setValue: (nextValue) => {
        currentValue = nextValue;
      },
    };
    onMount?.(lastEditor, { KeyCode: { KeyS: 49 }, KeyMod: { CtrlCmd: 2048 } });
    return <div data-testid="monaco-editor" />;
  },
  loader: {
    config: monacoMocks.loaderConfig,
  },
}));
vi.mock("monaco-editor", () => ({
  editor: {},
  languages: {},
}));

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: I18nProvider });
}

describe("MonacoEditor settings", () => {
  beforeEach(() => {
    lastHeight = undefined;
    lastLanguage = undefined;
    lastOptions = null;
    lastWidth = undefined;
    lastEditor = null;
    window.localStorage.removeItem("pi-desktop:e2e");
    delete window.__PI_DESKTOP_E2E_MONACO__;
    useSettingsStore.setState((state) => ({
      settings: {
        ...state.settings,
        fontSize: 14,
        showLineNumbers: false,
        wordWrap: false,
      },
    }));
  });

  it("passes line number and word wrap settings into Monaco", () => {
    render(<MonacoEditor value="const app = true;" />);

    expect(lastOptions?.editContext).toBe(false);
    expect(lastOptions?.lineNumbers).toBe("off");
    expect(lastOptions?.wordWrap).toBe("off");
  });

  it("uses a concrete editor height so Monaco does not collapse in Electron", () => {
    render(<MonacoEditor value="const app = true;" height="max(400px, calc(100vh - 128px))" />);

    expect(lastHeight).toBe("max(400px, calc(100vh - 128px))");
    expect(lastWidth).toBe("100%");
  });

  it("configures Monaco to load from the bundled local package", () => {
    expect(monacoMocks.loaderConfig).toHaveBeenCalledWith({
      monaco: expect.any(Object),
    });
  });

  it("does not expose the E2E Monaco handle unless explicitly enabled", () => {
    render(<MonacoEditor value="const app = true;" />);

    expect(window.__PI_DESKTOP_E2E_MONACO__).toBeUndefined();
  });

  it("exposes an E2E Monaco handle when the E2E flag is enabled", () => {
    window.localStorage.setItem("pi-desktop:e2e", "true");
    const onChange = vi.fn();

    render(<MonacoEditor value="const app = true;" onChange={onChange} />);
    window.__PI_DESKTOP_E2E_MONACO__?.replaceAll("const app = false;");

    expect(window.__PI_DESKTOP_E2E_MONACO__?.getValue()).toBe("const app = false;");
    expect(lastEditor?.getValue()).toBe("const app = false;");
    expect(onChange).toHaveBeenCalledWith("const app = false;");
  });

  it("passes readOnly and language into Monaco", () => {
    render(<MonacoEditor value="x = 1" language="python" readOnly />);

    expect(lastOptions?.readOnly).toBe(true);
    expect(lastLanguage).toBe("python");
  });
  it("registers Ctrl/Cmd+S save action when onSave is provided", () => {
    const onSave = vi.fn();
    render(<MonacoEditor value="export const ok = 1;" onSave={onSave} />);

    expect(lastEditor?.addAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "save-file",
        keybindings: [2048 | 49],
      }),
    );

    const action = (lastEditor?.addAction as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      run: () => void;
    };
    action.run();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("does not register a save action when onSave is omitted", () => {
    render(<MonacoEditor value="export const ok = 1;" />);
    expect(lastEditor?.addAction).not.toHaveBeenCalled();
  });

  it("forwards long text via E2E replaceAll without truncating content", () => {
    window.localStorage.setItem("pi-desktop:e2e", "true");
    const onChange = vi.fn();
    render(<MonacoEditor value="" onChange={onChange} />);
    const longText = "line\n".repeat(5_000);
    window.__PI_DESKTOP_E2E_MONACO__?.replaceAll(longText);

    expect(window.__PI_DESKTOP_E2E_MONACO__?.getValue()).toBe(longText);
    expect(onChange).toHaveBeenCalledWith(longText);
  });

  it("maps lineNumbers and wordWrap when settings are enabled", () => {
    useSettingsStore.setState((state) => ({
      settings: {
        ...state.settings,
        showLineNumbers: true,
        wordWrap: true,
      },
    }));

    render(<MonacoEditor value="const app = true;" />);

    expect(lastOptions?.lineNumbers).toBe("on");
    expect(lastOptions?.wordWrap).toBe("on");
  });
});

describe("getLanguageFromFilename", () => {
  it.each([
    ["app.ts", "typescript"],
    ["App.tsx", "typescript"],
    ["index.js", "javascript"],
    ["page.jsx", "javascript"],
    ["data.json", "json"],
    ["README.md", "markdown"],
    ["main.py", "python"],
    ["script.sh", "shell"],
    ["run.ps1", "powershell"],
    ["config.yml", "yaml"],
    ["styles.scss", "scss"],
    ["unknown.xyz", "plaintext"],
    ["Makefile", "plaintext"],
  ])("maps %s → %s", (filename, language) => {
    expect(getLanguageFromFilename(filename)).toBe(language);
  });
});
