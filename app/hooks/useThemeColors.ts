import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";

export function useThemeColors() {
  const scheme = useColorScheme();
  return Colors[scheme === "dark" ? "dark" : "light"];
}
