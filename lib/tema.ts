import { StyleSheet, TextStyle } from "react-native";

// Sistema visual "Vitrina ROSE". Todos los colores, tamaños y espacios salen de aquí.

export const color = {
  fresa: "#C8365F", // acción principal y marca
  fresaOscura: "#A62A4D", // fresa presionada
  fresaSuave: "#F8E4EB", // fondo de la vitrina y selecciones
  leche: "#FCF7F9", // fondo de pantalla
  superficie: "#FFFFFF",
  ciruela: "#2E1A2B", // texto principal
  ciruelaSuave: "#6B5867", // texto secundario
  linea: "#EADDE4", // separadores y bordes
  barquillo: "#E3A857", // domicilio
  barquilloSuave: "#FBF0DF",
  barquilloTexto: "#7E5310",
  pistacho: "#4F9A6A", // dinero cobrado
  pistachoTexto: "#2F6E47",
  pistachoSuave: "#E5F1E9",
  error: "#B9382A",
  errorSuave: "#FBEAE7",
  whatsapp: "#128C7E",
  velo: "rgba(46, 26, 43, 0.45)",
};

export const fuente = {
  marca: "Fredoka_600SemiBold",
  marcaMedia: "Fredoka_500Medium",
};

export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

// Jerarquía: chips < controles < hojas y fichas de la vitrina
export const radio = { s: 8, m: 12, l: 20 };

// Alto mínimo cómodo para tocar con el dedo
export const tactil = 48;

const numeros: TextStyle = { fontVariant: ["tabular-nums"] };

export const texto = StyleSheet.create({
  marca: { fontFamily: fuente.marca, fontSize: 32, color: color.fresa, letterSpacing: 1 },
  titulo: { fontSize: 22, fontWeight: "700", color: color.ciruela },
  seccion: { fontSize: 17, fontWeight: "700", color: color.ciruela },
  cuerpo: { fontSize: 16, color: color.ciruela },
  secundario: { fontSize: 14, color: color.ciruelaSuave },
  pequeno: { fontSize: 13, color: color.ciruelaSuave },
  monto: { ...numeros, fontSize: 16, fontWeight: "700", color: color.pistachoTexto },
  montoGrande: { ...numeros, fontFamily: fuente.marca, fontSize: 44, color: color.ciruela },
  numeros,
});
