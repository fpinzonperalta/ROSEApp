import { Alert, Platform } from "react-native";

// Alert.alert no hace nada en react-native-web, así que en web usamos los diálogos del navegador.

export function avisar(titulo: string, mensaje: string) {
  if (Platform.OS === "web") window.alert(`${titulo}\n\n${mensaje}`);
  else Alert.alert(titulo, mensaje);
}

export function confirmar(
  titulo: string,
  mensaje: string,
  textoConfirmar: string,
): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      titulo,
      mensaje,
      [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        { text: textoConfirmar, style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
