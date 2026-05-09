import React, { FC, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Mic, Send } from 'lucide-react-native';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';

interface BottomSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  avoidKeyboard?: boolean;
  absolute?: boolean;
  showUploadButton?: boolean;
  onUpload?: () => void;
  hasAttachment?: boolean;
  enableVoice?: boolean;
  showCorrectButton?: boolean;
  onCorrect?: () => void;
  onRequireLogin?: () => void;
  showAddButton?: boolean;
  onAddPress?: () => void;
  variant?: 'dark' | 'light';
}

export const BottomSearchBar: FC<BottomSearchBarProps> = ({
  value,
  onChangeText,
  onSubmit,
  placeholder = '搜索...',
  avoidKeyboard = false,
  absolute = true,
  showUploadButton = false,
  onUpload,
  hasAttachment = false,
  enableVoice = false,
  showCorrectButton = false,
  onCorrect,
  onRequireLogin,
  showAddButton = false,
  onAddPress,
  variant = 'dark',
}) => {
  const isLight = variant === 'light';
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showDismissOverlay, setShowDismissOverlay] = useState(false);
  const inputRef = useRef<TextInput>(null);
  
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
    if (requireLogin) {
      setRequireLogin(false);
      if (onRequireLogin) {
        onRequireLogin();
      } else {
        Alert.alert('提示', '请先登录后再使用语音功能');
      }
    }
  }, [requireLogin, setRequireLogin, onRequireLogin]);

  const waveAnim1 = useRef(new Animated.Value(0.3)).current;
  const waveAnim2 = useRef(new Animated.Value(0.5)).current;
  const waveAnim3 = useRef(new Animated.Value(0.7)).current;
  const waveAnim4 = useRef(new Animated.Value(0.4)).current;
  const waveAnim5 = useRef(new Animated.Value(0.6)).current;
  
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      const createWaveAnimation = (anim: Animated.Value, duration: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2,
              duration: duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        );
      };

      const animations = [
        createWaveAnimation(waveAnim1, 300),
        createWaveAnimation(waveAnim2, 400),
        createWaveAnimation(waveAnim3, 350),
        createWaveAnimation(waveAnim4, 450),
        createWaveAnimation(waveAnim5, 380),
      ];

      animations.forEach(anim => anim.start());

      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.02,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      return () => {
        animations.forEach(anim => anim.stop());
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

  const showVoiceButton = enableVoice && voiceSupported && !value.trim();

  const effectivePlaceholder = uiHint || placeholder;
  
  const handleActionButtonPress = () => {
    if (isPreparing) return;
    if (showVoiceButton) {
      setVoiceMode(true);
    } else {
      onSubmit();
      Keyboard.dismiss();
      if (enableVoice) {
        clearTranscript();
      }
    }
  };

  const handleVoicePressIn = async () => {
    if (isPreparing || isListening) return;
    try {
      await startListening();
    } catch (err) {
      console.error('[Voice] startListening error:', err);
    }
  };

  const handleVoicePressOut = async () => {
    try {
      await stopListening();
    } catch (err) {
      console.error('[Voice] stopListening error:', err);
    }
    if (!isListening && !isPreparing) {
      setVoiceMode(false);
    }
  };

  const enableDismissOverlay = false;
  const enableKeyboardHandling = avoidKeyboard || enableDismissOverlay || (Platform.OS === 'android' && absolute);

  useEffect(() => {
    if (!enableKeyboardHandling) return;

    let showOverlayTimer: ReturnType<typeof setTimeout> | null = null;
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates?.height || 0);

      if (enableDismissOverlay) {
        if (showOverlayTimer) clearTimeout(showOverlayTimer);
        showOverlayTimer = setTimeout(() => {
          setShowDismissOverlay(true);
        }, 160);
      }
    });
    const keyboardHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      setShowDismissOverlay(false);

      if (showOverlayTimer) {
        clearTimeout(showOverlayTimer);
        showOverlayTimer = null;
      }
    });

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
      if (showOverlayTimer) {
        clearTimeout(showOverlayTimer);
        showOverlayTimer = null;
      }
    };
  }, [enableDismissOverlay, enableKeyboardHandling]);

  const useKAV = avoidKeyboard;

  const androidKeyboardFix =
    Platform.OS === 'android' &&
    avoidKeyboard &&
    isKeyboardVisible &&
    keyboardHeight > 0
      ? { transform: [{ translateY: -keyboardHeight }] }
      : null;

  const renderVoiceModeButton = () => (
    <Animated.View style={[styles.voiceModeContainer, isLight && styles.voiceModeContainerLight, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handleVoicePressIn}
        onPressOut={handleVoicePressOut}
        style={[styles.voiceButtonOuter, isLight && styles.voiceButtonOuterLight]}
      >
        {isLight ? (
          <View style={styles.voiceButtonInnerLight}>
            {isPreparing ? (
              <View style={styles.voiceButtonContent}>
                <ActivityIndicator size="small" color="#fff" style={styles.loadingIndicator} />
                <Text style={[styles.voiceButtonText, styles.voiceButtonTextLight]}>正在准备...</Text>
              </View>
            ) : isListening ? (
              <View style={styles.voiceButtonContent}>
                <View style={styles.waveContainer}>
                  <Animated.View style={[styles.waveBar, styles.waveBarLight, { transform: [{ scaleY: waveAnim1 }] }]} />
                  <Animated.View style={[styles.waveBar, styles.waveBarLight, { transform: [{ scaleY: waveAnim2 }] }]} />
                  <Animated.View style={[styles.waveBar, styles.waveBarLight, { transform: [{ scaleY: waveAnim3 }] }]} />
                  <Animated.View style={[styles.waveBar, styles.waveBarLight, { transform: [{ scaleY: waveAnim4 }] }]} />
                  <Animated.View style={[styles.waveBar, styles.waveBarLight, { transform: [{ scaleY: waveAnim5 }] }]} />
                </View>
                <Text style={[styles.voiceButtonText, styles.voiceButtonTextLight]}>松开识别</Text>
              </View>
            ) : (
              <View style={styles.voiceButtonContent}>
                <Mic size={18} color="#fff" />
                <Text style={[styles.voiceButtonText, styles.voiceButtonTextLight]}>按住说话</Text>
              </View>
            )}
          </View>
        ) : (
          <LinearGradient
            colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)', 'rgba(0,0,0,0.85)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.voiceButtonGradient}
          >
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
          </LinearGradient>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  const renderNormalInput = () => (
    <View style={[
      styles.searchInputContainer,
      isLight && styles.searchInputContainerLight
    ]}>
      {isLight ? (
        <View style={styles.glassBackgroundLight}>
          <View style={styles.inputContent}>
            {(showAddButton || showUploadButton) && (
              <TouchableOpacity
                style={[styles.addButton, styles.addButtonLight]}
                onPress={showAddButton ? onAddPress : onUpload}
              >
                <Text style={[styles.addButtonIcon, styles.addButtonIconLight]}>+</Text>
                {showUploadButton && hasAttachment && <View style={styles.attachmentDot} />}
              </TouchableOpacity>
            )}
            
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, styles.searchInputLight]}
              value={value}
              onChangeText={onChangeText}
              placeholder={effectivePlaceholder}
              placeholderTextColor="rgba(0,0,0,0.4)"
              onSubmitEditing={onSubmit}
            onFocus={() => {
              if (enableDismissOverlay) {
                setShowDismissOverlay(true);
              }
            }}
            onPressIn={() => {
              if (Platform.OS === 'android') {
                inputRef.current?.focus();
              }
            }}
          />
          
          <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation?.();
                (showCorrectButton ? onCorrect : handleActionButtonPress)?.();
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {showCorrectButton ? (
                <View style={[styles.correctButton, styles.correctButtonLight]}>
                  <Text style={styles.correctButtonText}>纠错</Text>
                </View>
              ) : isPreparing ? (
                <View style={[styles.searchButton, styles.searchButtonLight]}>
                  <ActivityIndicator size="small" color="#333" />
                </View>
              ) : showVoiceButton ? (
                <View style={[styles.searchButton, styles.voiceIconButton]}>
                  <Mic size={18} color="#fff" />
                </View>
              ) : (
                <View style={[styles.searchButton, styles.sendIconButton]}>
                  <Send size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={['rgba(153,153,153,0.90)', 'rgba(0,0,0,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.glassBackground}
        >
          <View style={styles.topHighlight} />
          
          <View style={styles.inputContent}>
            {(showAddButton || showUploadButton) && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={showAddButton ? onAddPress : onUpload}
              >
                <Text style={styles.addButtonIcon}>+</Text>
                {showUploadButton && hasAttachment && <View style={styles.attachmentDot} />}
              </TouchableOpacity>
            )}
            
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={value}
              onChangeText={onChangeText}
              placeholder={effectivePlaceholder}
              placeholderTextColor="rgba(255,255,255,0.5)"
              onSubmitEditing={onSubmit}
              onFocus={() => {
                if (enableDismissOverlay) {
                  setShowDismissOverlay(true);
                }
              }}
              onPressIn={() => {
                if (Platform.OS === 'android') {
                  inputRef.current?.focus();
                }
              }}
            />
            
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation?.();
                (showCorrectButton ? onCorrect : handleActionButtonPress)?.();
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {showCorrectButton ? (
                <View style={styles.correctButton}>
                  <Text style={styles.correctButtonText}>纠错</Text>
                </View>
              ) : isPreparing ? (
                <View style={styles.searchButton}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : showVoiceButton ? (
                <View style={[styles.searchButton, styles.voiceIconButton]}>
                  <Mic size={18} color="#fff" />
                </View>
              ) : (
                <View style={[styles.searchButton, styles.sendIconButton]}>
                  <Send size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      )}
    </View>
  );

  const renderContent = () => voiceMode ? renderVoiceModeButton() : renderNormalInput();

  return (
    <>
      {enableDismissOverlay && showDismissOverlay && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.keyboardOverlay} />
        </TouchableWithoutFeedback>
      )}
      {useKAV ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          style={[
            styles.container,
            isLight && styles.containerLight,
            absolute && styles.containerAbsolute,
            absolute && { paddingBottom: insets.bottom + 10 },
            androidKeyboardFix,
          ]}
        >
          {renderContent()}
        </KeyboardAvoidingView>
      ) : (
        <View
          style={[
            styles.container,
            isLight && styles.containerLight,
            absolute && styles.containerAbsolute,
            absolute && { paddingBottom: insets.bottom + 10 },
            androidKeyboardFix,
          ]}
        >
          {renderContent()}
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    zIndex: 100,
  },
  containerLight: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  containerAbsolute: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  keyboardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    backgroundColor: 'transparent',
  },
  searchInputContainer: {
    flexDirection: 'row',
    borderRadius: 25,
    height: 50,
    padding: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.6)',
    overflow: 'hidden',
  },
  glassBackground: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  inputContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  searchInput: {
    flex: 1,
    paddingLeft: 8,
    paddingRight: 15,
    paddingVertical: 0,
    height: 42,
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'transparent',
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceIconButton: {
    backgroundColor: '#B20000',
  },
  sendIconButton: {
    backgroundColor: '#B20000',
  },
  correctButton: {
    paddingHorizontal: 16,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#B20000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  correctButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  addButtonIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
    marginTop: -2,
  },
  attachmentDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
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
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  voiceButtonGradient: {
    width: '100%',
    height: 42,
    borderRadius: 25,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
  // Light variant styles
  searchInputContainerLight: {
    borderColor: 'rgba(200,200,200,0.6)',
    backgroundColor: '#fff',
  },
  glassBackgroundLight: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  searchInputLight: {
    color: '#333',
  },
  addButtonLight: {
    backgroundColor: '#333',
  },
  addButtonIconLight: {
    color: '#fff',
  },
  searchButtonLight: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  correctButtonLight: {
    backgroundColor: '#B20000',
  },
  // Voice mode light styles
  voiceModeContainerLight: {
    backgroundColor: 'transparent',
  },
  voiceButtonOuterLight: {
    borderColor: 'rgba(0,0,0,0.15)',
    backgroundColor: '#fff',
  },
  voiceButtonInnerLight: {
    width: '100%',
    height: 42,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
  },
  voiceButtonTextLight: {
    color: '#fff',
  },
  waveBarLight: {
    backgroundColor: '#fff',
  },
});
