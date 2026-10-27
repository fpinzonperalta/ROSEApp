import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { color, espacio, radio } from "./tema";

// Selector de opciones excluyentes (Local/Domicilio, Día/Mes...)
export function Segmentado<T>({
  opciones,
  valor,
  onCambio,
  style,
}: {
  opciones: { valor: T; texto: string; icono: keyof typeof Ionicons.glyphMap }[];
  valor: T;
  onCambio: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmentado, style]}>
      {opciones.map((op) => {
        const activo = op.valor === valor;
        return (
          <Pressable
            key={op.texto}
            style={[styles.segmento, activo && styles.segmentoActivo]}
            onPress={() => onCambio(op.valor)}
            accessibilityRole="radio"
            accessibilityState={{ selected: activo }}
          >
            <Ionicons
              name={op.icono}
              size={18}
              color={activo ? color.superficie : color.ciruelaSuave}
            />
            <Text style={[styles.segmentoTexto, activo && { color: color.superficie }]}>
              {op.texto}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentado: {
    flexDirection: "row",
    backgroundColor: color.leche,
    borderRadius: radio.m,
    padding: espacio.xs,
    gap: espacio.xs,
  },
  segmento: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: espacio.s,
    minHeight: 44,
    borderRadius: radio.s,
  },
  segmentoActivo: { backgroundColor: color.ciruela },
  segmentoTexto: { fontSize: 15, fontWeight: "600", color: color.ciruelaSuave },
});
