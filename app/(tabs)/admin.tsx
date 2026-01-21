import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { supabase } from "../../supabaseConfig";
import { Ionicons } from "@expo/vector-icons";

const ITEMS_PER_PAGE = 10;

const CeldaPrecio = ({ item, tablaActual, onSave }) => {
  const [valorTemp, setValorTemp] = useState(item.precio.toString());

  useEffect(() => {
    setValorTemp(item.precio.toString());
  }, [item.id, item.precio]);

  return (
    <TextInput
      style={styles.priceInput}
      value={valorTemp}
      onChangeText={setValorTemp}
      keyboardType="numeric"
      onBlur={() => {
        const num = parseInt(valorTemp);
        if (!isNaN(num) && num !== item.precio) {
          onSave(tablaActual, item.id, "precio", num);
        }
      }}
    />
  );
};

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState("productos");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [data, setData] = useState([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);

  // Estados de Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Estados para creación
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [tieneToppings, setTieneToppings] = useState(true);

  useEffect(() => {
    // 1. Verificar sesión actual al cargar
    const checkInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      if (session) fetchData();
      setAuthLoading(false);
    };

    checkInitialSession();

    // 2. Escuchar cambios de forma robusta
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);

        if (event === "SIGNED_IN" && newSession) {
          fetchData();
        }

        if (event === "SIGNED_OUT") {
          setData([]);
          setPage(0);
          setEmail(""); // Limpiar campos de login
          setPassword("");
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [activeTab]);

  useEffect(() => {
    if (session) fetchData();
  }, [activeTab, page]);

  async function handleLogin() {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert("Error", "Credenciales incorrectas");
    } else if (data?.session) {
      // ESTA ES LA CLAVE: Actualizar el estado local para que React re-renderice
      setSession(data.session);
      setPage(0);
      // Opcional: Si quieres cargar los datos de inmediato
      fetchData();
    }
    setLoading(false);
  }

  async function fetchData() {
    setLoading(true);
    const from = page * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const {
      data: result,
      error,
      count,
    } = await supabase
      .from(activeTab)
      .select("*", { count: "exact" })
      .order("nombre")
      .range(from, to);

    if (!error) {
      setData(result);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }

  async function updateItem(nombreTabla, id, campo, valor) {
    const { error } = await supabase
      .from(nombreTabla)
      .update({ [campo]: valor })
      .eq("id", id);
    if (!error && activeTab === nombreTabla) {
      setData((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)),
      );
    }
  }

  async function confirmarEliminar(id, nombreItem, esta_activo) {
    var msg = esta_activo == "si" ? "desactivar" : "activar";
    const mensaje = `¿Estás seguro de que deseas ${msg} "${nombreItem}"?`;
    // Soporte para Web
    if (Platform.OS === "web") {
      const confirmado = window.confirm(mensaje);
      if (confirmado) activarODesactivar(id, esta_activo);
    } else {
      // Soporte para Móvil
      Alert.alert("Confirmar eliminación", mensaje, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => activarODesactivar(id, esta_activo),
        },
      ]);
    }
  }

  async function activarODesactivar(id, esta_activo) {
    setLoading(true);
    var data = esta_activo == "si" ? "no" : "si";
    const { error } = await supabase
      .from(activeTab)
      .update({ esta_activo: data })
      .eq("id", id);

    if (error) {
      console.error("Error al eliminar:", error);
      Alert.alert("Error", "No se pudo eliminar: " + error.message);
    } else {
      // Forzamos la actualización de la lista
      fetchData();
    }
    setLoading(false);
  }

  async function crearItem() {
    if (!nombre || !precio) return Alert.alert("Error", "Faltan datos");
    const objetoInsertar =
      activeTab === "productos"
        ? {
            nombre,
            precio: parseInt(precio),
            stock: 100,
            tiene_toppings: tieneToppings,
          }
        : { nombre, precio: parseInt(precio) };

    const { error } = await supabase.from(activeTab).insert([objetoInsertar]);
    if (!error) {
      setModalVisible(false);
      setNombre("");
      setPrecio("");
      fetchData();
    }
  }

  if (!session && !authLoading) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Panel Administrativo</Text>
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            placeholder="Contraseña"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
          />
          <TouchableOpacity style={styles.btnSave} onPress={handleLogin}>
            <Text style={styles.btnTextSave}>Ingresar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <View style={styles.cardContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.mainTitle}>Gestión de Inventario</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
              <Ionicons name="add-circle" size={35} color="#4CD964" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                supabase.auth.signOut();
                setSession(null);
              }}
            >
              <Ionicons name="log-out-outline" size={30} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "productos" && styles.activeTab]}
            onPress={() => {
              setData([]);
              setPage(0);
              setActiveTab("productos");
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "productos" && styles.activeTabText,
              ]}
            >
              Productos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "toppings" && styles.activeTab]}
            onPress={() => {
              setData([]);
              setPage(0);
              setActiveTab("toppings");
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "toppings" && styles.activeTabText,
              ]}
            >
              Toppings
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#007AFF"
            style={{ marginVertical: 20 }}
          />
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => `${activeTab}-${item.id}`}
            ListHeaderComponent={() => (
              <View style={styles.tableHeader}>
                <Text style={[styles.col, { flex: 2 }]}>Nombre</Text>
                {activeTab === "productos" && (
                  <Text
                    style={[styles.col, { flex: 0.8, textAlign: "center" }]}
                  >
                    Stock
                  </Text>
                )}
                <Text style={[styles.col, { flex: 1, textAlign: "center" }]}>
                  Precio ($)
                </Text>
                {activeTab === "productos" && (
                  <Text
                    style={[styles.col, { flex: 1.2, textAlign: "center" }]}
                  >
                    Toppings
                  </Text>
                )}
                <Text style={[styles.col, { width: 50, textAlign: "center" }]}>
                  Acción
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={[styles.cell, { flex: 2 }]}>{item.nombre}</Text>
                {activeTab === "productos" && (
                  <Text
                    style={[styles.cell, { flex: 0.8, textAlign: "center" }]}
                  >
                    {item.stock}
                  </Text>
                )}
                <View style={{ flex: 1 }}>
                  <CeldaPrecio
                    item={item}
                    tablaActual={activeTab}
                    onSave={updateItem}
                  />
                </View>
                {activeTab === "productos" && (
                  <TouchableOpacity
                    style={[
                      styles.toppingBtn,
                      {
                        flex: 1.2,
                        backgroundColor: item.tiene_toppings
                          ? "#4CD964"
                          : "#FF3B30",
                      },
                    ]}
                    onPress={() =>
                      updateItem(
                        "productos",
                        item.id,
                        "tiene_toppings",
                        !item.tiene_toppings,
                      )
                    }
                  >
                    <Text style={styles.toppingText}>
                      {item.tiene_toppings ? "Con" : "Sin"}
                    </Text>
                  </TouchableOpacity>
                )}
                {/* BOTÓN ELIMINAR */}
                <TouchableOpacity
                  style={{ width: 50, alignItems: "center" }}
                  onPress={() =>
                    confirmarEliminar(item.id, item.nombre, item.esta_activo)
                  }
                >
                  <Ionicons
                    name={
                      item.esta_activo == "si"
                        ? "checkmark-outline"
                        : "close-outline"
                    }
                    size={22}
                    color={item.esta_activo == "si" ? "#4CD964" : "#FF3B30"}
                  />
                </TouchableOpacity>
              </View>
            )}
          />
        )}

        <View style={styles.paginationRow}>
          <TouchableOpacity
            disabled={page === 0}
            onPress={() => setPage((p) => p - 1)}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={page === 0 ? "#CCC" : "#007AFF"}
            />
          </TouchableOpacity>
          <Text style={styles.pageIndicator}>
            Página {page + 1} de {Math.ceil(totalCount / ITEMS_PER_PAGE) || 1}
          </Text>
          <TouchableOpacity
            disabled={(page + 1) * ITEMS_PER_PAGE >= totalCount}
            onPress={() => setPage((p) => p + 1)}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={
                (page + 1) * ITEMS_PER_PAGE >= totalCount ? "#CCC" : "#007AFF"
              }
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Nuevo {activeTab === "productos" ? "Producto" : "Topping"}
            </Text>
            <TextInput
              placeholder="Nombre"
              value={nombre}
              onChangeText={setNombre}
              style={styles.input}
            />
            <TextInput
              placeholder="Precio"
              value={precio}
              onChangeText={setPrecio}
              keyboardType="numeric"
              style={styles.input}
            />
            {activeTab === "productos" && (
              <TouchableOpacity
                style={[
                  styles.modalToppingBtn,
                  { backgroundColor: tieneToppings ? "#4CD964" : "#FF3B30" },
                ]}
                onPress={() => setTieneToppings(!tieneToppings)}
              >
                <Text style={styles.toppingText}>
                  {tieneToppings
                    ? "Habilitar Toppings"
                    : "Deshabilitar Toppings"}
                </Text>
              </TouchableOpacity>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.btnCancel]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ color: "#FF3B30", fontWeight: "bold" }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.btnSave]}
                onPress={crearItem}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Guardar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#F2F2F7", alignItems: "center" },
  loginContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loginCard: {
    width: 340,
    padding: 30,
    backgroundColor: "white",
    borderRadius: 25,
    elevation: 5,
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  cardContainer: {
    width: "95%",
    maxWidth: 1000,
    backgroundColor: "#FFF",
    marginTop: 20,
    borderRadius: 25,
    padding: 20,
    flex: 1,
    marginBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  mainTitle: { fontSize: 26, fontWeight: "bold" },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#F2F2F7",
    borderRadius: 15,
    padding: 5,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  activeTab: { backgroundColor: "#FFF", elevation: 2 },
  tabText: { fontWeight: "600", color: "#8E8E93" },
  activeTabText: { color: "#007AFF" },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: "#EEE",
  },
  col: { fontWeight: "bold", color: "#888", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#F2F2F7",
  },
  cell: { fontSize: 16 },
  priceInput: {
    backgroundColor: "#E3F2FD",
    padding: 8,
    borderRadius: 12,
    textAlign: "center",
    fontWeight: "bold",
    color: "#007AFF",
  },
  toppingBtn: {
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 5,
  },
  toppingText: { color: "white", fontWeight: "bold", fontSize: 12 },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 15,
    gap: 20,
  },
  pageIndicator: { fontSize: 16, color: "#666" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: 380,
    backgroundColor: "white",
    padding: 30,
    borderRadius: 30,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#F2F2F7",
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  modalToppingBtn: {
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 20,
  },
  modalActions: { flexDirection: "row", gap: 15 },
  modalBtn: { flex: 1, padding: 15, borderRadius: 15, alignItems: "center" },
  btnCancel: { backgroundColor: "#FFF0F0" },
  btnSave: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
  },
  btnTextSave: { color: "white", fontWeight: "bold" },
});
