import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  ArrowUpDown,
  ArrowLeftRight,
  Baby,
  Bell,
  BellRing,
  Building,
  Store,
  Calculator,
  Calendar,
  Camera,
  BarChart3,
  LineChart,
  PieChart,
  Check,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  LayoutDashboard,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  Fingerprint,
  HeartHandshake,
  HelpCircle,
  Home,
  Info,
  Sparkles,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  RotateCw,
  RefreshCw,
  GraduationCap,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
  LucideProps,
} from 'lucide-react';

export type TablerIcon = React.ComponentType<{
  size?: number | string;
  color?: string;
  stroke?: number | string;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  style?: React.CSSProperties;
}>;

function createIcon(LucideIcon: React.ComponentType<LucideProps>): TablerIcon {
  return function IconWrapper({ size = 20, stroke = 1.8, className, ...props }) {
    return <LucideIcon size={size} strokeWidth={stroke} className={className} {...props} />;
  };
}

export const IconAlertCircle = createIcon(AlertCircle);
export const IconAlertTriangle = createIcon(AlertTriangle);
export const IconArrowDown = createIcon(ArrowDown);
export const IconArrowDownLeft = createIcon(ArrowDownLeft);
export const IconArrowDownRight = createIcon(ArrowDownRight);
export const IconArrowUp = createIcon(ArrowUp);
export const IconArrowUpRight = createIcon(ArrowUpRight);
export const IconArrowsDownUp = createIcon(ArrowUpDown);
export const IconArrowsExchange = createIcon(ArrowLeftRight);
export const IconBabyCarriage = createIcon(Baby);
export const IconBell = createIcon(Bell);
export const IconBellRinging = createIcon(BellRing);
export const IconBuildingCommunity = createIcon(Building);
export const IconBuildingStore = createIcon(Store);
export const IconCalculator = createIcon(Calculator);
export const IconCalendar = createIcon(Calendar);
export const IconCamera = createIcon(Camera);
export const IconChartBar = createIcon(BarChart3);
export const IconChartLine = createIcon(LineChart);
export const IconChartPie = createIcon(PieChart);
export const IconCheck = createIcon(Check);
export const IconChevronDown = createIcon(ChevronDown);
export const IconChevronRight = createIcon(ChevronRight);
export const IconCircleCheck = createIcon(CheckCircle2);
export const IconClock = createIcon(Clock);
export const IconCoins = createIcon(Coins);
export const IconCreditCard = createIcon(CreditCard);
export const IconCurrencyDollar = createIcon(DollarSign);
export const IconDashboard = createIcon(LayoutDashboard);
export const IconDatabaseOff = createIcon(Database);
export const IconDownload = createIcon(Download);
export const IconEye = createIcon(Eye);
export const IconFileText = createIcon(FileText);
export const IconFilter = createIcon(Filter);
export const IconFingerprint = createIcon(Fingerprint);
export const IconHeartPlus = createIcon(HeartHandshake);
export const IconHelpCircle = createIcon(HelpCircle);
export const IconHome = createIcon(Home);
export const IconInfoCircle = createIcon(Info);
export const IconLeaf = createIcon(Sparkles);
export const IconLogout = createIcon(LogOut);
export const IconMenu2 = createIcon(Menu);
export const IconMessageCircle = createIcon(MessageCircle);
export const IconMoon = createIcon(Moon);
export const IconPencil = createIcon(Pencil);
export const IconPigMoney = createIcon(PiggyBank);
export const IconPlus = createIcon(Plus);
export const IconReceipt = createIcon(Receipt);
export const IconRefresh = createIcon(RotateCw);
export const IconReload = createIcon(RefreshCw);
export const IconSchool = createIcon(GraduationCap);
export const IconSearch = createIcon(Search);
export const IconSend = createIcon(Send);
export const IconSettings = createIcon(Settings);
export const IconShieldCheck = createIcon(ShieldCheck);
export const IconSun = createIcon(Sun);
export const IconTargetArrow = createIcon(Target);
export const IconTrendingDown = createIcon(TrendingDown);
export const IconTrendingUp = createIcon(TrendingUp);
export const IconUser = createIcon(User);
export const IconUserCircle = createIcon(UserCheck);
export const IconUserPlus = createIcon(UserPlus);
export const IconUsers = createIcon(Users);
export const IconWallet = createIcon(Wallet);
export const IconX = createIcon(X);
export const IconPanelLeftClose = createIcon(PanelLeftClose);
export const IconPanelLeftOpen = createIcon(PanelLeftOpen);
export const IconLayoutSidebarLeftCollapse = IconPanelLeftClose;
export const IconLayoutSidebarLeftExpand = IconPanelLeftOpen;
