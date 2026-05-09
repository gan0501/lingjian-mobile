import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';

type Props = {
  visible: boolean;
  styles: Record<string, any>;
  onDismiss: () => void;
};

const CalcValidateDialog: React.FC<Props> = ({ visible, styles, onDismiss }) => {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.modalCard}>
        <Dialog.Title style={styles.modalTitle}>提示</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.pileModalDesc}>请至少填写完整一行对比桩型（桩型与规格）后再开始计算。</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={onDismiss}>
            <Text style={styles.actionPrimaryText}>我知道了</Text>
          </TouchableOpacity>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default CalcValidateDialog;
