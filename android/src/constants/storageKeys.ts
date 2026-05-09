export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  TOKEN_EXPIRES_AT: 'token_expires_at',
  USER_INFO: 'user_info',

  LOCAL_MESSAGES: 'local_message_center_v1',

  BROWSING_HISTORY: 'resource_browsing_history',
  LATEST_RESOURCES_CACHE: 'resource_latest_cache_v1',

  VIEWING_QUOTA: 'viewing_quota_v1',
  CLAIMED_REWARDS: 'claimed_quota_rewards_v1',

  MARKER_SETTINGS: 'marker_settings',

  VERSION_CHECK_CACHE: 'version_check_cache',

  API_BASE_URL: 'api_base_url',

  PILE_COMPARISON_LAST_VIEWED: 'pile_comparison:last_viewed_reports_at',

  FOREGROUND_SERVICE_REGISTERED: '__lingjian_foreground_service_registered__',
  FOREGROUND_SERVICE_LISTENER: '__lingjian_foreground_service_listener__',
} as const;
