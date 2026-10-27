import { Slot } from "expo-router";
import { useFonts, Fredoka_500Medium, Fredoka_600SemiBold } from "@expo-google-fonts/fredoka";

export default function RootLayout() {
  const [cargada, error] = useFonts({ Fredoka_500Medium, Fredoka_600SemiBold });

  // Si la fuente falla, la app sigue con la fuente del sistema
  if (!cargada && !error) return null;
  return <Slot />;
}
