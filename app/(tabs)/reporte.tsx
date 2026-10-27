import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { supabase } from "../../supabaseConfig";
import { avisar } from "../../lib/dialogos";
import { color, espacio, radio, tactil, texto } from "../../lib/tema";
import { hora, pesos } from "../../lib/formato";

// "YYYY-MM-DD" en hora local; toISOString() usa UTC y en la noche daría el día siguiente
const fechaLocalISO = (fecha: Date) => {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

interface Venta {
  id: number;
  total: number;
  created_at: string;
  nombre_producto: string;
  toppings_texto: string;
  metodo_pago: string;
  es_domicilio: boolean;
}

export default function HistorialVentas() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [fechaFiltro, setFechaFiltro] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [cargando, setCargando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      consultarVentas(fechaFiltro);
      return () => {};
    }, [fechaFiltro]),
  );

  const consultarVentas = async (fecha: Date) => {
    setCargando(true);
    const inicio = new Date(fecha);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fecha);
    fin.setHours(23, 59, 59, 999);

    try {
      const { data, error } = await supabase
        .from("ventas")
        .select(`
          id,
          total,
          created_at,
          metodo_pago,
          es_domicilio,
          productos ( nombre ),
          ventas_toppings ( toppings ( nombre ) )
        `)
        .gte("created_at", inicio.toISOString())
        .lte("created_at", fin.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const formateadas: Venta[] = data.map((v: any) => ({
          id: v.id,
          total: v.total,
          created_at: v.created_at,
          metodo_pago: v.metodo_pago || "Efectivo",
          es_domicilio: v.es_domicilio || false,
          nombre_producto: v.productos?.nombre || "Producto no encontrado",
          toppings_texto:
            v.ventas_toppings
              ?.map((vt: any) => vt.toppings?.nombre)
              .filter(Boolean)
              .join(", ") || "",
        }));
        setVentas(formateadas);
      }
    } catch (error: any) {
      console.error("Error cargando ventas:", error.message);
      avisar("Error", "No se pudieron cargar las ventas: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  const obtenerResumenToppings = () => {
    const conteo: { [key: string]: number } = {};
    ventas.forEach((venta) => {
      if (venta.toppings_texto) {
        venta.toppings_texto.split(", ").forEach((topping) => {
          const nombre = topping.trim();
          conteo[nombre] = (conteo[nombre] || 0) + 1;
        });
      }
    });
    return Object.entries(conteo)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  };

  const insumos = obtenerResumenToppings();
  const totalRecaudado = ventas.reduce((acc, v) => acc + v.total, 0);
  const totalEfectivo = ventas
    .filter((v) => v.metodo_pago === "Efectivo")
    .reduce((acc, v) => acc + v.total, 0);
  const totalTransferencia = ventas
    .filter((v) => v.metodo_pago === "Transferencia")
    .reduce((acc, v) => acc + v.total, 0);
  const ventasDomi = ventas.filter((v) => v.es_domicilio);
  const totalDomi = ventasDomi.reduce((acc, v) => acc + v.total, 0);

  const fechaLarga = fechaFiltro.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const enviarReporteWhatsApp = () => {
    if (ventas.length === 0) {
      avisar("Sin ventas", "No hay ventas en esta fecha para enviar.");
      return;
    }

    const fechaFormateada = fechaFiltro.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    let mensaje = `*📊 REPORTE DE VENTAS - ${fechaFormateada}*\n\n`;
    mensaje += `*💰 TOTAL RECAUDADO: ${pesos(totalRecaudado)}*\n`;
    mensaje += `--------------------------\n`;
    mensaje += `💵 Efectivo: ${pesos(totalEfectivo)}\n`;
    mensaje += `📱 Transferencia: ${pesos(totalTransferencia)}\n`;
    mensaje += `🛵 Domicilios: ${ventasDomi.length} (${pesos(totalDomi)})\n\n`;
    mensaje += `*🍦 Ventas totales:* ${ventas.length}\n\n`;
    mensaje += `*📦 RESUMEN DE INSUMOS:*\n`;
    insumos.forEach((item) => {
      mensaje += `- ${item.nombre}: x${item.cantidad}\n`;
    });
    mensaje += `\n_Generado por ROSE POS_`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    Linking.openURL(url);
  };

  const onChangeFecha = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate) setFechaFiltro(selectedDate);
  };

  const selectorFecha =
    Platform.OS === "web" ? (
      <input
        type="date"
        aria-label="Fecha del reporte"
        value={fechaLocalISO(fechaFiltro)}
        max={fechaLocalISO(new Date())}
        onChange={(e) => {
          // Al borrar la fecha el valor llega vacío y crearía una fecha inválida
          if (e.target.value) setFechaFiltro(new Date(e.target.value + "T00:00:00"));
        }}
        style={{
          font: "inherit",
          fontSize: 15,
          padding: "10px 12px",
          borderRadius: radio.m,
          border: `1px solid ${color.linea}`,
          color: color.ciruela,
          backgroundColor: color.superficie,
        }}
      />
    ) : (
      <Pressable
        style={styles.btnFecha}
        onPress={() => setShowDatePicker(true)}
        accessibilityLabel="Cambiar fecha"
      >
        <Ionicons name="calendar-outline" size={18} color={color.fresa} />
        <Text style={styles.btnFechaTexto}>Cambiar fecha</Text>
      </Pressable>
    );

  const encabezado = (
    <View>
      <View style={styles.header}>
        <View style={{ flexShrink: 1 }}>
          <Text style={texto.titulo}>Reporte</Text>
          <Text style={[texto.secundario, styles.fecha]}>{fechaLarga}</Text>
        </View>
        {selectorFecha}
      </View>

      <Text style={texto.secundario}>Total recaudado</Text>
      <Text style={texto.montoGrande}>{pesos(totalRecaudado)}</Text>

      <View style={styles.desglose}>
        <Dato icono="cash-outline" etiqueta="Efectivo" valor={pesos(totalEfectivo)} />
        <Dato icono="swap-horizontal" etiqueta="Transferencia" valor={pesos(totalTransferencia)} />
        <Dato
          icono="bicycle"
          etiqueta={ventasDomi.length === 1 ? "1 domicilio" : `${ventasDomi.length} domicilios`}
          valor={pesos(totalDomi)}
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.btnWhatsApp, pressed && { opacity: 0.85 }]}
        onPress={enviarReporteWhatsApp}
      >
        <Ionicons name="logo-whatsapp" size={20} color={color.superficie} />
        <Text style={styles.btnWhatsAppTexto}>Enviar por WhatsApp</Text>
      </Pressable>

      {insumos.length > 0 && (
        <>
          <Text style={[texto.seccion, styles.tituloSeccion]}>Toppings usados</Text>
          <View style={styles.chips}>
            {insumos.map((item) => (
              <View key={item.nombre} style={styles.chip}>
                <Text style={styles.chipTexto}>{item.nombre}</Text>
                <Text style={[texto.numeros, styles.chipCantidad]}>×{item.cantidad}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={[texto.seccion, styles.tituloSeccion]}>
        {ventas.length === 1 ? "1 venta" : `${ventas.length} ventas`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {cargando ? (
        <ActivityIndicator size="large" color={color.fresa} style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={ventas}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={encabezado}
          contentContainerStyle={styles.contenido}
          ItemSeparatorComponent={() => <View style={styles.separador} />}
          renderItem={({ item }) => (
            <View style={styles.ventaFila}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ventaNombre}>{item.nombre_producto}</Text>
                {item.toppings_texto ? (
                  <Text style={texto.secundario}>+ {item.toppings_texto}</Text>
                ) : null}
                <View style={styles.ventaMeta}>
                  <Text style={texto.pequeno}>{item.metodo_pago}</Text>
                  {item.es_domicilio && (
                    <View style={styles.chipDomi}>
                      <Ionicons name="bicycle" size={13} color={color.barquilloTexto} />
                      <Text style={styles.chipDomiTexto}>Domicilio</Text>
                    </View>
                  )}
                  <Text style={texto.pequeno}>{hora(item.created_at)}</Text>
                </View>
              </View>
              <Text style={texto.monto}>{pesos(item.total)}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[texto.secundario, styles.vacio]}>
              No hubo ventas este día. Elige otra fecha para ver su reporte.
            </Text>
          }
        />
      )}

      {Platform.OS !== "web" && showDatePicker && (
        <View style={styles.velo}>
          <View style={styles.pickerContainer}>
            <Text style={[texto.seccion, { textAlign: "center" }]}>Elige la fecha</Text>
            <DateTimePicker
              value={fechaFiltro}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={onChangeFecha}
              maximumDate={new Date()}
              locale="es-ES"
            />
            <Pressable style={styles.btnAceptar} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.btnAceptarTexto}>Ver reporte</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function Dato({
  icono,
  etiqueta,
  valor,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  valor: string;
}) {
  return (
    <View style={styles.dato}>
      <View style={styles.datoEtiqueta}>
        <Ionicons name={icono} size={14} color={color.ciruelaSuave} />
        <Text style={texto.pequeno}>{etiqueta}</Text>
      </View>
      <Text style={[texto.numeros, styles.datoValor]}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: color.leche },
  contenido: {
    padding: espacio.l,
    paddingBottom: espacio.xxl,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: espacio.m,
    marginBottom: espacio.xl,
  },
  fecha: { textTransform: "capitalize" },
  btnFecha: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.s,
    minHeight: 44,
    paddingHorizontal: espacio.m,
    borderRadius: radio.m,
    backgroundColor: color.fresaSuave,
  },
  btnFechaTexto: { color: color.fresa, fontWeight: "600", fontSize: 15 },

  desglose: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: espacio.l,
    marginTop: espacio.m,
    paddingVertical: espacio.m,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.linea,
  },
  dato: { flexGrow: 1, minWidth: 96 },
  datoEtiqueta: { flexDirection: "row", alignItems: "center", gap: espacio.xs },
  datoValor: { fontSize: 17, fontWeight: "700", color: color.ciruela, marginTop: 2 },

  btnWhatsApp: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: espacio.s,
    minHeight: tactil,
    borderRadius: radio.m,
    backgroundColor: color.whatsapp,
    marginTop: espacio.l,
  },
  btnWhatsAppTexto: { color: color.superficie, fontWeight: "700", fontSize: 16 },

  tituloSeccion: { marginTop: espacio.xl, marginBottom: espacio.s },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: espacio.s },
  chip: {
    flexDirection: "row",
    gap: espacio.xs,
    backgroundColor: color.superficie,
    borderWidth: 1,
    borderColor: color.linea,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radio.s,
  },
  chipTexto: { fontSize: 14, color: color.ciruela },
  chipCantidad: { fontSize: 14, fontWeight: "700", color: color.fresa },

  separador: { height: 1, backgroundColor: color.linea },
  ventaFila: { flexDirection: "row", alignItems: "center", paddingVertical: espacio.m, gap: espacio.m },
  ventaNombre: { fontSize: 16, fontWeight: "600", color: color.ciruela },
  ventaMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: espacio.s,
    marginTop: espacio.xs,
  },
  chipDomi: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.xs,
    backgroundColor: color.barquilloSuave,
    paddingHorizontal: espacio.s,
    paddingVertical: 2,
    borderRadius: radio.s,
  },
  chipDomiTexto: { fontSize: 13, fontWeight: "600", color: color.barquilloTexto },
  vacio: { paddingVertical: espacio.xl },

  velo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.velo,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerContainer: {
    backgroundColor: color.superficie,
    width: "90%",
    borderRadius: radio.l,
    padding: espacio.xl,
  },
  btnAceptar: {
    backgroundColor: color.fresa,
    minHeight: tactil,
    justifyContent: "center",
    borderRadius: radio.m,
    marginTop: espacio.m,
  },
  btnAceptarTexto: { color: color.superficie, textAlign: "center", fontWeight: "700", fontSize: 16 },
});
