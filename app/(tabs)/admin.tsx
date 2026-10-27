import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../supabaseConfig";
import { avisar, confirmar } from "../../lib/dialogos";
import { color, espacio, radio, tactil, texto } from "../../lib/tema";
import { Ionicons } from "@expo/vector-icons";

const ITEMS_PER_PAGE = 10;

type Tabla = "productos" | "toppings";

// Fila de productos o toppings (los toppings no traen los campos de producto)
type Item = {
  id: number;
  nombre: string;
  precio: number;
  esta_activo: "si" | "no";
  tiene_toppings?: boolean;
  primer_topping?: boolean;
};

type GuardarCampo = (
  tabla: Tabla,
  id: number,
  campo: string,
  valor: string | number | boolean,
) => void;

type PropsCelda = { item: Item; tablaActual: Tabla; onSave: GuardarCampo };

// Componente para editar Precio
const CeldaPrecio = ({ item, tablaActual, onSave }: PropsCelda) => {
  const [valorTemp, setValorTemp] = useState(item.precio.toString());

  useEffect(() => {
    setValorTemp(item.precio.toString());
  }, [item.id, item.precio]);

  return (
    <TextInput
      style={[styles.celdaInput, styles.precioInput]}
      value={valorTemp}
      onChangeText={setValorTemp}
      keyboardType="numeric"
      accessibilityLabel={`Precio de ${item.nombre}`}
      onBlur={() => {
        const num = parseInt(valorTemp, 10);
        if (!isNaN(num) && num >= 0 && num !== item.precio) {
          onSave(tablaActual, item.id, "precio", num);
        } else {
          // Valor inválido: vuelve al precio guardado
          setValorTemp(item.precio.toString());
        }
      }}
    />
  );
};

// Componente para editar Nombre
const CeldaNombre = ({ item, tablaActual, onSave }: PropsCelda) => {
  const [nombreTemp, setNombreTemp] = useState(item.nombre);

  useEffect(() => {
    setNombreTemp(item.nombre);
  }, [item.id, item.nombre]);

  return (
    <TextInput
      style={styles.celdaInput}
      value={nombreTemp}
      onChangeText={setNombreTemp}
      keyboardType="default"
      accessibilityLabel={`Nombre de ${item.nombre}`}
      onBlur={() => {
        const limpio = nombreTemp.trim();
        if (limpio !== "" && limpio !== item.nombre) {
          onSave(tablaActual, item.id, "nombre", limpio);
        } else {
          setNombreTemp(item.nombre);
        }
      }}
    />
  );
};

// Interruptor con texto: el estado se lee sin depender solo del color
const Interruptor = ({
  activo,
  textoSi,
  textoNo,
  onPress,
}: {
  activo: boolean;
  textoSi: string;
  textoNo: string;
  onPress: () => void;
}) => (
  <Pressable
    style={[styles.interruptor, activo ? styles.interruptorSi : styles.interruptorNo]}
    onPress={onPress}
    accessibilityRole="switch"
    accessibilityState={{ checked: activo }}
  >
    <Text style={[styles.interruptorTexto, activo && { color: color.pistachoTexto }]}>
      {activo ? textoSi : textoNo}
    </Text>
  </Pressable>
);

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState<Tabla>("productos");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Item[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [tieneToppings, setTieneToppings] = useState(true);
  const [primerTopping, setPrimerTopping] = useState(false);

  // Suscripción a la sesión: una sola vez, no en cada cambio de pestaña
  useEffect(() => {
    const checkInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setAuthLoading(false);
    };

    checkInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        if (event === "SIGNED_OUT") {
          setData([]);
          setPage(0);
          setEmail("");
          setPassword("");
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Depende del id del usuario y no del objeto sesión, que cambia en cada refresco de token
  const userId = session?.user.id;
  useEffect(() => {
    if (userId) fetchData();
  }, [userId, activeTab, page]);

  async function handleLogin() {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      avisar("No se pudo ingresar", "Revisa el correo y la contraseña.");
    } else if (data?.session) {
      setSession(data.session);
      setPage(0);
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

    if (error) {
      avisar("Error", "No se pudieron cargar los datos: " + error.message);
    } else {
      setData((result ?? []) as Item[]);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }

  const updateItem: GuardarCampo = async (nombreTabla, id, campo, valor) => {
    const { error } = await supabase
      .from(nombreTabla)
      .update({ [campo]: valor })
      .eq("id", id);
    if (error) {
      avisar("Error", "No se pudo guardar el cambio: " + error.message);
      // Recarga para que la celda no muestre un valor que no quedó guardado
      if (activeTab === nombreTabla) fetchData();
      return;
    }
    if (activeTab === nombreTabla) {
      setData((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)),
      );
    }
  };

  async function confirmarEliminar(id: number, nombreItem: string, esta_activo: Item["esta_activo"]) {
    const accion = esta_activo === "si" ? "desactivar" : "activar";
    const ok = await confirmar(
      esta_activo === "si" ? "Desactivar" : "Activar",
      `¿Quieres ${accion} "${nombreItem}"? ${
        esta_activo === "si"
          ? "Dejará de aparecer en la app de ventas."
          : "Volverá a aparecer en la app de ventas."
      }`,
      esta_activo === "si" ? "Desactivar" : "Activar",
    );
    if (ok) activarODesactivar(id, esta_activo);
  }

  async function activarODesactivar(id: number, esta_activo: Item["esta_activo"]) {
    setLoading(true);
    const nuevoEstado = esta_activo === "si" ? "no" : "si";
    const { error } = await supabase
      .from(activeTab)
      .update({ esta_activo: nuevoEstado })
      .eq("id", id);

    if (error) {
      avisar("Error", "No se pudo actualizar: " + error.message);
    } else {
      fetchData();
    }
    setLoading(false);
  }

  async function crearItem() {
    const nombreLimpio = nombre.trim();
    const precioNum = parseInt(precio, 10);
    if (!nombreLimpio || !precio) return avisar("Faltan datos", "Escribe el nombre y el precio.");
    if (isNaN(precioNum) || precioNum < 0) {
      return avisar("Precio no válido", "Escribe el precio solo con números, sin puntos.");
    }

    const objetoInsertar =
      activeTab === "productos"
        ? {
            nombre: nombreLimpio,
            precio: precioNum,
            stock: 100,
            tiene_toppings: tieneToppings,
            primer_topping: primerTopping,
            esta_activo: "si",
          }
        : { nombre: nombreLimpio, precio: precioNum, esta_activo: "si" };

    const { error } = await supabase.from(activeTab).insert([objetoInsertar]);
    if (error) return avisar("Error", "No se pudo guardar: " + error.message);

    setModalVisible(false);
    setNombre("");
    setPrecio("");
    setTieneToppings(true);
    setPrimerTopping(false);
    fetchData();
  }

  const cambiarTabla = (tabla: Tabla) => {
    if (tabla === activeTab) return;
    setData([]);
    setPage(0);
    setActiveTab(tabla);
  };

  if (authLoading)
    return (
      <View style={styles.pantalla}>
        <ActivityIndicator size="large" color={color.fresa} style={{ marginTop: 80 }} />
      </View>
    );

  if (!session) {
    return (
      <View style={[styles.pantalla, styles.centrado]}>
        <View style={styles.loginCard}>
          <Text style={[texto.marca, { textAlign: "center" }]}>ROSE</Text>
          <Text style={[texto.secundario, styles.loginSub]}>Administración del menú</Text>
          <Text style={styles.etiqueta}>Correo</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Text style={styles.etiqueta}>Contraseña</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
            autoComplete="password"
            onSubmitEditing={handleLogin}
          />
          <Pressable
            style={({ pressed }) => [styles.btnPrimario, pressed && styles.btnPrimarioPresionado]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={color.superficie} />
            ) : (
              <Text style={styles.btnPrimarioTexto}>Ingresar</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  const esProductos = activeTab === "productos";
  const totalPaginas = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
  const hayAnterior = page > 0;
  const haySiguiente = (page + 1) * ITEMS_PER_PAGE < totalCount;

  return (
    <View style={styles.pantalla}>
      <View style={styles.contenedor}>
        <View style={styles.headerRow}>
          <Text style={texto.marca}>ROSE</Text>
          <Pressable
            style={styles.btnTexto}
            onPress={async () => {
              await supabase.auth.signOut();
              setSession(null);
            }}
          >
            <Ionicons name="log-out-outline" size={18} color={color.ciruelaSuave} />
            <Text style={texto.secundario}>Cerrar sesión</Text>
          </Pressable>
        </View>

        <View style={styles.barra}>
          <View style={styles.segmentado} accessibilityRole="tablist">
            {(["productos", "toppings"] as Tabla[]).map((tabla) => {
              const activo = activeTab === tabla;
              return (
                <Pressable
                  key={tabla}
                  style={[styles.segmento, activo && styles.segmentoActivo]}
                  onPress={() => cambiarTabla(tabla)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activo }}
                >
                  <Text style={[styles.segmentoTexto, activo && { color: color.superficie }]}>
                    {tabla === "productos" ? "Productos" : "Toppings"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={({ pressed }) => [styles.btnPrimario, styles.btnNuevo, pressed && styles.btnPrimarioPresionado]}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={20} color={color.superficie} />
            <Text style={styles.btnPrimarioTexto}>
              {esProductos ? "Nuevo producto" : "Nuevo topping"}
            </Text>
          </Pressable>
        </View>

        <Text style={[texto.pequeno, { marginBottom: espacio.s }]}>
          Haz clic en un nombre o precio para editarlo; se guarda al salir del campo.
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={color.fresa} style={{ marginVertical: espacio.xl }} />
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => `${activeTab}-${item.id}`}
            ListHeaderComponent={() => (
              <View style={styles.tableHeader}>
                <Text style={[styles.col, { flex: 2 }]}>Nombre</Text>
                <Text style={[styles.col, { flex: 1 }]}>Precio</Text>
                {esProductos && (
                  <>
                    <Text style={[styles.col, styles.colCentro]}>Toppings</Text>
                    <Text style={[styles.col, styles.colCentro]}>Primer topping</Text>
                  </>
                )}
                <Text style={[styles.col, styles.colCentro]}>Estado</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={[texto.secundario, { paddingVertical: espacio.xl }]}>
                {esProductos
                  ? "Aún no hay productos. Crea el primero con “Nuevo producto”."
                  : "Aún no hay toppings. Crea el primero con “Nuevo topping”."}
              </Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.row, item.esta_activo !== "si" && styles.rowInactiva]}>
                <View style={{ flex: 2 }}>
                  <CeldaNombre item={item} tablaActual={activeTab} onSave={updateItem} />
                </View>
                <View style={{ flex: 1 }}>
                  <CeldaPrecio item={item} tablaActual={activeTab} onSave={updateItem} />
                </View>
                {esProductos && (
                  <>
                    <View style={styles.colCentro}>
                      <Interruptor
                        activo={!!item.tiene_toppings}
                        textoSi="Con toppings"
                        textoNo="Sin toppings"
                        onPress={() =>
                          updateItem("productos", item.id, "tiene_toppings", !item.tiene_toppings)
                        }
                      />
                    </View>
                    <View style={styles.colCentro}>
                      <Interruptor
                        activo={!!item.primer_topping}
                        textoSi="Incluido"
                        textoNo="Se cobra"
                        onPress={() =>
                          updateItem("productos", item.id, "primer_topping", !item.primer_topping)
                        }
                      />
                    </View>
                  </>
                )}
                <View style={styles.colCentro}>
                  <Interruptor
                    activo={item.esta_activo === "si"}
                    textoSi="Activo"
                    textoNo="Inactivo"
                    onPress={() => confirmarEliminar(item.id, item.nombre, item.esta_activo)}
                  />
                </View>
              </View>
            )}
          />
        )}

        <View style={styles.paginationRow}>
          <Pressable
            style={styles.btnPagina}
            disabled={!hayAnterior}
            onPress={() => setPage((p) => p - 1)}
            accessibilityLabel="Página anterior"
          >
            <Ionicons name="chevron-back" size={22} color={hayAnterior ? color.fresa : color.linea} />
          </Pressable>
          <Text style={[texto.secundario, texto.numeros]}>
            Página {page + 1} de {totalPaginas}
          </Text>
          <Pressable
            style={styles.btnPagina}
            disabled={!haySiguiente}
            onPress={() => setPage((p) => p + 1)}
            accessibilityLabel="Página siguiente"
          >
            <Ionicons name="chevron-forward" size={22} color={haySiguiente ? color.fresa : color.linea} />
          </Pressable>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.velo, styles.centrado]}>
          <View style={styles.modalContent}>
            <Text style={[texto.titulo, { marginBottom: espacio.l }]}>
              {esProductos ? "Nuevo producto" : "Nuevo topping"}
            </Text>
            <Text style={styles.etiqueta}>Nombre</Text>
            <TextInput value={nombre} onChangeText={setNombre} style={styles.input} />
            <Text style={styles.etiqueta}>Precio</Text>
            <TextInput
              placeholder="Ej: 9000"
              placeholderTextColor={color.ciruelaSuave}
              value={precio}
              onChangeText={setPrecio}
              keyboardType="numeric"
              style={styles.input}
            />

            {esProductos && (
              <View style={{ gap: espacio.m, marginBottom: espacio.l }}>
                <View style={styles.opcionFila}>
                  <Text style={texto.cuerpo}>¿Lleva toppings?</Text>
                  <Interruptor
                    activo={tieneToppings}
                    textoSi="Con toppings"
                    textoNo="Sin toppings"
                    onPress={() => setTieneToppings(!tieneToppings)}
                  />
                </View>
                <View style={styles.opcionFila}>
                  <Text style={texto.cuerpo}>Primer topping</Text>
                  <Interruptor
                    activo={primerTopping}
                    textoSi="Incluido"
                    textoNo="Se cobra"
                    onPress={() => setPrimerTopping(!primerTopping)}
                  />
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.btnCancelar]} onPress={() => setModalVisible(false)}>
                <Text style={{ color: color.ciruela, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.btnPrimario, pressed && styles.btnPrimarioPresionado]}
                onPress={crearItem}
              >
                <Text style={styles.btnPrimarioTexto}>
                  {esProductos ? "Crear producto" : "Crear topping"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.leche },
  centrado: { justifyContent: "center", alignItems: "center" },

  loginCard: {
    width: "100%",
    maxWidth: 360,
    padding: espacio.xxl,
    backgroundColor: color.superficie,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: color.linea,
  },
  loginSub: { textAlign: "center", marginBottom: espacio.xl },
  etiqueta: { fontSize: 14, fontWeight: "600", color: color.ciruela, marginBottom: espacio.xs },
  input: {
    backgroundColor: color.leche,
    borderWidth: 1,
    borderColor: color.linea,
    paddingHorizontal: espacio.m,
    minHeight: tactil,
    borderRadius: radio.m,
    marginBottom: espacio.l,
    fontSize: 16,
    color: color.ciruela,
  },

  btnPrimario: {
    backgroundColor: color.fresa,
    minHeight: tactil,
    paddingHorizontal: espacio.l,
    borderRadius: radio.m,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimarioPresionado: { backgroundColor: color.fresaOscura },
  btnPrimarioTexto: { color: color.superficie, fontWeight: "700", fontSize: 16 },
  btnNuevo: { flexDirection: "row", gap: espacio.xs },
  btnTexto: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.xs,
    minHeight: 44,
    paddingHorizontal: espacio.s,
  },

  contenedor: {
    flex: 1,
    width: "100%",
    maxWidth: 1000,
    alignSelf: "center",
    padding: espacio.xl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: espacio.xl,
  },
  barra: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: espacio.m,
    marginBottom: espacio.l,
  },
  segmentado: {
    flexDirection: "row",
    backgroundColor: color.superficie,
    borderWidth: 1,
    borderColor: color.linea,
    borderRadius: radio.m,
    padding: espacio.xs,
    gap: espacio.xs,
  },
  segmento: {
    minHeight: 40,
    paddingHorizontal: espacio.l,
    justifyContent: "center",
    borderRadius: radio.s,
  },
  segmentoActivo: { backgroundColor: color.ciruela },
  segmentoTexto: { fontWeight: "600", fontSize: 15, color: color.ciruelaSuave },

  tableHeader: {
    flexDirection: "row",
    paddingVertical: espacio.m,
    gap: espacio.m,
    borderBottomWidth: 1,
    borderColor: color.linea,
  },
  col: { fontWeight: "700", color: color.ciruelaSuave, fontSize: 13 },
  colCentro: { flex: 1, alignItems: "center", textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
    paddingVertical: espacio.s,
    borderBottomWidth: 1,
    borderColor: color.linea,
    backgroundColor: color.superficie,
  },
  rowInactiva: { opacity: 0.55 },
  celdaInput: {
    fontSize: 16,
    fontWeight: "600",
    color: color.ciruela,
    paddingHorizontal: espacio.s,
    minHeight: 40,
    borderRadius: radio.s,
    borderWidth: 1,
    borderColor: "transparent",
  },
  precioInput: { fontVariant: ["tabular-nums"], backgroundColor: color.leche, borderColor: color.linea },

  interruptor: {
    minHeight: 32,
    minWidth: 110,
    paddingHorizontal: espacio.m,
    borderRadius: radio.s,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  interruptorSi: { backgroundColor: color.pistachoSuave, borderColor: color.pistacho },
  interruptorNo: { backgroundColor: color.superficie, borderColor: color.linea },
  interruptorTexto: { fontSize: 13, fontWeight: "600", color: color.ciruelaSuave },

  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: espacio.l,
    gap: espacio.l,
  },
  btnPagina: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },

  velo: { flex: 1, backgroundColor: color.velo, padding: espacio.l },
  modalContent: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: color.superficie,
    padding: espacio.xxl,
    borderRadius: radio.l,
  },
  opcionFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalActions: { flexDirection: "row", gap: espacio.m, marginTop: espacio.s },
  modalBtn: { flex: 1 },
  btnCancelar: {
    minHeight: tactil,
    borderRadius: radio.m,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: color.linea,
  },
});
