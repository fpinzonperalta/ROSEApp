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
import { Segmentado } from "../../lib/Segmentado";

// "YYYY-MM-DD" en hora local; toISOString() usa UTC y en la noche daría el día siguiente
const fechaLocalISO = (fecha: Date) => {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

type Periodo = "dia" | "mes";

// Inicio y fin del día o del mes de la fecha, en hora local
const rangoDe = (fecha: Date, periodo: Periodo): [Date, Date] =>
  periodo === "dia"
    ? [
        new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
        new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999),
      ]
    : [
        new Date(fecha.getFullYear(), fecha.getMonth(), 1),
        new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59, 999),
      ];

// Supabase devuelve máximo 1000 filas por consulta; un mes puede tener más
const FILAS_POR_PAGINA = 1000;

interface Venta {
  id: number;
  total: number;
  created_at: string;
  nombre_producto: string;
  toppings_texto: string;
  metodo_pago: string;
  es_domicilio: boolean;
}

interface ResumenDia {
  fecha: string; // YYYY-MM-DD local
  cantidad: number;
  total: number;
}

export default function HistorialVentas() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [fechaFiltro, setFechaFiltro] = useState(new Date());
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [cargando, setCargando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      consultarVentas(fechaFiltro, periodo);
      return () => {};
    }, [fechaFiltro, periodo]),
  );

  const consultarVentas = async (fecha: Date, p: Periodo) => {
    setCargando(true);
    const [inicio, fin] = rangoDe(fecha, p);

    try {
      let data: any[] = [];
      for (let desde = 0; ; desde += FILAS_POR_PAGINA) {
        const { data: pagina, error } = await supabase
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
          .order("created_at", { ascending: false })
          .range(desde, desde + FILAS_POR_PAGINA - 1);

        if (error) throw error;
        data = data.concat(pagina ?? []);
        if (!pagina || pagina.length < FILAS_POR_PAGINA) break;
      }

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

  // Solo para el reporte mensual: ventas agrupadas por día y por producto
  const porDia: ResumenDia[] = Object.values(
    ventas.reduce<Record<string, ResumenDia>>((acc, v) => {
      const fecha = fechaLocalISO(new Date(v.created_at));
      acc[fecha] ??= { fecha, cantidad: 0, total: 0 };
      acc[fecha].cantidad += 1;
      acc[fecha].total += v.total;
      return acc;
    }, {}),
  ).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const productosTop = Object.values(
    ventas.reduce<Record<string, { nombre: string; cantidad: number; total: number }>>((acc, v) => {
      acc[v.nombre_producto] ??= { nombre: v.nombre_producto, cantidad: 0, total: 0 };
      acc[v.nombre_producto].cantidad += 1;
      acc[v.nombre_producto].total += v.total;
      return acc;
    }, {}),
  ).sort((a, b) => b.cantidad - a.cantidad);

  const promedioDiario = porDia.length > 0 ? Math.round(totalRecaudado / porDia.length) : 0;

  const esMes = periodo === "mes";
  const hoy = new Date();
  const esMesActual =
    fechaFiltro.getFullYear() === hoy.getFullYear() && fechaFiltro.getMonth() === hoy.getMonth();

  const fechaLarga = esMes
    ? fechaFiltro.toLocaleDateString("es-CO", { month: "long", year: "numeric" })
    : fechaFiltro.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

  // "YYYY-MM-DD" -> Date local (new Date("YYYY-MM-DD") lo tomaría en UTC)
  const fechaDeISO = (iso: string) => new Date(iso + "T00:00:00");
  const nombreDia = (iso: string) =>
    fechaDeISO(iso).toLocaleDateString("es-CO", { weekday: "short", day: "numeric" });

  const cambiarMes = (delta: number) =>
    setFechaFiltro(new Date(fechaFiltro.getFullYear(), fechaFiltro.getMonth() + delta, 1));

  const verDia = (iso: string) => {
    setFechaFiltro(fechaDeISO(iso));
    setPeriodo("dia");
  };

  const enviarReporteWhatsApp = () => {
    if (ventas.length === 0) {
      avisar(
        "Sin ventas",
        esMes ? "No hay ventas en este mes para enviar." : "No hay ventas en esta fecha para enviar.",
      );
      return;
    }

    const fechaFormateada = esMes
      ? fechaLarga
      : fechaFiltro.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

    let mensaje = esMes
      ? `*📊 REPORTE MENSUAL - ${fechaFormateada}*\n\n`
      : `*📊 REPORTE DE VENTAS - ${fechaFormateada}*\n\n`;
    mensaje += `*💰 TOTAL RECAUDADO: ${pesos(totalRecaudado)}*\n`;
    mensaje += `--------------------------\n`;
    mensaje += `💵 Efectivo: ${pesos(totalEfectivo)}\n`;
    mensaje += `📱 Transferencia: ${pesos(totalTransferencia)}\n`;
    mensaje += `🛵 Domicilios: ${ventasDomi.length} (${pesos(totalDomi)})\n\n`;
    mensaje += `*🍦 Ventas totales:* ${ventas.length}\n`;
    if (esMes) {
      mensaje += `*📅 Días con ventas:* ${porDia.length} (promedio ${pesos(promedioDiario)} por día)\n\n`;
      mensaje += `*🏆 PRODUCTOS MÁS VENDIDOS:*\n`;
      productosTop.forEach((p) => {
        mensaje += `- ${p.nombre}: x${p.cantidad} (${pesos(p.total)})\n`;
      });
    }
    mensaje += `\n*📦 RESUMEN DE INSUMOS:*\n`;
    insumos.forEach((item) => {
      mensaje += `- ${item.nombre}: x${item.cantidad}\n`;
    });
    if (esMes) {
      mensaje += `\n*📆 VENTAS POR DÍA:*\n`;
      porDia.forEach((d) => {
        mensaje += `- ${nombreDia(d.fecha)}: ${d.cantidad} ventas, ${pesos(d.total)}\n`;
      });
    }
    mensaje += `\n_Generado por ROSE POS_`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    Linking.openURL(url);
  };

  const onChangeFecha = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate) setFechaFiltro(selectedDate);
  };

  const selectorFecha = esMes ? (
    <View style={styles.navMes}>
      <Pressable
        style={styles.btnFlecha}
        onPress={() => cambiarMes(-1)}
        accessibilityLabel="Mes anterior"
      >
        <Ionicons name="chevron-back" size={22} color={color.fresa} />
      </Pressable>
      <Pressable
        style={[styles.btnFlecha, esMesActual && { opacity: 0.3 }]}
        onPress={() => cambiarMes(1)}
        disabled={esMesActual}
        accessibilityLabel="Mes siguiente"
      >
        <Ionicons name="chevron-forward" size={22} color={color.fresa} />
      </Pressable>
    </View>
  ) : Platform.OS === "web" ? (
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
      <Segmentado
        opciones={[
          { valor: "dia" as Periodo, texto: "Día", icono: "today-outline" },
          { valor: "mes" as Periodo, texto: "Mes", icono: "calendar-outline" },
        ]}
        valor={periodo}
        onCambio={setPeriodo}
        style={styles.periodo}
      />

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
        <Text style={styles.btnWhatsAppTexto}>
          {esMes ? "Enviar reporte del mes" : "Enviar por WhatsApp"}
        </Text>
      </Pressable>

      {esMes && productosTop.length > 0 && (
        <>
          <Text style={[texto.seccion, styles.tituloSeccion]}>Productos más vendidos</Text>
          {productosTop.map((p) => (
            <View key={p.nombre} style={styles.filaProducto}>
              <Text style={styles.ventaNombre}>{p.nombre}</Text>
              <Text style={[texto.numeros, styles.chipCantidad]}>×{p.cantidad}</Text>
              <Text style={[texto.monto, styles.montoProducto]}>{pesos(p.total)}</Text>
            </View>
          ))}
        </>
      )}

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
        {esMes && porDia.length > 0 ? ` en ${porDia.length} días, promedio ${pesos(promedioDiario)} por día` : ""}
      </Text>
    </View>
  );

  const vacio = (
    <Text style={[texto.secundario, styles.vacio]}>
      {esMes
        ? "No hubo ventas este mes. Usa las flechas para ver otro mes."
        : "No hubo ventas este día. Elige otra fecha para ver su reporte."}
    </Text>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {cargando ? (
        <ActivityIndicator size="large" color={color.fresa} style={{ marginTop: 80 }} />
      ) : esMes ? (
        <FlatList
          data={porDia}
          keyExtractor={(item) => item.fecha}
          ListHeaderComponent={encabezado}
          contentContainerStyle={styles.contenido}
          ItemSeparatorComponent={() => <View style={styles.separador} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.ventaFila, pressed && { opacity: 0.6 }]}
              onPress={() => verDia(item.fecha)}
              accessibilityLabel={`Ver reporte del ${nombreDia(item.fecha)}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.ventaNombre, styles.fecha]}>{nombreDia(item.fecha)}</Text>
                <Text style={texto.pequeno}>
                  {item.cantidad === 1 ? "1 venta" : `${item.cantidad} ventas`}
                </Text>
              </View>
              <Text style={texto.monto}>{pesos(item.total)}</Text>
              <Ionicons name="chevron-forward" size={18} color={color.ciruelaSuave} />
            </Pressable>
          )}
          ListEmptyComponent={vacio}
        />
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
          ListEmptyComponent={vacio}
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
  periodo: {
    backgroundColor: color.superficie,
    borderWidth: 1,
    borderColor: color.linea,
    marginBottom: espacio.l,
  },
  navMes: { flexDirection: "row", gap: espacio.s },
  btnFlecha: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radio.m,
    backgroundColor: color.fresaSuave,
  },
  filaProducto: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
    paddingVertical: espacio.s,
  },
  montoProducto: { marginLeft: "auto" },
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
