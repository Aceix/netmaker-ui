import { ServerConfig, ServerStatus } from '@/models/ServerConfig';
import { StateCreator } from 'zustand';
import { AvailableThemes } from '../models/AvailableThemes';
import { ServerConfigService } from '@/services/ServerConfigService';

export interface IAppSlice {
  currentTheme: AvailableThemes;
  logoUrl: string;
  serverName: string;
  serverStatus: { status: ServerStatus | null; isHealthy: boolean };
  serverConfig: ServerConfig | null;

  // methods
  setCurrentTheme: (theme: AvailableThemes) => void;
  setLogoUrl: (url: string) => void;
  setServerName: (name: string) => void;
  setServerStatus: (status: ServerStatus) => void;
  fetchServerConfig: () => Promise<boolean>;
}

const createAppSlice: StateCreator<IAppSlice, [], [], IAppSlice> = (set) => ({
  currentTheme: 'dark',
  logoUrl: '',
  serverName: '',
  serverStatus: { status: null, isHealthy: true },
  serverConfig: null,

  setCurrentTheme: (theme) => set(() => ({ currentTheme: theme })),
  setLogoUrl: (url) => set(() => ({ logoUrl: url })),
  setServerName: (name) => set(() => ({ serverName: name })),
  setServerStatus: (status) =>
    set(() => ({
      serverStatus: {
        status,
        isHealthy: status.broker_connected && status.db_connected && status.healthyNetwork,
      },
    })),
  fetchServerConfig: async () => {
    try {
      const serverConfig = (await ServerConfigService.getServerConfig()).data;
      set(() => ({ serverConfig }));
      return Promise.resolve(true);
    } catch (err) {
      console.error(err);
      return Promise.reject(false);
    }
  },
});

export const AppSlice = {
  createAppSlice,
};
