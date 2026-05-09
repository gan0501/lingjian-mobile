import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/stores/useAuthStore';
import { API_CONFIG } from '@/constants/config';
import { authenticatedFetch } from '@/services/authenticatedFetch';

export function useAIToolGuard(toolId: string) {
  const navigation = useNavigation<any>();
  const { isLoggedIn } = useAuthStore();

  const guard = useCallback(async (): Promise<boolean> => {
    console.log(`[AIToolGuard] 开始检查 toolId=${toolId}, isLoggedIn=${isLoggedIn}`);
    
    if (!isLoggedIn) {
      console.log(`[AIToolGuard] 用户未登录，跳转登录页`);
      navigation.navigate('Login');
      return false;
    }

    try {
      console.log(`[AIToolGuard] 调用 pre-check API...`);
      const res = await authenticatedFetch(`${API_CONFIG.BASE_URL}/api/billing/pre-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: toolId }),
      });
      const json = await res.json();
      console.log(`[AIToolGuard] API 返回:`, JSON.stringify(json));

      // API 返回失败
      if (!json.success) {
        console.warn(`[AIToolGuard] API 返回失败 toolId=${toolId}`, json);
        // 降级放行，避免阻塞用户
        return true;
      }

      // 检查是否被拦截
      if (json.data && !json.data.allowed) {
        const reason = json.data.reason || 'insufficient_balance';
        console.log(`[AIToolGuard] 被拦截 reason=${reason}`);

        if (reason === 'no_membership' || reason === 'membership_expired') {
          Alert.alert(
            reason === 'membership_expired' ? '会员已过期' : '需要开通会员',
            json.data.message || 'AI 工具仅限会员使用',
            [
              { text: '取消', style: 'cancel' },
              {
                text: reason === 'membership_expired' ? '去续费' : '开通会员',
                onPress: () => navigation.navigate('MembershipPay'),
              },
            ],
          );
        } else {
          Alert.alert(
            '余额不足',
            json.data.message || '当前余额不足以使用该工具，请先充值',
            [
              { text: '取消', style: 'cancel' },
              {
                text: '去充值',
                onPress: () => navigation.navigate('MembershipPay'),
              },
            ],
          );
        }
        return false;
      }
      
      console.log(`[AIToolGuard] 权限检查通过 toolId=${toolId}`);
    } catch (e) {
      console.warn(`[AIToolGuard] pre-check 异常，降级放行 toolId=${toolId}`, e);
    }

    return true;
  }, [toolId, isLoggedIn, navigation]);

  return guard;
}
