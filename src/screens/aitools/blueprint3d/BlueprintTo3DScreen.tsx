import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BlueprintTo3D'>;

const BlueprintTo3DScreen: React.FC<Props> = ({ navigation }) => {
  React.useEffect(() => {
    navigation.replace('BlueprintCamera');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#E67E22" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
});

export default BlueprintTo3DScreen;
