import fs from 'fs';
import { paths } from './paths.js';

// Types mirroring bridge config structure
export interface BotConfig {
  token: string;
  appToken?: string;
  agent?: string | null;
  admin?: boolean;
  model?: string;
  access?: AccessConfig;
}

export interface AccessConfig {
  mode: 'allowlist' | 'blocklist' | 'open';
  users?: string[];
}

export interface PlatformConfig {
  url?: string;
  bots?: Record<string, BotConfig>;
  access?: AccessConfig;
}

export interface ChannelConfig {
  id: string;
  platform: string;
  name: string;
  workingDirectory: string;
  bot?: string;
  agent?: string | null;
  model?: string;
  fallbackModels?: string[];
  triggerMode: 'mention' | 'all';
  threadedReplies: boolean;
  verbose: boolean;
  isDM?: boolean;
}

export interface AppConfig {
  platforms: Record<string, PlatformConfig>;
  channels: ChannelConfig[];
  defaults: {
    model: string;
    agent: string | null;
    triggerMode: 'mention' | 'all';
    threadedReplies: boolean;
    verbose: boolean;
    permissionMode: 'interactive' | 'autopilot';
    fallbackModels?: string[];
  };
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  permissions?: {
    allow?: string[];
    deny?: string[];
    allowPaths?: string[];
    allowUrls?: string[];
  };
  interAgent?: {
    enabled: boolean;
    defaultTimeout?: number;
    maxTimeout?: number;
    maxDepth?: number;
    allow?: Record<string, unknown>;
  };
}

// Sanitized versions that strip tokens
export interface SanitizedBotConfig {
  agent?: string | null;
  admin?: boolean;
  model?: string;
  hasToken: boolean;
  hasAppToken: boolean;
  access?: AccessConfig;
}

export interface SanitizedPlatformConfig {
  url?: string;
  bots?: Record<string, SanitizedBotConfig>;
  access?: AccessConfig;
}

export interface SanitizedConfig {
  platforms: Record<string, SanitizedPlatformConfig>;
  channels: ChannelConfig[];
  defaults: AppConfig['defaults'];
  logLevel?: string;
  permissions?: AppConfig['permissions'];
  interAgent?: AppConfig['interAgent'];
}

let cachedConfig: AppConfig | null = null;
let lastMtime = 0;

export function loadConfig(): AppConfig {
  const stat = fs.statSync(paths.configFile);
  if (cachedConfig && stat.mtimeMs === lastMtime) {
    return cachedConfig;
  }
  const raw = fs.readFileSync(paths.configFile, 'utf-8');
  cachedConfig = JSON.parse(raw) as AppConfig;
  lastMtime = stat.mtimeMs;
  return cachedConfig;
}

export function sanitizeConfig(config: AppConfig): SanitizedConfig {
  const sanitizedPlatforms: Record<string, SanitizedPlatformConfig> = {};

  for (const [name, platform] of Object.entries(config.platforms)) {
    const sanitizedBots: Record<string, SanitizedBotConfig> = {};
    if (platform.bots) {
      for (const [botName, bot] of Object.entries(platform.bots)) {
        sanitizedBots[botName] = {
          agent: bot.agent,
          admin: bot.admin,
          model: bot.model,
          hasToken: !!bot.token,
          hasAppToken: !!bot.appToken,
          access: bot.access,
        };
      }
    }
    sanitizedPlatforms[name] = {
      url: platform.url,
      bots: sanitizedBots,
      access: platform.access,
    };
  }

  return {
    platforms: sanitizedPlatforms,
    channels: config.channels,
    defaults: config.defaults,
    logLevel: config.logLevel,
    permissions: config.permissions,
    interAgent: config.interAgent,
  };
}

export function invalidateConfigCache(): void {
  cachedConfig = null;
  lastMtime = 0;
}
