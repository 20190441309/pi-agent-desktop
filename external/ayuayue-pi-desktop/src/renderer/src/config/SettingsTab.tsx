import type { SettingsFile } from "./configTypes";

// ── Settings Tab ────────────────────────────────────────

export function SettingsTab(props: {
	data: SettingsFile;
	saving: boolean;
	onChange: (data: SettingsFile) => void;
	onSave: () => void;
}) {
	const { data, saving } = props;
	const entries = Object.entries(data);

	return (
		<div className="config-settings-tab">
			<div className="config-toolbar">
				<span className="config-count">{entries.length} 个配置项</span>
				<button
					className="config-btn primary"
					onClick={props.onSave}
					disabled={saving}
				>
					{saving ? "保存中…" : "保存"}
				</button>
			</div>
			<div className="config-settings-list">
				{entries.map(([key, value]) => (
					<div key={key} className="config-settings-row">
						<span className="config-settings-key">{key}</span>
						<SettingsValueInput
							value={value}
							onChange={(v) => props.onChange({ ...data, [key]: v })}
						/>
					</div>
				))}
				{entries.length === 0 && <div className="config-empty">暂无配置</div>}
			</div>
		</div>
	);
}

function SettingsValueInput(props: {
	value: unknown;
	onChange: (v: unknown) => void;
}) {
	const { value } = props;
	if (typeof value === "boolean") {
		return (
			<label className="config-checkbox-label">
				<input
					type="checkbox"
					checked={value}
					onChange={(e) => props.onChange(e.target.checked)}
				/>
				<span>{value ? "true" : "false"}</span>
			</label>
		);
	}
	if (typeof value === "number") {
		return (
			<input
				type="number"
				value={value}
				onChange={(e) => props.onChange(Number(e.target.value))}
				className="config-settings-input"
			/>
		);
	}
	if (typeof value === "string") {
		return (
			<input
				value={value}
				onChange={(e) => props.onChange(e.target.value)}
				className="config-settings-input"
			/>
		);
	}
	return (
		<input
			value={JSON.stringify(value)}
			onChange={(e) => {
				try {
					props.onChange(JSON.parse(e.target.value));
				} catch {
					/* 输入过程中 JSON 不合法时暂不更新 */
				}
			}}
			className="config-settings-input"
		/>
	);
}


