/**
 * 地图底部搜索栏组件（日间版）- V2
 *
 * 白色胶囊形搜索栏，位于地图底部。
 * 支持：文本输入 + 语音输入（按住说话）+ 新建按钮。
 */
import React, { FC, useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, Keyboard, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Mic, Plus } from 'lucide-react-native';
import { DayColors } from '@/constants';
import { useVoiceRecognition } from '@/hooks';
import { ActivityIndicator } from 'react-native';

interface MapSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  showAddButton?: boolean;
  onAddPress?: () => void;
  enableVoice?: boolean;
  onRequireLogin?: () => void;
  absolute?: boolean;
  avoidKeyboard?: boolean;
}

export const MapSearchBar: FC<MapSearchBarProps> = memo(({
  value,
  onChangeText,
  onSubmit,
  placeholder = '搜索...',
  showAddButton = false,
  onAddPress,
  enableVoice = false,
  onRequireLogin,
  absolute = true,
  avoidKeyboard = true,
}) => {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);

  const {
    isListening,
    transcript,
    uiHint,
    isPreparing,
    isSupported: voiceSupported,
    requireLogin,
    startListening,
    stopListening,
    setRequireLogin,
    clearTranscript,
  } = useVoiceRecognition();

  useEffect(() => {
    const showListener = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const height = e.endCoordinates?.height || 0;
      if (height > 0) {
        setKeyboardVisible(true);
        Animated.timing(keyboardHeightAnim, {
          toValue: height,
          duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
          useNativeDriver: true,
        }).start();
      }
    });
    const hideListener = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      setKeyboardVisible(false);
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [keyboardHeightAnim]);

  const waveAnim1 = useRef(new Animated.Value(0.3)).current;
  const waveAnim2 = useRef(new Animated.Value(0.5)).current;
  const waveAnim3 = useRef(new Animated.Value(0.7)).current;
  const waveAnim4 = useRef(new Animated.Value(0.4)).current;
  const waveAnim5 = useRef(new Animated.Value(0.6)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      const mkWave = (anim: Animated.Value, dur: number) =>
        Animated.loop(Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.2, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
      const anims = [mkWave(waveAnim1, 300), mkWave(waveAnim2, 400), mkWave(waveAnim3, 350), mkWave(waveAnim4, 450), mkWave(waveAnim5, 380)];
      anims.forEach(a => a.start());

      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.02, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      return () => {
        anims.forEach(a => a.stop());
        scaleAnim.setValue(1);
      };
    }
  }, [isListening]);

  useEffect(() => {
    if (transcript && enableVoice) {
      onChangeText(transcript);
      setVoiceMode(false);
    }
  }, [transcript, enableVoice, onChangeText]);

  useEffect(() => {
    if (requireLogin) {
      setRequireLogin(false);
      onRequireLogin?.();
    }
  }, [requireLogin, setRequireLogin, onRequireLogin]);

  const showVoiceButton = enableVoice && voiceSupported && !value.trim();

  const handleSubmit = useCallback(() => {
    if (value.trim()) {
      onSubmit();
      Keyboard.dismiss();
      if (enableVoice) clearTranscript();
    }
  }, [value, onSubmit, enableVoice, clearTranscript]);

  const handleVoiceIconPress = async () => {
    if (isPreparing) return;
    setVoiceMode(true);
  };

  const handleBigButtonPressIn = async () => {
    if (isPreparing || isListening) return;
    try {
      await startListening();
    } catch (err) {
      console.error('[Voice] startListening error:', err);
    }
  };

  const handleBigButtonPressOut = async () => {
    try {
      await stopListening();
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('3307') || errMsg.includes('语音太短')) {
        console.log('[Voice] 语音太短，请重试');
      } else {
        console.error('[Voice] stopListening error:', err);
      }
    }
    if (!isListening && !isPreparing) {
      setVoiceMode(false);
    }
  };

  const hasContent = value.trim().length > 0;

  const androidKeyboardFix = Platform.OS === 'android' && avoidKeyboard
    ? { transform: [{ translateY: Animated.multiply(keyboardHeightAnim, -1) }] }
    : null;

  const renderVoiceModeButton = () => (
    <Animated.View style={[styles.voiceModeContainer, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handleBigButtonPressIn}
        onPressOut={handleBigButtonPressOut}
        style={styles.voiceButtonOuter}
      >
        <View style={styles.voiceButtonInner}>
          <View style={styles.voiceButtonHighlight} />
          {isPreparing ? (
            <View style={styles.voiceButtonContent}>
              <ActivityIndicator size="small" color="#fff" style={styles.loadingIndicator} />
              <Text style={styles.voiceButtonText}>正在准备...</Text>
            </View>
          ) : isListening ? (
            <View style={styles.voiceButtonContent}>
              <View style={styles.waveContainer}>
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim1 }] }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim2 }] }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim3 }] }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim4 }] }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim5 }] }]} />
              </View>
              <Text style={styles.voiceButtonText}>松开识别</Text>
            </View>
          ) : (
            <View style={styles.voiceButtonContent}>
              <Mic size={18} color="#fff" />
              <Text style={styles.voiceButtonText}>按住说话</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderNormalInput = () => (
    <View style={styles.searchBarWrapper}>
      <View style={styles.searchBar}>
        {showAddButton && (
          <TouchableOpacity style={styles.addBtn} onPress={onAddPress} activeOpacity={0.7}>
            <Plus color={DayColors.surface} size={18} strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={uiHint || placeholder}
          placeholderTextColor={DayColors.textTertiary}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          onPressIn={() => {
            if (Platform.OS === 'android') inputRef.current?.focus();
          }}
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            !hasContent && styles.sendBtnIdle,
          ]}
          onPress={hasContent ? handleSubmit : (showVoiceButton ? handleVoiceIconPress : undefined)}
          activeOpacity={0.7}
        >
          {isPreparing ? (
            <ActivityIndicator size="small" color={DayColors.surface} />
          ) : hasContent ? (
            <ArrowRight color={DayColors.surface} size={18} strokeWidth={2.5} />
          ) : (
            <Mic color={DayColors.surface} size={18} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Animated.View style={[
      absolute ? styles.containerAbsolute : styles.containerRelative,
      { paddingBottom: absolute ? insets.bottom + 15 : 0 },
      androidKeyboardFix,
    ]}>
      {voiceMode ? renderVoiceModeButton() : renderNormalInput()}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  containerAbsolute: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  containerRelative: {
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  searchBarWrapper: {
    backgroundColor: DayColors.surface,
    borderRadius: 26,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.6)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DayColors.surface,
    borderRadius: 22,
    paddingVertical: 3,
    paddingHorizontal: 4,
    gap: 6,
    height: 44,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DayColors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: DayColors.text,
    paddingVertical: 0,
    paddingHorizontal: 6,
    height: 36,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#B20000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B20000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnIdle: {
    backgroundColor: '#B20000',
    shadowOpacity: 0.35,
    elevation: 4,
  },
  voiceModeContainer: {
    width: '100%',
    borderRadius: 25,
    overflow: 'hidden',
  },
  voiceButtonOuter: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  voiceButtonInner: {
    width: '100%',
    height: 42,
    backgroundColor: DayColors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
  },
  voiceButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  voiceButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  voiceButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingIndicator: {
    marginRight: 8,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 16,
    gap: 2,
    marginRight: 8,
  },
  waveBar: {
    width: 3,
    height: 12,
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
});

export default MapSearchBar;
