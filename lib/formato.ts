// es-CO agrupa miles con punto también en números de 4 cifras ($9.000); es-ES no lo hace
export const pesos = (valor: number) => `$${valor.toLocaleString("es-CO")}`;

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
