/**
 * Kirimin icon set — Phosphor (duotone) behind the lucide names the screens already use.
 *
 * Why: lucide's thin 2px outlines read as generic clip-art next to the app's chunky
 * buttons and colour tiles. Phosphor duotone keeps a rounded outline and adds a soft
 * tinted fill in the same colour, which matches the friendly Gojek-like style.
 *
 * Glyph-style icons (arrows, chevrons, check, close, plus/minus) render in `bold`
 * so they stay crisp at small sizes; everything else renders as `duotone`.
 * Pass `weight` to override, e.g. `<Star weight="fill" />`.
 *
 * Icons are deep-imported one by one so Metro only bundles what we use.
 */
import React from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import type { IconProps as PhosphorProps, IconWeight } from 'phosphor-react-native';

import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { WarningCircle } from 'phosphor-react-native/src/icons/WarningCircle';
import { ArrowRight as PArrowRight } from 'phosphor-react-native/src/icons/ArrowRight';
import { ArrowUp as PArrowUp } from 'phosphor-react-native/src/icons/ArrowUp';
import { ArrowsDownUp } from 'phosphor-react-native/src/icons/ArrowsDownUp';
import { Money } from 'phosphor-react-native/src/icons/Money';
import { Bell as PBell } from 'phosphor-react-native/src/icons/Bell';
import { Motorcycle } from 'phosphor-react-native/src/icons/Motorcycle';
import { BookmarkSimple } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { Briefcase as PBriefcase } from 'phosphor-react-native/src/icons/Briefcase';
import { Camera as PCamera } from 'phosphor-react-native/src/icons/Camera';
import { Car as PCar } from 'phosphor-react-native/src/icons/Car';
import { Check as PCheck } from 'phosphor-react-native/src/icons/Check';
import { Checks } from 'phosphor-react-native/src/icons/Checks';
import { CheckCircle as PCheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Clock as PClock } from 'phosphor-react-native/src/icons/Clock';
import { Compass as PCompass } from 'phosphor-react-native/src/icons/Compass';
import { Copy as PCopy } from 'phosphor-react-native/src/icons/Copy';
import { ArrowBendUpLeft } from 'phosphor-react-native/src/icons/ArrowBendUpLeft';
import { ArrowBendUpRight } from 'phosphor-react-native/src/icons/ArrowBendUpRight';
import { CreditCard as PCreditCard } from 'phosphor-react-native/src/icons/CreditCard';
import { Crosshair as PCrosshair } from 'phosphor-react-native/src/icons/Crosshair';
import { ArrowSquareOut } from 'phosphor-react-native/src/icons/ArrowSquareOut';
import { Eye as PEye } from 'phosphor-react-native/src/icons/Eye';
import { EyeSlash } from 'phosphor-react-native/src/icons/EyeSlash';
import { FastForward as PFastForward } from 'phosphor-react-native/src/icons/FastForward';
import { FileText as PFileText } from 'phosphor-react-native/src/icons/FileText';
import { Flag as PFlag } from 'phosphor-react-native/src/icons/Flag';
import { Flask } from 'phosphor-react-native/src/icons/Flask';
import { GraduationCap as PGraduationCap } from 'phosphor-react-native/src/icons/GraduationCap';
import { Question } from 'phosphor-react-native/src/icons/Question';
import { House } from 'phosphor-react-native/src/icons/House';
import { Image as PImage } from 'phosphor-react-native/src/icons/Image';
import { Tray } from 'phosphor-react-native/src/icons/Tray';
import { Stack } from 'phosphor-react-native/src/icons/Stack';
import { ListBullets } from 'phosphor-react-native/src/icons/ListBullets';
import { Lock as PLock } from 'phosphor-react-native/src/icons/Lock';
import { SignOut } from 'phosphor-react-native/src/icons/SignOut';
import { Envelope } from 'phosphor-react-native/src/icons/Envelope';
import { MapPin as PMapPin } from 'phosphor-react-native/src/icons/MapPin';
import { ArrowsOut } from 'phosphor-react-native/src/icons/ArrowsOut';
import { ArrowsIn } from 'phosphor-react-native/src/icons/ArrowsIn';
import { ChatCircleDots } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { Minus as PMinus } from 'phosphor-react-native/src/icons/Minus';
import { Moon as PMoon } from 'phosphor-react-native/src/icons/Moon';
import { NavigationArrow } from 'phosphor-react-native/src/icons/NavigationArrow';
import { Package as PPackage } from 'phosphor-react-native/src/icons/Package';
import { Pause as PPause } from 'phosphor-react-native/src/icons/Pause';
import { PencilSimple } from 'phosphor-react-native/src/icons/PencilSimple';
import { Phone as PPhone } from 'phosphor-react-native/src/icons/Phone';
import { Play as PPlay } from 'phosphor-react-native/src/icons/Play';
import { Plus as PPlus } from 'phosphor-react-native/src/icons/Plus';
import { QrCode as PQrCode } from 'phosphor-react-native/src/icons/QrCode';
import { Broadcast } from 'phosphor-react-native/src/icons/Broadcast';
import { ArrowsClockwise } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { Repeat as PRepeat } from 'phosphor-react-native/src/icons/Repeat';
import { ArrowCounterClockwise } from 'phosphor-react-native/src/icons/ArrowCounterClockwise';
import { ArrowClockwise } from 'phosphor-react-native/src/icons/ArrowClockwise';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { PaperPlaneRight } from 'phosphor-react-native/src/icons/PaperPlaneRight';
import { ShieldCheck as PShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck';
import { SlidersHorizontal as PSliders } from 'phosphor-react-native/src/icons/SlidersHorizontal';
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle';
import { Star as PStar } from 'phosphor-react-native/src/icons/Star';
import { Sun as PSun } from 'phosphor-react-native/src/icons/Sun';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { User as PUser } from 'phosphor-react-native/src/icons/User';
import { UserGear } from 'phosphor-react-native/src/icons/UserGear';
import { Users as PUsers } from 'phosphor-react-native/src/icons/Users';
import { Wallet as PWallet } from 'phosphor-react-native/src/icons/Wallet';
import { X as PX } from 'phosphor-react-native/src/icons/X';
import { SealCheck } from 'phosphor-react-native/src/icons/SealCheck';
import { Storefront } from 'phosphor-react-native/src/icons/Storefront';
import { HandCoins as PHandCoins } from 'phosphor-react-native/src/icons/HandCoins';
import { MapTrifold } from 'phosphor-react-native/src/icons/MapTrifold';
import { PathIcon as PPath } from 'phosphor-react-native/src/icons/Path';

/** Props accepted by every icon — a superset of the lucide props used in the app. */
export interface IconProps {
  size?: number;
  color?: ColorValue;
  /** lucide prop; ignored (Phosphor weights carry the stroke). */
  strokeWidth?: number;
  /** lucide-style fill: any non-transparent value switches to the solid `fill` weight. */
  fill?: string;
  weight?: IconWeight;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export type IconComponent = React.ComponentType<IconProps>;

function make(Base: React.ComponentType<PhosphorProps>, defaultWeight: IconWeight, name: string): IconComponent {
  const Icon = ({ size = 24, color = 'currentColor', fill, weight, style, testID }: IconProps) => {
    const solid = fill && fill !== 'transparent' && fill !== 'none';
    return (
      <Base
        size={size}
        color={color as string}
        weight={weight ?? (solid ? 'fill' : defaultWeight)}
        duotoneOpacity={0.22}
        style={style as any}
        testID={testID}
      />
    );
  };
  Icon.displayName = name;
  return Icon;
}

const D: IconWeight = 'duotone';
const B: IconWeight = 'bold';

// --- Content icons (duotone) ---
export const AlertTriangle = make(Warning, D, 'AlertTriangle');
export const AlertCircle = make(WarningCircle, D, 'AlertCircle');
export const Banknote = make(Money, D, 'Banknote');
export const Bell = make(PBell, D, 'Bell');
export const Bike = make(Motorcycle, D, 'Bike');
export const Bookmark = make(BookmarkSimple, D, 'Bookmark');
export const Briefcase = make(PBriefcase, D, 'Briefcase');
export const Camera = make(PCamera, D, 'Camera');
export const Car = make(PCar, D, 'Car');
export const CheckCircle = make(PCheckCircle, D, 'CheckCircle');
export const CheckCircle2 = make(PCheckCircle, D, 'CheckCircle2');
export const Clock = make(PClock, D, 'Clock');
export const Compass = make(PCompass, D, 'Compass');
export const CreditCard = make(PCreditCard, D, 'CreditCard');
export const Crosshair = make(PCrosshair, D, 'Crosshair');
export const Eye = make(PEye, D, 'Eye');
export const EyeOff = make(EyeSlash, D, 'EyeOff');
export const FileText = make(PFileText, D, 'FileText');
export const Flag = make(PFlag, D, 'Flag');
export const FlaskConical = make(Flask, D, 'FlaskConical');
export const GraduationCap = make(PGraduationCap, D, 'GraduationCap');
export const HelpCircle = make(Question, D, 'HelpCircle');
export const Home = make(House, D, 'Home');
export const Image = make(PImage, D, 'Image');
export const Inbox = make(Tray, D, 'Inbox');
export const Layers = make(Stack, D, 'Layers');
export const Lock = make(PLock, D, 'Lock');
export const LogOut = make(SignOut, D, 'LogOut');
export const Mail = make(Envelope, D, 'Mail');
export const MapPin = make(PMapPin, D, 'MapPin');
export const MessageSquare = make(ChatCircleDots, D, 'MessageSquare');
export const Moon = make(PMoon, D, 'Moon');
export const Navigation = make(NavigationArrow, D, 'Navigation');
export const Package = make(PPackage, D, 'Package');
export const PackageCheck = make(SealCheck, D, 'PackageCheck');
export const PackageOpen = make(PPackage, D, 'PackageOpen');
export const Pencil = make(PencilSimple, D, 'Pencil');
export const Phone = make(PPhone, D, 'Phone');
export const QrCode = make(PQrCode, D, 'QrCode');
export const Radio = make(Broadcast, D, 'Radio');
export const Search = make(MagnifyingGlass, B, 'Search');
export const Send = make(PaperPlaneRight, D, 'Send');
export const ShieldCheck = make(PShieldCheck, D, 'ShieldCheck');
export const SlidersHorizontal = make(PSliders, D, 'SlidersHorizontal');
export const Sparkles = make(Sparkle, D, 'Sparkles');
export const Star = make(PStar, D, 'Star');
export const Sun = make(PSun, D, 'Sun');
export const Trash2 = make(Trash, D, 'Trash2');
export const User = make(PUser, D, 'User');
export const UserCog = make(UserGear, D, 'UserCog');
export const Users = make(PUsers, D, 'Users');
export const Wallet = make(PWallet, D, 'Wallet');
export const Store = make(Storefront, D, 'Store');
export const HandCoins = make(PHandCoins, D, 'HandCoins');
export const MapIcon = make(MapTrifold, D, 'MapIcon');
export const RoutePath = make(PPath, D, 'RoutePath');

// --- Glyph icons (bold) ---
export const ArrowRight = make(PArrowRight, B, 'ArrowRight');
export const ArrowUp = make(PArrowUp, B, 'ArrowUp');
export const ArrowUpDown = make(ArrowsDownUp, B, 'ArrowUpDown');
export const Check = make(PCheck, B, 'Check');
export const CheckCheck = make(Checks, B, 'CheckCheck');
export const ChevronLeft = make(CaretLeft, B, 'ChevronLeft');
export const ChevronRight = make(CaretRight, B, 'ChevronRight');
export const Copy = make(PCopy, D, 'Copy');
export const CornerUpLeft = make(ArrowBendUpLeft, B, 'CornerUpLeft');
export const CornerUpRight = make(ArrowBendUpRight, B, 'CornerUpRight');
export const ExternalLink = make(ArrowSquareOut, B, 'ExternalLink');
export const FastForward = make(PFastForward, D, 'FastForward');
export const List = make(ListBullets, B, 'List');
export const Maximize2 = make(ArrowsOut, B, 'Maximize2');
export const Minimize2 = make(ArrowsIn, B, 'Minimize2');
export const Minus = make(PMinus, B, 'Minus');
export const Pause = make(PPause, D, 'Pause');
export const Play = make(PPlay, D, 'Play');
export const Plus = make(PPlus, B, 'Plus');
export const RefreshCw = make(ArrowsClockwise, B, 'RefreshCw');
export const Repeat = make(PRepeat, B, 'Repeat');
export const RotateCcw = make(ArrowCounterClockwise, B, 'RotateCcw');
export const RotateCw = make(ArrowClockwise, B, 'RotateCw');
export const X = make(PX, B, 'X');
