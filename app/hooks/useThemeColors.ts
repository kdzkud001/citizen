import { Colors } from "@/constants/Colors";

/** Kept as a hook so screens don't care that the app has one theme -- a
 * light theme later only needs to change this file and Colors.ts. */
export function useThemeColors() {
  return Colors;
}
