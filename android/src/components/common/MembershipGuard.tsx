import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Crown, Lock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { useMembershipStore } from '@/stores/useMembershipStore';
import { useNavigation } from '@react-navigation/native';

interface MembershipGuardProps {
  children: React.ReactNode;
  feature: 'ai' | 'collaborate' | 'follow';
  projectId?: string;
  onBlocked?: () => void;
}

export const MembershipGuard: React.FC<MembershipGuardProps> = ({
  children, feature, projectId, onBlocked,
}) => {
  const navigation = useNavigation<any>();
  const { canUseAI, canCollaborate, canFollowMore, isExpired } = useMembershipStore();
  const [showModal, setShowModal] = React.useState(false);
  const [modalType, setModalType] = React.useState<'expired' | 'limit'>('expired');

  const checkAccess = (): boolean => {
    switch (feature) {
      case 'ai': return canUseAI();
      case 'collaborate': return canCollaborate();
      case 'follow': return canFollowMore();
      default: return true;
    }
  };

  const handlePress = () => {
    if (checkAccess()) return true;
    setModalType(isExpired() ? 'expired' : 'limit');
    setShowModal(true);
    onBlocked?.();
    return false;
  };

  const goToPayment = () => {
    setShowModal(false);
    navigation.navigate('MembershipPay');
  };

  return (
    <>
      {React.cloneElement(children as React.ReactElement, {
        onPress: () => {
          if (handlePress()) (children as React.ReactElement).props.onPress?.();
        },
      })}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconContainer}>
              {modalType === 'expired' ? <Crown size={40} color={Colors.warning || '#FF9800'} /> : <Lock size={40} color="#666" />}
            </View>
            <Text style={styles.modalTitle}>{modalType === 'expired' ? '会员已过期' : '跟进额度已满'}</Text>
            <Text style={styles.modalDesc}>
              {modalType === 'expired' ? '您的会员已过期，AI功能暂不可用，请续费后继续使用' : '非会员最多可跟进5个项目，升级会员享受无限跟进'}
            </Text>
            <TouchableOpacity style={styles.payButton} onPress={goToPayment}>
              <Text style={styles.payButtonText}>{modalType === 'expired' ? '立即续费' : '升级会员'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
              <Text style={styles.cancelButtonText}>暂不需要</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

export const AIExpiredBanner: React.FC<{ onRenew?: () => void }> = ({ onRenew }) => {
  const navigation = useNavigation<any>();
  const { isExpired } = useMembershipStore();
  if (!isExpired()) return null;
  const handleRenew = () => { onRenew ? onRenew() : navigation.navigate('MembershipPay'); };
  return (
    <View style={styles.banner}>
      <Crown size={16} color="#FF9800" />
      <Text style={styles.bannerText}>会员已过期，AI功能暂不可用</Text>
      <TouchableOpacity onPress={handleRenew}><Text style={styles.bannerAction}>续费</Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: Spacing.xl, width: '100%', maxWidth: 320, alignItems: 'center' },
  iconContainer: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,152,0,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  modalTitle: { color: '#333', fontSize: 18, fontWeight: '600', marginBottom: Spacing.sm },
  modalDesc: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg },
  payButton: { backgroundColor: '#FF9800', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { marginTop: Spacing.md, paddingVertical: 8 },
  cancelButtonText: { color: '#999', fontSize: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,152,0,0.12)', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: Spacing.xs },
  bannerText: { flex: 1, color: '#FF9800', fontSize: 13 },
  bannerAction: { color: '#FF9800', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
});

export default MembershipGuard;
