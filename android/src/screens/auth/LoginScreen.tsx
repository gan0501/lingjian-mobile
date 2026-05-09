import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore, useMembershipStore, useFollowedProjectStore } from '@/stores';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants';
import { showSystemAlert } from '@/components/common/CustomAlert';
import { authApi } from '@/services';
import AsyncStorage from '@react-native-async-storage/async-storage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AGREEMENT_KEY = 'user_agreement_accepted';

const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { setTokens, setUser, setLoading, isLoading } = useAuthStore();
  const { fetchMembership } = useMembershipStore();
  const { loadFollowedProjects } = useFollowedProjectStore();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    checkAgreementStatus();
  }, []);

  const checkAgreementStatus = async () => {
    try {
      const accepted = await AsyncStorage.getItem(AGREEMENT_KEY);
      if (accepted === 'true') {
        setAgreed(true);
      }
    } catch (error) {
      console.log('checkAgreementStatus error:', error);
    }
  };

  const handleAgreeToggle = () => {
    setAgreed(!agreed);
  };

  const handleOpenAgreement = (type: 'user' | 'privacy') => {
    navigation.navigate('Agreement', { type });
  };

  const handleBrowseAsGuest = () => {
    navigation.goBack();
  };

  const ensureAgreement = async (): Promise<boolean> => {
    if (agreed) return true;

    return new Promise((resolve) => {
      showSystemAlert(
        '提示',
        '请阅读并同意用户协议和隐私政策',
        [
          {
            text: '取消',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: '同意',
            onPress: async () => {
              setAgreed(true);
              await AsyncStorage.setItem(AGREEMENT_KEY, 'true');
              resolve(true);
            },
          },
        ]
      );
    });
  };

  const handleSendCode = async () => {
    if (!phone || phone.length !== 11) {
      Alert.alert('提示', '请输入正确的手机号');
      return;
    }

    try {
      await authApi.sendCode(phone);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      Alert.alert('发送失败', e?.message || '请检查手机号后重试');
    }
  };

  const handleLogin = async () => {
    if (!phone || !code) {
      Alert.alert('提示', '请输入手机号和验证码');
      return;
    }

    const canProceed = await ensureAgreement();
    if (!canProceed) return;

    setLoading(true);
    try {
      const res: any = await authApi.loginWithCode(phone, code);
      const token = res?.token || res?.result?.token;
      const refreshToken = res?.refresh_token || res?.result?.refresh_token;
      const expiresAt = res?.expires_at || res?.result?.expires_at;
      const user = res?.user || res?.result?.user;

      if (!token) {
        Alert.alert('登录失败', '服务器返回异常，请稍后重试');
        return;
      }

      setTokens(token, refreshToken || '', expiresAt || 0);
      if (user) {
        setUser({
          id: user.id,
          nickname: user.nickname || user.name || '用户',
          phone: user.phone || phone,
          avatar: user.avatar,
          role: user.role,
          created_at: user.created_at,
        });
      } else {
        setUser({ id: 0, nickname: '用户', phone });
      }
      fetchMembership(token);
      loadFollowedProjects(true);
      navigation.goBack();
    } catch (error: any) {
      const msg = error?.message || '请检查手机号和验证码';
      Alert.alert('登录失败', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <TouchableOpacity
        style={[styles.guestButton, { top: insets.top + 16 }]}
        onPress={handleBrowseAsGuest}
        activeOpacity={0.7}
      >
        <Text style={styles.guestButtonText}>随便看看</Text>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 80,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/logo-background.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>领建</Text>
          <Text style={styles.subtitle}>智能建造助手</Text>
        </View>

        <View style={styles.form}>
          <View style={[styles.inputWrapper, focusedField === 'phone' && styles.inputWrapperFocused]}>
            <TextInput
              style={styles.input}
              placeholder="请输入手机号码"
              placeholderTextColor="#C4C4C4"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={11}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={[styles.inputWrapper, focusedField === 'code' && styles.inputWrapperFocused]}>
            <TextInput
              style={styles.input}
              placeholder="请输入短信验证码"
              placeholderTextColor="#C4C4C4"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              onFocus={() => setFocusedField('code')}
              onBlur={() => setFocusedField(null)}
            />
            <TouchableOpacity
              style={[styles.codeButton, countdown > 0 && styles.codeButtonDisabled]}
              onPress={handleSendCode}
              disabled={countdown > 0}
            >
              <Text style={[styles.codeButtonText, countdown > 0 && styles.codeButtonTextDisabled]}>
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingDot} />
            ) : (
              <Text style={styles.loginButtonText}>登录/注册</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.agreementSection}>
          <TouchableOpacity style={styles.agreementRow} onPress={handleAgreeToggle} activeOpacity={0.7}>
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
            <Text style={styles.agreementText}>
              我已阅读并同意领建
              <Text style={[styles.link, styles.linkBold]} onPress={() => handleOpenAgreement('user')}>
                用户协议
              </Text>
              和
              <Text style={[styles.link, styles.linkBold]} onPress={() => handleOpenAgreement('privacy')}>
                隐私政策
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  guestButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  guestButtonText: {
    fontSize: FontSize.sm,
    color: '#999999',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  header: {
    marginBottom: 48,
  },
  logoContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 64,
    height: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: '#1A1A2E',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: FontSize.base,
    color: '#999999',
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: '#F7F8FA',
    borderRadius: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  inputWrapperFocused: {
    borderColor: '#000000',
    backgroundColor: '#F5F5F5',
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: '#1A1A2E',
    paddingVertical: Platform.OS === 'android' ? 0 : 8,
  },
  codeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  codeButtonDisabled: {
    opacity: 0.5,
  },
  codeButtonText: {
    fontSize: FontSize.sm,
    color: '#000000',
    fontWeight: FontWeight.medium,
  },
  codeButtonTextDisabled: {
    color: '#C4C4C4',
  },
  loginButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: FontSize.base,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  loadingDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderTopColor: '#FFF',
  },
  agreementSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C4C4C4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  agreementText: {
    fontSize: FontSize.xs,
    color: '#999999',
    lineHeight: 20,
    flex: 1,
  },
  link: {
    color: '#000000',
  },
  linkBold: {
    fontWeight: 'bold',
  },
});

export default LoginScreen;
