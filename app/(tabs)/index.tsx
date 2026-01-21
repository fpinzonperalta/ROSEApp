import React, { useEffect, useState, useCallback } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform, // Importante para detectar la plataforma
} from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../supabaseConfig";

interface Topping {
  id: number;
  nombre: string;
  precio: number;
  esta_activo:string;
}

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  tiene_toppings?: boolean;
  esta_activo:string;
}

export default function App() {
  const [ventasDelDia, setVentasDelDia] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [productoActual, setProductoActual] = useState<Producto | null>(null);
  const [toppingsSeleccionados, setToppingsSeleccionados] = useState<Topping[]>(
    [],
  );
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [toppingsBD, setToppingsBD] = useState<Topping[]>([]);

  // 1. VALIDACIÓN DE PLATAFORMA (Solo Móvil)
  if (Platform.OS === "web") {
    return (
      <View style={styles.webContainer}>
        <Text style={{ fontSize: 50 }}>📱</Text>
        <Text style={styles.webText}>
          Esta sección de ventas solo está disponible en la aplicación móvil.
        </Text>
      </View>
    );
  }

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
    const inicio = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
      0,
      0,
      0,
    );
    const fin = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
      23,
      59,
      59,
    );

    const { data, error } = await supabase
      .from("ventas")
      .select(
        `
        id, total, created_at,
        productos ( nombre ),
        ventas_toppings ( toppings ( nombre ) )
      `,
      )
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
            Array.isArray(vt.toppings)
              ? vt.toppings[0]?.nombre
              : vt.toppings?.nombre,
          )
          .filter(Boolean);

        return {
          id: v.id,
          total: v.total,
          created_at: v.created_at,
          nombre_producto: nombreP || "Producto no encontrado",
          toppings_texto: toppingsArr?.join(", ") || "",
        };
      });
      setVentasDelDia(formateadas);
    }
  };

  const eliminarVenta = async (id: number) => {
    Alert.alert("Anular Venta", "¿Estás seguro de eliminar esta venta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("ventas").delete().eq("id", id);
          if (!error) {
            setVentasDelDia((prev) => prev.filter((v) => v.id !== id));
          }
        },
      },
    ]);
  };

  const cargarProductos = async () => {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq('esta_activo','si')
      .order("nombre", { ascending: true });
    if (!error) setProductos(data);
    setCargando(false);
  };

  const cargarToppings = async () => {
    const { data, error } = await supabase
      .from("toppings")
      .select("*")
      .eq('esta_activo','si')
      .order("nombre", { ascending: true });
    if (!error) setToppingsBD(data);
  };

  const toggleTopping = (topping: Topping) => {
    if (toppingsSeleccionados.find((t) => t.id === topping.id)) {
      setToppingsSeleccionados(
        toppingsSeleccionados.filter((t) => t.id !== topping.id),
      );
    } else {
      setToppingsSeleccionados([...toppingsSeleccionados, topping]);
    }
  };

  const seleccionarProducto = (prod: Producto) => {
    if (prod.tiene_toppings === true) {
      setProductoActual(prod);
      setToppingsSeleccionados([]);
      setModalVisible(true);
    } else {
      finalizarVenta(prod, []);
    }
  };

  const finalizarVenta = async (producto: any, toppings: any[]) => {
    const costoToppingsBase = toppings.reduce((acc, t) => acc + t.precio, 0);
    const toppingsParaDescuento = toppings.filter(
      (t) => t.nombre.toLowerCase() !== "helado",
    );
    const precioMasCaro =
      toppingsParaDescuento.length > 0
        ? Math.max(...toppingsParaDescuento.map((t) => t.precio))
        : 0;
    const esFresas = producto.nombre.toLowerCase().includes("fresas");
    const descuento =
      esFresas && toppingsParaDescuento.length > 0 ? precioMasCaro : 0;
    const totalFinal = producto.precio + costoToppingsBase - descuento;

    const { data: ventaInsertada, error } = await supabase
      .from("ventas")
      .insert([{ producto_id: producto.id, total: totalFinal }])
      .select();

    if (error) return Alert.alert("Error", error.message);

    if (toppings.length > 0) {
      const filasToppings = toppings.map((t) => ({
        venta_id: ventaInsertada[0].id,
        topping_id: t.id,
        precio_al_momento: t.precio,
      }));
      await supabase.from("ventas_toppings").insert(filasToppings);
    }

    consultarVentasHoy(); // Refrescamos lista
    setModalVisible(false);
    setToppingsSeleccionados([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ROSE</Text>
      <Text style={styles.subtitle}>Selecciona un Producto</Text>

      <View style={styles.menu}>
        {cargando ? (
          <Text>Cargando menú...</Text>
        ) : (
          productos.map((prod) => (
            <TouchableOpacity
              key={prod.id}
              style={styles.button}
              onPress={() => seleccionarProducto(prod)}
            >
              <Text style={styles.buttonText}>{prod.nombre}</Text>
              <Text style={styles.priceText}>
                ${prod.precio.toLocaleString("es-ES")}
              </Text>
              <Text style={styles.stockText}>Stock: {prod.stock}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <Text style={styles.subtitle}>
        Ventas de Hoy ($
        {ventasDelDia.reduce((a, b) => a + b.total, 0).toLocaleString("es-ES")})
      </Text>

      <FlatList
        data={ventasDelDia}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.ventaItem}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold", fontSize: 16 }}>
                {item.nombre_producto}
              </Text>
              {item.toppings_texto ? (
                <Text style={{ color: "#666", fontSize: 13 }}>
                  + {item.toppings_texto}
                </Text>
              ) : null}
              <Text style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
              <Text
                style={{ fontWeight: "bold", color: "#28a745", fontSize: 16 }}
              >
                ${item.total.toLocaleString("es-ES")}
              </Text>
              <TouchableOpacity
                style={styles.btnAnular}
                onPress={() => eliminarVenta(item.id)}
              >
                <Text style={styles.btnAnularText}>Anular</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Añadir Toppings a {productoActual?.nombre}
            </Text>
            <ScrollView>
              {toppingsBD
                .filter(
                  (t) =>
                    !(
                      productoActual?.nombre === "Malteadas" &&
                      t.nombre === "Helado"
                    ),
                )
                .map((t) => {
                  const isSelected = toppingsSeleccionados.find(
                    (sel) => sel.id === t.id,
                  );
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.toppingItem,
                        isSelected && styles.toppingSelected,
                      ]}
                      onPress={() => toggleTopping(t)}
                    >
                      <Text>
                        {t.nombre} (+${t.precio})
                      </Text>
                      <Text>{isSelected ? "✅" : "⬜"}</Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
            <TouchableOpacity
              style={styles.btnConfirmar}
              onPress={() =>
                finalizarVenta(productoActual, toppingsSeleccionados)
              }
            >
              <Text style={styles.btnConfirmarText}>Confirmar Venta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
    paddingTop: 60,
  },
  webContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    backgroundColor: "#fff",
  },
  webText: {
    textAlign: "center",
    fontSize: 18,
    color: "#666",
    marginTop: 20,
    fontWeight: "500",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 10,
  },
  menu: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  button: {
    backgroundColor: "#007AFF",
    width: "48%",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 14 },
  priceText: { color: "#e0e0e0", fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  toppingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  toppingSelected: { backgroundColor: "#e3f2fd" },
  btnConfirmar: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  btnConfirmarText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  btnAnular: {
    backgroundColor: "#FFF1F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#FFA39E",
  },
  btnAnularText: {
    color: "#F5222D",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  ventaItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 3,
  },
  stockText: { fontSize: 10, color: "#e0e0e0", marginTop: 2 },
});
