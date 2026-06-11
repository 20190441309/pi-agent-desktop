import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { AuthFile } from "./configTypes";
import { SecretInput } from "./ConfigShared";

// ── Auth Tab ────────────────────────────────────────────

export function AuthTab(props: {
	data: AuthFile;
	expandedAuth: string | null;
	addingAuth: boolean;
	newAuthName: string;
	saving: boolean;
	onToggleAuth: (name: string) => void;
	onStartAddAuth: () => void;
	onCancelAddAuth: () => void;
	onChangeNewAuthName: (name: string) => void;
	onConfirmAddAuth: () => void;
	onDeleteAuth: (provider: string) => void;
	onUpdate: (provider: string, field: string, value: string) => void;
	onSave: () => void;
}) {
	const { data, expandedAuth, saving } = props;
	const providers = Object.keys(data);

	return (
		<div className="config-auth-tab">
			<div className="config-toolbar">
				<span className="config-count">{providers.length} 个 provider</span>
				<div style={{ display: "flex", gap: 8 }}>
					<button
						className="config-btn"
						onClick={props.onStartAddAuth}
						disabled={saving}
					>
						+ Auth
					</button>
					<button
						className="config-btn primary"
						onClick={props.onSave}
						disabled={saving}
					>
						{saving ? "保存中…" : "保存"}
					</button>
				</div>
			</div>

			{props.addingAuth && (
				<div className="config-add-provider-row">
					<input
						value={props.newAuthName}
						onChange={(e) => props.onChangeNewAuthName(e.target.value)}
						placeholder="provider 名称，如 openai"
						onKeyDown={(e) => e.key === "Enter" && props.onConfirmAddAuth()}
						autoFocus
					/>
					<button
						className="config-btn primary"
						onClick={props.onConfirmAddAuth}
						disabled={!props.newAuthName.trim()}
					>
						确认
					</button>
					<button className="config-btn" onClick={props.onCancelAddAuth}>
						取消
					</button>
				</div>
			)}

			<div className="config-auth-list">
				{providers.map((name) => {
					const auth = data[name];
					const isExpanded = expandedAuth === name;
					return (
						<div
							key={name}
							className={`config-auth-card ${isExpanded ? "editing" : ""}`}
						>
							<div
								className="config-auth-card-header"
								onClick={() => props.onToggleAuth(name)}
							>
								<span className="config-auth-provider">{name}</span>
								<span className="config-auth-key-preview">
									{auth.key
										? `${auth.key.slice(0, 10)}••••••${auth.key.slice(-4)}`
										: "未配置"}
								</span>
								<div className="config-provider-actions">
									<button
										className="config-icon-btn danger"
										onClick={(e) => {
											e.stopPropagation();
											props.onDeleteAuth(name);
										}}
										title="删除"
									>
										<Trash2 size={14} />
									</button>
									<span className="config-chevron">
										{isExpanded ? (
											<ChevronDown size={14} />
										) : (
											<ChevronRight size={14} />
										)}
									</span>
								</div>
							</div>
							{isExpanded && (
								<div className="config-provider-form">
									<div className="config-form-row">
										<label>类型</label>
										<input
											value={auth.type ?? "api_key"}
											onChange={(e) =>
												props.onUpdate(name, "type", e.target.value)
											}
										/>
									</div>
									<div className="config-form-row">
										<label>API Key</label>
										<SecretInput
											value={auth.key ?? ""}
											onChange={(v) => props.onUpdate(name, "key", v)}
										/>
									</div>
								</div>
							)}
						</div>
					);
				})}
				{providers.length === 0 && (
					<div className="config-empty">暂无 Auth 配置</div>
				)}
			</div>
		</div>
	);
}


