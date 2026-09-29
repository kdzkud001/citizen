import { SymbolView } from "expo-symbols";
import type { ColorValue } from "react-native";

export interface IconSpec {
  /** SF Symbol name (iOS). */
  ios: string;
  /** Material Symbols name (Android, and web). */
  android: string;
}

export function Icon({ icon, color, size = 20 }: { icon: IconSpec; color: ColorValue; size?: number }) {
  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.android, web: icon.android } as never}
      tintColor={color}
      size={size}
    />
  );
}
