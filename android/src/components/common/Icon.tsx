import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import {
  Map,
  Building2,
  Factory,
  Database,
  Bot,
  MessageSquare,
  User,
  Search,
  Plus,
  Sparkles,
  Hexagon,
  Bell,
  Settings,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  AlertCircle,
  Info,
  Star,
  Heart,
  Share2,
  Send,
  CornerUpRight,
  Download,
  Upload,
  Edit,
  Trash2,
  Copy,
  Filter,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Mail,
  Phone,
  Calendar,
  Clock,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Folder,
  Home,
  Layers,
  Navigation,
  Target,
  Zap,
  TrendingUp,
  Award,
  Gift,
  Crown,
  Shield,
  Users,
  Building,
  Briefcase,
  Package,
  Truck,
  Wallet,
  CreditCard,
  QrCode,
  Scan,
  BookOpen,
  DollarSign,
  Maximize2,
  BarChart2,
  Box,
  Camera,
  BoxSelect,
  Droplets,
  FlipHorizontal,
  SwitchCamera,
  type LucideIcon,
} from 'lucide-react-native';

export type IconName =
  | 'map'
  | 'building'
  | 'factory'
  | 'database'
  | 'bot'
  | 'message'
  | 'user'
  | 'search'
  | 'plus'
  | 'sparkles'
  | 'hexagon'
  | 'bell'
  | 'settings'
  | 'chevronRight'
  | 'chevronLeft'
  | 'close'
  | 'check'
  | 'alert'
  | 'info'
  | 'star'
  | 'heart'
  | 'share'
  | 'send'
  | 'cornerUpRight'
  | 'download'
  | 'upload'
  | 'edit'
  | 'trash'
  | 'copy'
  | 'filter'
  | 'refresh'
  | 'loader'
  | 'eye'
  | 'eyeOff'
  | 'lock'
  | 'unlock'
  | 'mail'
  | 'phone'
  | 'calendar'
  | 'clock'
  | 'file'
  | 'fileText'
  | 'image'
  | 'video'
  | 'music'
  | 'folder'
  | 'home'
  | 'layers'
  | 'navigation'
  | 'target'
  | 'zap'
  | 'trending'
  | 'award'
  | 'gift'
  | 'crown'
  | 'shield'
  | 'users'
  | 'enterprise'
  | 'briefcase'
  | 'package'
  | 'truck'
  | 'wallet'
  | 'card'
  | 'qrcode'
  | 'scan'
  | 'book'
  | 'dollarSign'
  | 'maximize'
  | 'barChart'
  | 'box'
  | 'camera'
  | 'cube'
  | 'droplets'
  | 'flip'
  | 'switchCamera';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: ViewStyle;
}

const iconMap: Record<IconName, LucideIcon> = {
  map: Map,
  building: Building2,
  factory: Factory,
  database: Database,
  bot: Bot,
  message: MessageSquare,
  user: User,
  search: Search,
  plus: Plus,
  sparkles: Sparkles,
  hexagon: Hexagon,
  bell: Bell,
  settings: Settings,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  close: X,
  check: Check,
  alert: AlertCircle,
  info: Info,
  star: Star,
  heart: Heart,
  share: Share2,
  send: Send,
  cornerUpRight: CornerUpRight,
  download: Download,
  upload: Upload,
  edit: Edit,
  trash: Trash2,
  copy: Copy,
  filter: Filter,
  refresh: RefreshCw,
  loader: Loader2,
  eye: Eye,
  eyeOff: EyeOff,
  lock: Lock,
  unlock: Unlock,
  mail: Mail,
  phone: Phone,
  calendar: Calendar,
  clock: Clock,
  file: FileText,
  fileText: FileText,
  image: ImageIcon,
  video: Video,
  music: Music,
  folder: Folder,
  home: Home,
  layers: Layers,
  navigation: Navigation,
  target: Target,
  zap: Zap,
  trending: TrendingUp,
  award: Award,
  gift: Gift,
  crown: Crown,
  shield: Shield,
  users: Users,
  enterprise: Building,
  briefcase: Briefcase,
  package: Package,
  truck: Truck,
  wallet: Wallet,
  card: CreditCard,
  qrcode: QrCode,
  scan: Scan,
  book: BookOpen,
  dollarSign: DollarSign,
  maximize: Maximize2,
  barChart: BarChart2,
  box: Box,
  camera: Camera,
  cube: BoxSelect,
  droplets: Droplets,
  flip: FlipHorizontal,
  switchCamera: SwitchCamera,
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#F8FAFC',
  strokeWidth = 2,
  style,
}) => {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    return null;
  }

  return (
    <IconComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      style={style}
    />
  );
};

export const IconWrapper: React.FC<{
  name: IconName;
  size?: number;
  color?: string;
  backgroundColor?: string;
  iconSize?: number;
  style?: ViewStyle;
}> = ({
  name,
  size = 44,
  color = '#F8FAFC',
  backgroundColor,
  iconSize,
  style,
}) => {
  const actualIconSize = iconSize || size * 0.55;

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          borderRadius: size / 3,
          backgroundColor: backgroundColor || `${color}15`,
        },
        style,
      ]}
    >
      <Icon name={name} size={actualIconSize} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
