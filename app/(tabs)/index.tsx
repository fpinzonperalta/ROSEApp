import React, { useState, useCallback } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../supabaseConfig";
import { avisar, confirmar } from "../../lib/dialogos";
import { color, espacio, fuente, radio, tactil, texto } from "../../lib/tema";
import { hora, pesos } from "../../lib/formato";
import { Segmentado } from "../../lib/Segmentado";

interface Topping {
  id: number;
  nombre: string;
  precio: number;
  esta_activo: string;
}

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  tiene_toppings?: boolean;
  esta_activo: string;
  primer_topping?: boolean;
}

interface VentaFormateada {
  id: number;
  total: number;
  created_at: string;
  nombre_producto: string;
  toppings_texto: string;
  metodo_pago: string;
  es_domicilio: boolean;
}

type MetodoPago = "Efectivo" | "Transferencia";

// Producto + toppings; si el producto tiene primer_topping se regala el topping
// más barato sin contar "helado". La base de datos recalcula el mismo total al guardar.
function calcularTotal(producto: Producto, toppings: Topping[]) {
  const costoToppings = toppings.reduce((acc, t) => acc + t.precio, 0);
  const paraDescuento = toppings.filter((t) => t.nombre.toLowerCase() !== "helado");
  const descuento =
    producto.primer_topping && paraDescuento.length > 0
      ? Math.min(...paraDescuento.map((t) => t.precio))
      : 0;
  return producto.precio + costoToppings - descuento;
}

export default function Ventas() {
  if (Platform.OS === "web") {
    return (
      <View style={styles.webContainer}>
        <Ionicons name="phone-portrait-outline" size={48} color={color.fresa} />
        <Text style={[texto.cuerpo, styles.webText]}>
          Las ventas se registran desde la app del celular.
        </Text>
      </View>
    );
  }
  return <PantallaVentas />;
}

// Componente aparte para que los hooks no queden después de un return condicional
function PantallaVentas() {
  const [ventasDelDia, setVentasDelDia] = useState<VentaFormateada[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [productoActual, setProductoActual] = useState<Producto | null>(null);
  const [toppingsSeleccionados, setToppingsSeleccionados] = useState<Topping[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [toppingsBD, setToppingsBD] = useState<Topping[]>([]);

  // ESTADOS DE VENTA
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("Efectivo");
  const [esDomicilio, setEsDomicilio] = useState<boolean>(false);
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      consultarVentasHoy();
      cargarProductos();
      cargarToppings();
      return () => {};
    }, []),
  );

  const consultarVentasHoy = async () => {
    const ahora = new Date();
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
    const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);

    const { data, error } = await supabase
      .from("ventas")
      .select(`
        id, total, created_at, metodo_pago, es_domicilio,
        productos ( nombre ),
        ventas_toppings ( toppings ( nombre ) )
      `)
      .gte("created_at", inicio.toISOString())
      .lte("created_at", fin.toISOString())
      .order("created_at", { ascending: false });

    if (!error && data) {
      const formateadas = data.map((v: any) => {
        let nombreP = "Sin nombre";
        if (Array.isArray(v.productos)) nombreP = v.productos[0]?.nombre;
        else if (v.productos) nombreP = v.productos.nombre;

        const toppingsArr = v.ventas_toppings
          ?.map((vt: any) =>
            Array.isArray(vt.toppings) ? vt.toppings[0]?.nombre : vt.toppings?.nombre,
          )
          .filter(Boolean);

        return {
          id: v.id,
          total: v.total,
          created_at: v.created_at,
          metodo_pago: v.metodo_pago || "Efectivo",
          es_domicilio: v.es_domicilio || false,
          nombre_producto: nombreP || "Producto no encontrado",
          toppings_texto: toppingsArr?.join(", ") || "",
        };
      });
      setVentasDelDia(formateadas);
    } else if (error) {
      avisar("Error", "No se pudieron cargar las ventas de hoy: " + error.message);
    }
  };

  const eliminarVenta = async (venta: VentaFormateada) => {
    const ok = await confirmar(
      "Anular venta",
      `¿Anular ${venta.nombre_producto} por ${pesos(venta.total)}?`,
      "Anular",
    );
    if (!ok) return;
    const { error } = await supabase.from("ventas").delete().eq("id", venta.id);
    if (error) return avisar("Error", "No se pudo anular la venta: " + error.message);
    setVentasDelDia((prev) => prev.filter((v) => v.id !== venta.id));
  };

  const cargarProductos = async () => {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("esta_activo", "si")
      .order("nombre", { ascending: true });
    if (error) avisar("Error", "No se pudo cargar el menú: " + error.message);
    else setProductos(data);
    setCargando(false);
  };

  const cargarToppings = async () => {
    const { data, error } = await supabase
      .from("toppings")
      .select("*")
      .eq("esta_activo", "si")
      .order("nombre", { ascending: true });
    if (!error) setToppingsBD(data);
  };

  const toggleTopping = (topping: Topping) => {
    if (toppingsSeleccionados.find((t) => t.id === topping.id)) {
      setToppingsSeleccionados(toppingsSeleccionados.filter((t) => t.id !== topping.id));
    } else {
      setToppingsSeleccionados([...toppingsSeleccionados, topping]);
    }
  };

  const seleccionarProducto = (prod: Producto) => {
    setProductoActual(prod);
    setToppingsSeleccionados([]);
    setMetodoPago("Efectivo");
    setEsDomicilio(false);
    setModalVisible(true);
  };

  const finalizarVenta = async (producto: Producto | null, toppings: Topping[]) => {
    // Evita registrar la misma venta dos veces por un doble toque
    if (!producto || guardando) return;
    setGuardando(true);
    try {
      await registrarVenta(producto, toppings);
    } finally {
      setGuardando(false);
    }
  };

  const registrarVenta = async (producto: Producto, toppings: Topping[]) => {
    const { data: ventaInsertada, error } = await supabase
      .from("ventas")
      .insert([
        {
          producto_id: producto.id,
          total: calcularTotal(producto, toppings),
          metodo_pago: metodoPago,
          es_domicilio: esDomicilio,
        },
      ])
      .select();

    if (error) return avisar("Error", error.message);

    if (toppings.length > 0) {
      const ventaId = ventaInsertada[0].id;
      const filasToppings = toppings.map((t) => ({
        venta_id: ventaId,
        topping_id: t.id,
        precio_al_momento: t.precio,
      }));
      const { error: errorToppings } = await supabase
        .from("ventas_toppings")
        .insert(filasToppings);
      if (errorToppings) {
        // Sin sus toppings la venta queda incompleta en el reporte: se deshace
        await supabase.from("ventas").delete().eq("id", ventaId);
        return avisar(
          "Error",
          "No se pudo registrar la venta, intenta de nuevo: " + errorToppings.message,
        );
      }
    }

    consultarVentasHoy();
    setModalVisible(false);
    setToppingsSeleccionados([]);
  };

  const totalDelDia = ventasDelDia.reduce((a, b) => a + b.total, 0);
  const toppingsDisponibles = toppingsBD.filter(
    (t) => !(productoActual?.nombre === "Malteadas" && t.nombre === "Helado"),
  );

  const encabezado = (
    <View>
      <View style={styles.header}>
        <Text style={texto.marca}>ROSE</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={texto.pequeno}>Hoy</Text>
          <Text style={[texto.numeros, styles.totalDia]}>{pesos(totalDelDia)}</Text>
          <Text style={texto.pequeno}>
            {ventasDelDia.length === 1 ? "1 venta" : `${ventasDelDia.length} ventas`}
          </Text>
        </View>
      </View>

      <View style={styles.vitrina}>
        {cargando ? (
          <Text style={texto.secundario}>Cargando menú…</Text>
        ) : (
          productos.map((prod) => (
            <Pressable
              key={prod.id}
              style={({ pressed }) => [styles.ficha, pressed && styles.fichaPresionada]}
              onPress={() => seleccionarProducto(prod)}
            >
              <Text style={styles.fichaNombre} numberOfLines={2}>
                {prod.nombre}
              </Text>
              <Text style={styles.fichaPrecio}>{pesos(prod.precio)}</Text>
            </Pressable>
          ))
        )}
      </View>

      <Text style={[texto.seccion, styles.tituloLista]}>Ventas de hoy</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={ventasDelDia}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={encabezado}
        contentContainerStyle={styles.contenido}
        ItemSeparatorComponent={() => <View style={styles.separador} />}
        ListEmptyComponent={
          <Text style={[texto.secundario, styles.vacio]}>
            Aún no hay ventas hoy. Toca un producto para registrar la primera.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.ventaFila}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ventaNombre}>{item.nombre_producto}</Text>
              {item.toppings_texto ? (
                <Text style={texto.secundario}>+ {item.toppings_texto}</Text>
              ) : null}
              <View style={styles.ventaMeta}>
                <Ionicons
                  name={item.metodo_pago === "Efectivo" ? "cash-outline" : "swap-horizontal"}
                  size={14}
                  color={color.ciruelaSuave}
                />
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
            <View style={styles.ventaDerecha}>
              <Text style={texto.monto}>{pesos(item.total)}</Text>
              <Pressable
                style={styles.btnAnular}
                hitSlop={8}
                onPress={() => eliminarVenta(item)}
              >
                <Text style={styles.btnAnularText}>Anular</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.velo}>
          <Pressable style={{ flex: 1 }} onPress={() => setModalVisible(false)} />
          {productoActual && (
            <View style={styles.hoja}>
              <View style={styles.hojaHeader}>
                <Text style={styles.hojaTitulo}>{productoActual.nombre}</Text>
                <Text style={[texto.numeros, styles.hojaPrecioBase]}>
                  {pesos(productoActual.precio)}
                </Text>
              </View>
              {productoActual.primer_topping && (
                <Text style={texto.pequeno}>Un topping va incluido: se regala el más barato.</Text>
              )}

              {productoActual.tiene_toppings && (
                <>
                  <Text style={styles.etiqueta}>Toppings</Text>
                  <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={styles.chips}>
                    {toppingsDisponibles.map((t) => {
                      const elegido = toppingsSeleccionados.some((sel) => sel.id === t.id);
                      return (
                        <Pressable
                          key={t.id}
                          style={[styles.chipTopping, elegido && styles.chipToppingActivo]}
                          onPress={() => toggleTopping(t)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: elegido }}
                        >
                          {elegido && <Ionicons name="checkmark" size={16} color={color.fresa} />}
                          <Text style={[styles.chipToppingTexto, elegido && { color: color.fresa }]}>
                            {t.nombre}
                          </Text>
                          <Text style={[texto.pequeno, texto.numeros]}>+{pesos(t.precio)}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              <Text style={styles.etiqueta}>Entrega</Text>
              <Segmentado
                opciones={[
                  { valor: false, texto: "Local", icono: "storefront-outline" },
                  { valor: true, texto: "Domicilio", icono: "bicycle" },
                ]}
                valor={esDomicilio}
                onCambio={setEsDomicilio}
              />

              <Text style={styles.etiqueta}>Pago</Text>
              <Segmentado
                opciones={[
                  { valor: "Efectivo" as MetodoPago, texto: "Efectivo", icono: "cash-outline" },
                  { valor: "Transferencia" as MetodoPago, texto: "Transferencia", icono: "swap-horizontal" },
                ]}
                valor={metodoPago}
                onCambio={setMetodoPago}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.btnCobrar,
                  pressed && { backgroundColor: color.fresaOscura },
                  guardando && { opacity: 0.6 },
                ]}
                disabled={guardando}
                onPress={() => finalizarVenta(productoActual, toppingsSeleccionados)}
              >
                <Text style={[texto.numeros, styles.btnCobrarText]}>
                  {guardando
                    ? "Guardando…"
                    : `Cobrar ${pesos(calcularTotal(productoActual, toppingsSeleccionados))}`}
                </Text>
              </Pressable>

              <Pressable style={styles.btnCancelar} onPress={() => setModalVisible(false)}>
                <Text style={texto.secundario}>Cancelar</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.leche },
  contenido: { padding: espacio.l, paddingBottom: espacio.xxl },
  webContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: espacio.xxl,
    backgroundColor: color.leche,
  },
  webText: { textAlign: "center", marginTop: espacio.l, color: color.ciruelaSuave },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: espacio.xl,
  },
  totalDia: { fontFamily: fuente.marca, fontSize: 24, color: color.ciruela },

  // La vitrina es el elemento protagonista: fichas grandes como sabores en exhibición
  vitrina: { flexDirection: "row", flexWrap: "wrap", gap: espacio.m },
  ficha: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 104,
    backgroundColor: color.fresaSuave,
    borderRadius: radio.l,
    padding: espacio.l,
    justifyContent: "space-between",
  },
  fichaPresionada: { backgroundColor: "#F1CCD9", transform: [{ scale: 0.98 }] },
  fichaNombre: { fontFamily: fuente.marcaMedia, fontSize: 19, color: color.ciruela },
  fichaPrecio: {
    fontFamily: fuente.marca,
    fontSize: 22,
    color: color.fresa,
    fontVariant: ["tabular-nums"],
  },

  tituloLista: { marginTop: espacio.xxl, marginBottom: espacio.s },
  vacio: { paddingVertical: espacio.xl },
  separador: { height: 1, backgroundColor: color.linea },
  ventaFila: { flexDirection: "row", paddingVertical: espacio.m, gap: espacio.m },
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
  ventaDerecha: { alignItems: "flex-end", justifyContent: "space-between" },
  btnAnular: { paddingVertical: espacio.xs, paddingHorizontal: espacio.s },
  btnAnularText: { color: color.error, fontSize: 14, fontWeight: "600" },

  velo: { flex: 1, backgroundColor: color.velo, justifyContent: "flex-end" },
  hoja: {
    backgroundColor: color.superficie,
    borderTopLeftRadius: radio.l,
    borderTopRightRadius: radio.l,
    padding: espacio.xl,
    paddingBottom: espacio.xxl,
    maxHeight: "90%",
  },
  hojaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  hojaTitulo: { fontFamily: fuente.marca, fontSize: 26, color: color.ciruela, flexShrink: 1 },
  hojaPrecioBase: { fontSize: 18, fontWeight: "600", color: color.ciruelaSuave },
  etiqueta: {
    fontSize: 14,
    fontWeight: "700",
    color: color.ciruela,
    marginTop: espacio.l,
    marginBottom: espacio.s,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: espacio.s },
  chipTopping: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.xs,
    minHeight: 44,
    paddingHorizontal: espacio.m,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: color.linea,
    backgroundColor: color.superficie,
  },
  chipToppingActivo: { borderColor: color.fresa, backgroundColor: color.fresaSuave },
  chipToppingTexto: { fontSize: 15, fontWeight: "600", color: color.ciruela },

  btnCobrar: {
    backgroundColor: color.fresa,
    minHeight: 56,
    borderRadius: radio.m,
    alignItems: "center",
    justifyContent: "center",
    marginTop: espacio.xl,
  },
  btnCobrarText: { color: color.superficie, fontSize: 18, fontWeight: "700" },
  btnCancelar: { minHeight: tactil, alignItems: "center", justifyContent: "center" },
});
