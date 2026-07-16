"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ModelosPage() {
  const [modelos, setModelos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [modeloSeleccionado, setModeloSeleccionado] = useState(null);
  const [procesos, setProcesos] = useState([]);

  const [fotoArchivo, setFotoArchivo] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState("");

  const [formModelo, setFormModelo] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    cliente: "",
    categoria: "",
    notas: "",
    pendientes: "",
    precio_cliente: "",
    foto_url: "",
    activo: true,
  });

  const [formProceso, setFormProceso] = useState({
    nombre: "",
    costo: "",
    posicion: "",
  });

  useEffect(() => {
    cargarModelos();
  }, []);

  async function cargarModelos() {
    const { data, error } = await supabase
      .from("modelos")
      .select("*")
      .order("codigo");

    if (error) {
      alert(error.message);
      return;
    }

    setModelos(data || []);
  }

  function mostrarMensaje(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(""), 2500);
  }

  function limpiarModelo() {
    setModeloSeleccionado(null);
    setProcesos([]);
    setFotoArchivo(null);
    setVistaPrevia("");

    setFormModelo({
      codigo: "",
      nombre: "",
      descripcion: "",
      cliente: "",
      categoria: "",
      notas: "",
      pendientes: "",
      precio_cliente: "",
      foto_url: "",
      activo: true,
    });

    setFormProceso({
      nombre: "",
      costo: "",
      posicion: "",
    });
  }

  function seleccionarFoto(e) {
    const archivo = e.target.files?.[0];

    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
      alert("Selecciona un archivo de imagen");
      return;
    }

    const limite = 5 * 1024 * 1024;

    if (archivo.size > limite) {
      alert("La fotografía debe pesar menos de 5 MB");
      return;
    }

    setFotoArchivo(archivo);
    setVistaPrevia(URL.createObjectURL(archivo));
  }

  async function subirFoto() {
    if (!fotoArchivo) {
      return formModelo.foto_url || "";
    }

    const extension =
      fotoArchivo.name.split(".").pop()?.toLowerCase() || "jpg";

    const nombreSeguro = formModelo.codigo
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-");

    const ruta = `${nombreSeguro || "modelo"}-${Date.now()}.${extension}`;

    const { error: errorSubida } = await supabase.storage
      .from("modelos")
      .upload(ruta, fotoArchivo, {
        cacheControl: "3600",
        upsert: false,
      });

    if (errorSubida) {
      throw new Error(`No se pudo subir la foto: ${errorSubida.message}`);
    }

    const { data } = supabase.storage.from("modelos").getPublicUrl(ruta);

    return data.publicUrl;
  }

  async function guardarModelo() {
    if (!formModelo.codigo.trim() || !formModelo.nombre.trim()) {
      alert("Escribe código y nombre del modelo");
      return;
    }

    if (Number(formModelo.precio_cliente || 0) < 0) {
      alert("El precio del cliente no puede ser negativo");
      return;
    }

    setGuardando(true);

    try {
      const fotoUrl = await subirFoto();

      const datos = {
        codigo: formModelo.codigo.trim(),
        nombre: formModelo.nombre.trim(),
        descripcion: formModelo.descripcion,
        cliente: formModelo.cliente,
        categoria: formModelo.categoria,
        notas: formModelo.notas,
        pendientes: formModelo.pendientes,
        precio_cliente: Number(formModelo.precio_cliente || 0),
        foto_url: fotoUrl || null,
        activo: formModelo.activo,
      };

      if (modeloSeleccionado) {
        const { data, error } = await supabase
          .from("modelos")
          .update(datos)
          .eq("id", modeloSeleccionado.id)
          .select()
          .single();

        if (error) throw error;

        setModeloSeleccionado(data);
        setFormModelo({
          ...formModelo,
          precio_cliente: data.precio_cliente ?? "",
          foto_url: data.foto_url || "",
        });

        setFotoArchivo(null);
        setVistaPrevia(data.foto_url || "");

        mostrarMensaje("Modelo actualizado");
        await cargarModelos();
        return;
      }

      const { data, error } = await supabase
        .from("modelos")
        .insert([datos])
        .select()
        .single();

      if (error) throw error;

      setModeloSeleccionado(data);
      setFormModelo({
        codigo: data.codigo || "",
        nombre: data.nombre || "",
        descripcion: data.descripcion || "",
        cliente: data.cliente || "",
        categoria: data.categoria || "",
        notas: data.notas || "",
        pendientes: data.pendientes || "",
        precio_cliente: data.precio_cliente ?? "",
        foto_url: data.foto_url || "",
        activo: data.activo ?? true,
      });

      setFotoArchivo(null);
      setVistaPrevia(data.foto_url || "");

      mostrarMensaje("Modelo guardado");
      await cargarModelos();
    } catch (error) {
      alert(error.message || "No se pudo guardar el modelo");
    } finally {
      setGuardando(false);
    }
  }

  async function seleccionarModelo(m) {
    setModeloSeleccionado(m);
    setFotoArchivo(null);
    setVistaPrevia(m.foto_url || "");

    setFormModelo({
      codigo: m.codigo || "",
      nombre: m.nombre || "",
      descripcion: m.descripcion || "",
      cliente: m.cliente || "",
      categoria: m.categoria || "",
      notas: m.notas || "",
      pendientes: m.pendientes || "",
      precio_cliente: m.precio_cliente ?? "",
      foto_url: m.foto_url || "",
      activo: m.activo ?? true,
    });

    const { data, error } = await supabase
      .from("modelo_procesos")
      .select("*")
      .eq("modelo_id", m.id)
      .order("orden");

    if (error) {
      alert(error.message);
      return;
    }

    setProcesos(data || []);
  }

  async function agregarProceso() {
    if (!modeloSeleccionado) {
      alert("Primero guarda o selecciona un modelo");
      return;
    }

    if (!formProceso.nombre.trim()) {
      alert("Escribe el nombre del proceso");
      return;
    }

    const posicionSolicitada = Number(
      formProceso.posicion || procesos.length + 1
    );

    const posicion =
      posicionSolicitada < 1
        ? 1
        : posicionSolicitada > procesos.length + 1
        ? procesos.length + 1
        : posicionSolicitada;

    for (const p of procesos) {
      if (Number(p.orden) >= posicion) {
        await supabase
          .from("modelo_procesos")
          .update({ orden: Number(p.orden) + 1 })
          .eq("id", p.id);
      }
    }

    const { error } = await supabase.from("modelo_procesos").insert([
      {
        modelo_id: modeloSeleccionado.id,
        nombre: formProceso.nombre.trim(),
        costo: Number(formProceso.costo || 0),
        orden: posicion,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setFormProceso({
      nombre: "",
      costo: "",
      posicion: "",
    });

    mostrarMensaje("Proceso agregado");
    seleccionarModelo(modeloSeleccionado);
  }

  async function actualizarProceso(p) {
    const { error } = await supabase
      .from("modelo_procesos")
      .update({
        nombre: p.nombre,
        costo: Number(p.costo || 0),
        orden: Number(p.orden || 1),
      })
      .eq("id", p.id);

    if (error) {
      alert(error.message);
      return;
    }

    mostrarMensaje("Proceso actualizado");
    seleccionarModelo(modeloSeleccionado);
  }

  async function eliminarProceso(id) {
    const confirmar = confirm("¿Eliminar este proceso?");

    if (!confirmar) return;

    const { error } = await supabase
      .from("modelo_procesos")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    mostrarMensaje("Proceso eliminado");
    seleccionarModelo(modeloSeleccionado);
  }

  async function cambiarEstadoModelo() {
    if (!modeloSeleccionado) return;

    const nuevoEstado = !formModelo.activo;

    const { error } = await supabase
      .from("modelos")
      .update({ activo: nuevoEstado })
      .eq("id", modeloSeleccionado.id);

    if (error) {
      alert(error.message);
      return;
    }

    setFormModelo({
      ...formModelo,
      activo: nuevoEstado,
    });

    setModeloSeleccionado({
      ...modeloSeleccionado,
      activo: nuevoEstado,
    });

    mostrarMensaje(nuevoEstado ? "Modelo activado" : "Modelo inactivado");
    cargarModelos();
  }

  const modelosFiltrados = modelos.filter((m) => {
    const texto = `${m.codigo || ""} ${m.nombre || ""} ${
      m.cliente || ""
    } ${m.categoria || ""}`.toLowerCase();

    return texto.includes(busqueda.toLowerCase());
  });

  const totalProcesos = procesos.reduce(
    (total, proceso) => total + Number(proceso.costo || 0),
    0
  );

  const precioCliente = Number(formModelo.precio_cliente || 0);
  const gananciaEstimadaPorPrenda = precioCliente - totalProcesos;

  return (
    <div>
      <h1>👕 Registro de modelos</h1>

      {mensaje && (
        <div
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: 12,
            borderRadius: 10,
            marginBottom: 15,
            fontWeight: "bold",
          }}
        >
          {mensaje}
        </div>
      )}

      <div
        style={{
          display: "grid",
gridTemplateColumns:
  window.innerWidth < 900
    ? "1fr"
    : "330px minmax(0,1fr)",
gap: 20,
        }}
      >
        <section style={card}>
          <h2>Buscar modelo</h2>

          <input
            placeholder="Buscar por código, nombre o cliente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={input}
          />

          <button onClick={limpiarModelo} style={botonSecundario}>
            + Nuevo modelo
          </button>

          <div style={{ marginTop: 15 }}>
            {modelosFiltrados.map((m) => (
              <button
                key={m.id}
                onClick={() => seleccionarModelo(m)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: 10,
                  marginBottom: 8,
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  background:
                    modeloSeleccionado?.id === m.id ? "#16a34a" : "#f9fafb",
                  color:
                    modeloSeleccionado?.id === m.id ? "white" : "black",
                }}
              >
                {m.foto_url ? (
                  <img
                    src={m.foto_url}
                    alt={m.nombre || "Modelo"}
                    style={{
                      width: 55,
                      height: 55,
                      objectFit: "cover",
                      borderRadius: 8,
                      background: "white",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 55,
                      height: 55,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 8,
                      background: "#e5e7eb",
                      fontSize: 25,
                    }}
                  >
                    👕
                  </div>
                )}

                <div>
                  <strong>{m.codigo}</strong>
                  <br />
                  {m.nombre}
                  <br />
                  <small>{m.activo ? "🟢 Activo" : "🔴 Inactivo"}</small>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section style={card}>
          <h2>{modeloSeleccionado ? "Editar modelo" : "Nuevo modelo"}</h2>

          <div
            style={{
              display: "grid",
gridTemplateColumns:
  window.innerWidth < 900
    ? "1fr"
    : "220px minmax(0,1fr)",
gap: 20,
alignItems: "start",
            }}
          >
            <div>
              <div style={contenedorFoto}>
                {vistaPrevia || formModelo.foto_url ? (
                  <img
                    src={vistaPrevia || formModelo.foto_url}
                    alt="Vista previa del modelo"
                    style={{
                      width: "100%",
                      height: 240,
                      objectFit: "cover",
                      borderRadius: 10,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 240,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 60,
                    }}
                  >
                    👕
                  </div>
                )}
              </div>

              <label style={etiqueta}>Foto principal del modelo</label>

              <input
                type="file"
                accept="image/*"
                onChange={seleccionarFoto}
                style={{
                  width: "100%",
                  marginTop: 8,
                }}
              />

              <small style={{ display: "block", marginTop: 6, color: "#666" }}>
                Máximo 5 MB
              </small>
            </div>

            <div>
              <input
                placeholder="Código del modelo"
                value={formModelo.codigo}
                onChange={(e) =>
                  setFormModelo({
                    ...formModelo,
                    codigo: e.target.value,
                  })
                }
                style={input}
              />

              <input
                placeholder="Nombre del modelo"
                value={formModelo.nombre}
                onChange={(e) =>
                  setFormModelo({
                    ...formModelo,
                    nombre: e.target.value,
                  })
                }
                style={input}
              />

              <input
                placeholder="Cliente"
                value={formModelo.cliente}
                onChange={(e) =>
                  setFormModelo({
                    ...formModelo,
                    cliente: e.target.value,
                  })
                }
                style={input}
              />

              <input
                placeholder="Categoría: blusa, vestido, falda..."
                value={formModelo.categoria}
                onChange={(e) =>
                  setFormModelo({
                    ...formModelo,
                    categoria: e.target.value,
                  })
                }
                style={input}
              />

              <label style={etiqueta}>
                Precio que paga el cliente por cada prenda
              </label>

              <input
                placeholder="Ejemplo: 45.50"
                type="number"
                min="0"
                step="0.01"
                value={formModelo.precio_cliente}
                onChange={(e) =>
                  setFormModelo({
                    ...formModelo,
                    precio_cliente: e.target.value,
                  })
                }
                style={input}
              />

              <textarea
                placeholder="Descripción"
                value={formModelo.descripcion}
                onChange={(e) =>
                  setFormModelo({
                    ...formModelo,
                    descripcion: e.target.value,
                  })
                }
                style={{ ...input, minHeight: 70 }}
              />

              <textarea
                placeholder="Notas del modelo"
                value={formModelo.notas}
                onChange={(e) =>
                  setFormModelo({
                    ...formModelo,
                    notas: e.target.value,
                  })
                }
                style={{ ...input, minHeight: 70 }}
              />

              <textarea
                placeholder="Pendientes"
                value={formModelo.pendientes}
                onChange={(e) =>
                  setFormModelo({
                    ...formModelo,
                    pendientes: e.target.value,
                  })
                }
                style={{ ...input, minHeight: 70 }}
              />
            </div>
          </div>

          <button
            onClick={guardarModelo}
            style={{
              ...boton,
              opacity: guardando ? 0.7 : 1,
            }}
            disabled={guardando}
          >
            {guardando
              ? "Guardando..."
              : modeloSeleccionado
              ? "Guardar cambios"
              : "Guardar modelo"}
          </button>

          {modeloSeleccionado && (
            <button onClick={cambiarEstadoModelo} style={botonSecundario}>
              {formModelo.activo ? "Inactivar modelo" : "Activar modelo"}
            </button>
          )}

          {modeloSeleccionado && (
            <>
              <hr style={{ margin: "25px 0" }} />

              <h2>Procesos del modelo</h2>

              <div style={resumen}>
                <div>
                  <small>Precio del cliente</small>
                  <strong>${precioCliente.toFixed(2)}</strong>
                </div>

                <div>
                  <small>Costo total de procesos</small>
                  <strong>${totalProcesos.toFixed(2)}</strong>
                </div>

                <div>
                  <small>Ganancia estimada por prenda</small>
                  <strong>
                    ${gananciaEstimadaPorPrenda.toFixed(2)}
                  </strong>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Orden</th>
                      <th style={th}>Proceso</th>
                      <th style={th}>Precio</th>
                      <th style={th}>Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {procesos.map((p, index) => (
                      <tr key={p.id}>
                        <td style={td}>
                          <input
                            type="number"
                            value={p.orden || index + 1}
                            onChange={(e) => {
                              const copia = [...procesos];
                              copia[index].orden = e.target.value;
                              setProcesos(copia);
                            }}
                            style={{ ...input, width: 80 }}
                          />
                        </td>

                        <td style={td}>
                          <input
                            value={p.nombre || ""}
                            onChange={(e) => {
                              const copia = [...procesos];
                              copia[index].nombre = e.target.value;
                              setProcesos(copia);
                            }}
                            style={input}
                          />
                        </td>

                        <td style={td}>
                          <input
                            type="number"
                            step="0.01"
                            value={p.costo || ""}
                            onChange={(e) => {
                              const copia = [...procesos];
                              copia[index].costo = e.target.value;
                              setProcesos(copia);
                            }}
                            style={{ ...input, width: 120 }}
                          />
                        </td>

                        <td style={td}>
                          <button onClick={() => actualizarProceso(p)}>
                            Guardar
                          </button>{" "}
                          <button onClick={() => eliminarProceso(p.id)}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3>Agregar proceso</h3>

              <input
                placeholder="Nombre del proceso"
                value={formProceso.nombre}
                onChange={(e) =>
                  setFormProceso({
                    ...formProceso,
                    nombre: e.target.value,
                  })
                }
                style={input}
              />

              <input
                placeholder="Precio"
                type="number"
                min="0"
                step="0.01"
                value={formProceso.costo}
                onChange={(e) =>
                  setFormProceso({
                    ...formProceso,
                    costo: e.target.value,
                  })
                }
                style={input}
              />

              <input
                placeholder={`Posición, ejemplo 1 a ${procesos.length + 1}`}
                type="number"
                value={formProceso.posicion}
                onChange={(e) =>
                  setFormProceso({
                    ...formProceso,
                    posicion: e.target.value,
                  })
                }
                style={input}
              />

              <button onClick={agregarProceso} style={boton}>
                Agregar proceso
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const card = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const input = {
  width: "100%",
  padding: 10,
  marginTop: 8,
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const etiqueta = {
  display: "block",
  marginTop: 8,
  fontWeight: "bold",
};

const contenedorFoto = {
  width: "100%",
  minHeight: 240,
  border: "2px dashed #d1d5db",
  borderRadius: 12,
  background: "#f9fafb",
  overflow: "hidden",
};

const resumen = {
  display: "grid",
  gridTemplateColumns:
    typeof window !== "undefined" && window.innerWidth < 900
      ? "1fr"
      : "repeat(3,minmax(0,1fr))",
  gap: 12,
  marginBottom: 20,
};

const boton = {
  padding: "12px 18px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  marginRight: 10,
  marginTop: 10,
};

const botonSecundario = {
  padding: "12px 18px",
  background: "#e5e7eb",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  marginRight: 10,
  marginTop: 10,
};

const th = {
  borderBottom: "1px solid #ddd",
  padding: 10,
  textAlign: "left",
};

const td = {
  borderBottom: "1px solid #eee",
  padding: 10,
};