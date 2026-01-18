import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

// Componente nativo (solo funcionará en iOS/Android)
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

// Configuración de Supabase
import { supabase } from "../../supabaseConfig";

interface Venta {
  id: number;
  total: number;
  created_at: string;
  nombre_producto: string;
  toppings_texto: string;
}

export default function HistorialVentas() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [fechaFiltro, setFechaFiltro] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Consultar ventas cada vez que la pantalla gane el foco o cambie la fecha
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
        .select(
          `
          id, 
          total, 
          created_at,
          productos ( nombre ),
          ventas_toppings ( toppings ( nombre ) )
        `,
        )
        .gte("created_at", inicio.toISOString())
        .lte("created_at", fin.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const formateadas: Venta[] = data.map((v: any) => ({
          id: v.id,
          total: v.total,
          created_at: v.created_at,
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
    } finally {
      setCargando(false);
    }
  };

  const enviarReporteWhatsApp = () => {
    if (ventas.length === 0) {
      if (Platform.OS === "web") alert("No hay ventas para reportar.");
      else Alert.alert("Sin datos", "No hay ventas para reportar.");
      return;
    }

    const fechaFormateada = fechaFiltro.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const totalRecaudado = ventas
      .reduce((acc, v) => acc + v.total, 0)
      .toLocaleString();
    const insumos = obtenerResumenToppings();

    let mensaje = `*📊 REPORTE DE VENTAS - ${fechaFormateada}*\n\n`;
    mensaje += `*💰 Total Recaudado:* $${totalRecaudado}\n`;
    mensaje += `*🍦 Ventas realizadas:* ${ventas.length}\n\n`;
    mensaje += `*📦 RESUMEN DE INSUMOS:*\n`;
    insumos.forEach((item) => {
      mensaje += `- ${item.nombre}: x${item.cantidad}\n`;
    });
    mensaje += `\n_Generado por ROSE POS_`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    Linking.openURL(url);
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

  const onChangeFecha = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate) setFechaFiltro(selectedDate);
  };

  // --- COMPONENTE SELECTOR CONDICIONAL ---
  const renderDatePicker = () => {
    if (Platform.OS === "web") {
      return (
        <View style={styles.webPickerContainer}>
          <Text style={styles.webLabel}>Filtrar fecha:</Text>
          <input
            type="date"
            value={fechaFiltro.toISOString().split("T")[0]}
            onChange={(e) =>
              setFechaFiltro(new Date(e.target.value + "T00:00:00"))
            }
            style={{
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #007AFF",
              fontSize: "14px",
              color: "#007AFF",
            }}
          />
        </View>
      );
    }

    return (
      showDatePicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Seleccionar Fecha</Text>
            <DateTimePicker
              value={fechaFiltro}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={onChangeFecha}
              maximumDate={new Date()}
              locale="es-ES"
            />
            <TouchableOpacity
              style={styles.btnAceptar}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.btnAceptarTexto}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.titulo}>Reportería</Text>
            <Text style={styles.subtitulo}>
              {fechaFiltro.toLocaleDateString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
          </View>
          {Platform.OS !== "web" && (
            <TouchableOpacity
              style={styles.btnCalendario}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ fontSize: 24 }}>📅</Text>
            </TouchableOpacity>
          )}
        </View>

        {Platform.OS === "web" && renderDatePicker()}

        {cargando ? (
          <ActivityIndicator
            size="large"
            color="#007AFF"
            style={{ marginTop: 50 }}
          />
        ) : (
          <FlatList
            data={ventas}
            keyExtractor={(item) => item.id.toString()}
            ListHeaderComponent={
              <>
                <View style={styles.resumenCard}>
                  <Text style={styles.resumenLabel}>Total Recaudado</Text>
                  <Text style={styles.resumenMonto}>
                    $
                    {ventas
                      .reduce((acc, v) => acc + v.total, 0)
                      .toLocaleString("es-ES")}
                  </Text>
                  <TouchableOpacity
                    style={styles.btnWhatsApp}
                    onPress={enviarReporteWhatsApp}
                  >
                    <Text style={styles.btnWhatsAppTexto}>
                      🟢 Enviar Reporte WhatsApp
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Resumen de Insumos */}
                {obtenerResumenToppings().length > 0 && (
                  <View style={styles.insumosContainer}>
                    <Text style={styles.insumosTitulo}>Insumos Usados</Text>
                    <View style={styles.chipsContainer}>
                      {obtenerResumenToppings().map((item, i) => (
                        <View key={i} style={styles.chip}>
                          <Text style={styles.chipTexto}>
                            {item.nombre}{" "}
                            <Text style={styles.chipCantidad}>
                              x{item.cantidad}
                            </Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            }
            renderItem={({ item }) => (
              <View style={styles.ventaItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nombreProducto}>
                    {item.nombre_producto}
                  </Text>
                  <Text style={styles.textoToppings}>
                    {item.toppings_texto}
                  </Text>
                  <Text style={styles.hora}>
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                <Text style={styles.precioVenta}>
                  ${item.total.toLocaleString("es-ES")}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.listaVacia}>No hay ventas registradas.</Text>
            }
          />
        )}
        {Platform.OS !== "web" && renderDatePicker()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  titulo: { fontSize: 26, fontWeight: "bold", color: "#1A1A1A" },
  subtitulo: { fontSize: 14, color: "#666", textTransform: "capitalize" },
  btnCalendario: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 15,
    elevation: 3,
  },
  resumenCard: {
    backgroundColor: "#007AFF",
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  resumenLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  resumenMonto: { color: "white", fontSize: 32, fontWeight: "bold" },
  ventaItem: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },
  nombreProducto: { fontSize: 16, fontWeight: "bold" },
  textoToppings: { fontSize: 13, color: "#666" },
  hora: { fontSize: 11, color: "#AAA" },
  precioVenta: { fontSize: 17, fontWeight: "bold", color: "#28a745" },
  webPickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
  },
  webLabel: { fontWeight: "bold", color: "#555" },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  btnAceptar: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  btnAceptarTexto: { color: "white", textAlign: "center", fontWeight: "bold" },
  insumosContainer: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 20,
    marginBottom: 20,
  },
  insumosTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: "#555",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  chipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#F0F2F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  chipTexto: { fontSize: 12 },
  chipCantidad: { fontWeight: "bold", color: "#007AFF" },
  btnWhatsApp: {
    backgroundColor: "#25D366",
    padding: 10,
    borderRadius: 10,
    marginTop: 15,
  },
  btnWhatsAppTexto: { color: "white", fontWeight: "bold" },
  listaVacia: { textAlign: "center", marginTop: 50, color: "#999" },
  pickerContainer: {
    backgroundColor: "white",
    width: "90%",
    borderRadius: 20,
    padding: 20,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#333",
  },
  datePickerStyle: {
    height: 350,
    width: "100%",
    alignSelf: "center",
  },
});
