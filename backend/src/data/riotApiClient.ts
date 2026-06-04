import axios, { AxiosError } from 'axios';
import { RiotMatchDto } from '../types/riot.js';

// Default base is americas; getBaseForMatchId will select correct regional host
const DEFAULT_RIOT_API_BASE = 'https://americas.api.riotgames.com';

export interface RiotApiClientConfig {
  apiKey: string;
  timeout?: number;
}

export class RiotApiClient {
  private apiKey: string;
  private timeout: number;

  constructor(config: RiotApiClientConfig) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 10000;
  }

  async getMatch(matchId: string): Promise<RiotMatchDto> {
    if (!matchId) {
      throw new Error('Match ID is required');
    }

    try {
      const base = this.getBaseForMatchId(matchId);
      const url = `${base}/lol/match/v5/matches/${matchId}`;

      const response = await axios.get<RiotMatchDto>(url, {
        headers: {
          'X-Riot-Token': this.apiKey,
          'User-Agent': 'LoLEsportsAnalyst/1.0',
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.response?.status === 404) {
          throw new Error(`Match not found: ${matchId}`);
        }
        
        if (axiosError.response?.status === 429) {
          const retryAfter = axiosError.response?.headers['retry-after'] || '60';
          throw new Error(`Rate limited. Retry after ${retryAfter}s`);
        }
        
        if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
          throw new Error('Invalid or expired API key');
        }
        
        throw new Error(`Riot API error: ${axiosError.response?.status} ${axiosError.response?.statusText}`);
      }
      
      throw error;
    }
  }

  /**
   * Determine regional base host from the match id prefix (platform).
   * Example matchId: "EUW1_123..." => europe region host.
   */
  private getBaseForMatchId(matchId: string): string {
    try {
      const platform = matchId.split('_')[0];
      const platformToRegion: Record<string, string> = {
        // Europe
        'EUW1': 'europe',
        'EUN1': 'europe',
        'TR1': 'europe',
        'RU': 'europe',
        // Americas
        'NA1': 'americas',
        'BR1': 'americas',
        'LA1': 'americas',
        'LA2': 'americas',
        'OC1': 'americas',
        'PBE1': 'americas',
        // Asia / APAC
        'KR': 'asia',
        'JP1': 'asia',
      };

      const region = platformToRegion[platform] || 'americas';
      return `https://${region}.api.riotgames.com`;
    } catch (err) {
      return DEFAULT_RIOT_API_BASE;
    }
  }

  /**
   * Lightweight ping to verify API key validity and Riot API reachability.
   * Uses the platform status endpoint which requires a valid key.
   */
  async ping(): Promise<any> {
    try {
      const url = `https://europe.api.riotgames.com/lol/status/v4/platform-data`;
      const response = await axios.get(url, {
        headers: {
          'X-Riot-Token': this.apiKey,
          'User-Agent': 'LoLEsportsAnalyst/1.0',
        },
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
          throw new Error('Invalid or expired API key');
        }
        if (axiosError.response?.status === 429) {
          const retryAfter = axiosError.response?.headers['retry-after'] || '60';
          throw new Error(`Rate limited. Retry after ${retryAfter}s`);
        }
        throw new Error(`Riot API error: ${axiosError.response?.status} ${axiosError.response?.statusText}`);
      }
      throw error;
    }
  }
}
