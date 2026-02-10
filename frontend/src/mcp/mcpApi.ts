// MCP API wrapper - imports from Wails-generated bindings
import {
  GetMCPConfig as _GetMCPConfig,
  SetMCPConfig as _SetMCPConfig,
  GetMCPStatus as _GetMCPStatus,
  StartMCPServer as _StartMCPServer,
  StopMCPServer as _StopMCPServer,
} from '../../wailsjs/go/main/App';

export interface MCPConfig {
  enabled: boolean;
  host: string;
  port: number;
  transportMode: string;
  allowDestructive: boolean;
  requireConfirm: boolean;
  maxLogLines: number;
}

export interface MCPStatus {
  running: boolean;
  enabled: boolean;
  transport: string;
  address: string;
}

export async function GetMCPConfig(): Promise<MCPConfig> {
  const raw = await _GetMCPConfig();
  return {
    enabled: raw.enabled ?? false,
    host: raw.host ?? 'localhost',
    port: raw.port ?? 3000,
    transportMode: raw.transportMode ?? 'http',
    allowDestructive: raw.allowDestructive ?? false,
    requireConfirm: raw.requireConfirm ?? true,
    maxLogLines: raw.maxLogLines ?? 1000,
  };
}

export async function SetMCPConfig(config: MCPConfig): Promise<void> {
  await _SetMCPConfig(config);
}

export async function GetMCPStatus(): Promise<MCPStatus> {
  const raw = await _GetMCPStatus();
  return {
    running: raw.running ?? false,
    enabled: raw.enabled ?? false,
    transport: raw.transport ?? 'http',
    address: raw.address ?? '',
  };
}

export async function StartMCPServer(): Promise<void> {
  await _StartMCPServer();
}

export async function StopMCPServer(): Promise<void> {
  await _StopMCPServer();
}
