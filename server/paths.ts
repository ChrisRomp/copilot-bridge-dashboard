import path from 'path';
import os from 'os';

const bridgeHome = process.env.COPILOT_BRIDGE_HOME ?? path.join(os.homedir(), '.copilot-bridge');

export const paths = {
  bridgeHome,
  configFile: path.join(bridgeHome, 'config.json'),
  stateDb: path.join(bridgeHome, 'state.db'),
  workspaces: path.join(bridgeHome, 'workspaces'),
  logFile: process.env.BRIDGE_LOG_FILE ?? path.join(bridgeHome, 'copilot-bridge.log'),
};
