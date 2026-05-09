import React, { FC } from 'react';
import { BottomActionBar } from '@/components/common';
import { Cpu, Palette, Settings, BookOpen } from 'lucide-react-native';

interface BidWriterFooterProps {
  mainButtonText: string;
  onMainButtonPress: () => void;
  mainButtonDisabled?: boolean;
  mainButtonLoading?: boolean;
  onModelPress: () => void;
  onStylePress: () => void;
  onConfigPress: () => void;
  onKnowledgePress: () => void;
}

export const BidWriterFooter: FC<BidWriterFooterProps> = ({
  mainButtonText,
  onMainButtonPress,
  mainButtonDisabled = false,
  mainButtonLoading = false,
  onModelPress,
  onStylePress,
  onConfigPress,
  onKnowledgePress,
}) => {
  return (
    <BottomActionBar
      mainButtonText={mainButtonText}
      onMainButtonPress={onMainButtonPress}
      mainButtonDisabled={mainButtonDisabled}
      mainButtonLoading={mainButtonLoading}
      customTabs={[
        { icon: <Cpu size={16} color="rgba(255,255,255,0.6)" />, label: '模型', onPress: onModelPress },
        { icon: <Palette size={16} color="rgba(255,255,255,0.6)" />, label: '样式', onPress: onStylePress },
        { icon: <Settings size={16} color="rgba(255,255,255,0.6)" />, label: '配置', onPress: onConfigPress },
        { icon: <BookOpen size={16} color="rgba(255,255,255,0.6)" />, label: '知识', onPress: onKnowledgePress },
      ]}
    />
  );
};
