import { API_CONFIG } from '@/constants';

export const testNetworkConnection = async () => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/agentscope/resource-agent/health`);
    const data = await response.json();
    const searchResponse = await fetch(`${API_CONFIG.BASE_URL}/api/resource/intelligent-search?query=测试&page=1&page_size=3`);
    const searchData = await searchResponse.json();
    return { success: true, message: 'All tests passed', health: data, searchOk: searchData.code === 200 };
  } catch (error: any) {
    return { success: false, message: error?.message || 'Network test failed' };
  }
};

export const getNetworkInfo = () => ({
  baseUrl: API_CONFIG.BASE_URL,
  isDev: __DEV__,
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
  platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
});
