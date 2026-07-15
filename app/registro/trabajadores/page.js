"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const puestos = [
  "Recta",
  "Over",
  "Collareta",
  "Terminado",
  "Corte",
  "Encargado",
  "Otro",
];

const formularioInicial = {
  nombre: "",
  alias: "",
  telefono: "",
  direccion: "",
  fecha_nacimiento: "",
  fecha_ingreso: "",
  puesto: "Recta",
  pago_hora: "",
  observaciones: "",
  activo: true,
  usuario: "",
  password: "",
  rol: "trabajador",
  auth_user_id: null,
};

export default function TrabajadoresPage() {
  const [empleados, setEmpleados] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const [form, setForm] = useState(formularioInicial);

  useEffect(() => {
    cargarEmpleados();
  }, []);

  async function cargarEmpleados() {
    const { data, error } = await supabase
      .from("empleados")
      .select("*")
      .order("nombre");

    if (error) {
      alert(error.message);
      return;
    }

    setEmpleados(data || []);
  }

  function mostrarMensaje(texto) {
    setMensaje(texto);

    setTimeout(() => {
      setMensaje("");
    }, 3000);
  }

  function limpiarFormulario() {
    setEditandoId(null);
    setForm(formularioInicial);
    setMostrarPassword(false);
  }

  function actualizarCampo(campo, valor) {
    setForm((formActual) => ({
      ...formActual,
      [campo]: valor,
    }));
  }

  function limpiarUsuario(valor) {
    return valor.toLowerCase().replace(/\s+/g, "");
  }

  async function guardarEmpleado() {
    if (guardando) return;

    if (!form.nombre.trim()) {
      alert("Escribe el nombre del trabajador");
      return;
    }

    if (!form.usuario.trim()) {
      alert("Escribe un usuario para el trabajador");
      return;
    }

    if (!/^[a-z0-9._-]+$/.test(form.usuario)) {
      alert(
        "El usuario solamente puede llevar letras, números, punto, guion o guion bajo"
      );
      return;
    }

    if (!editandoId && form.password.length < 6) {
      alert("La contraseña debe tener por lo menos 6 caracteres");
      return;
    }

    if (editandoId && !form.auth_user_id && form.password.length < 6) {
      alert(
        "Este trabajador todavía no tiene cuenta. Escribe una contraseña de por lo menos 6 caracteres."
      );
      return;
    }

    if (editandoId && form.password && form.password.length < 6) {
      alert("La nueva contraseña debe tener por lo menos 6 caracteres");
      return;
    }

    setGuardando(true);

    try {
      const respuesta = await fetch("/api/trabajadores", {
        method: editandoId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editandoId,
          auth_user_id: form.auth_user_id,
          nombre: form.nombre,
          alias: form.alias,
          telefono: form.telefono,
          direccion: form.direccion,
          fecha_nacimiento: form.fecha_nacimiento || null,
          fecha_ingreso: form.fecha_ingreso || null,
          puesto: form.puesto,
          pago_hora: Number(form.pago_hora || 0),
          observaciones: form.observaciones,
          activo: form.activo,
          usuario: limpiarUsuario(form.usuario),
          password: form.password,
          rol: form.rol,
        }),
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          resultado.error || "No fue posible guardar al trabajador"
        );
      }

      mostrarMensaje(
        editandoId
          ? "Trabajador y acceso actualizados correctamente"
          : "Trabajador y cuenta de acceso creados correctamente"
      );

      limpiarFormulario();
      await cargarEmpleados();
    } catch (error) {
      alert(error.message);
    } finally {
      setGuardando(false);
    }
  }

  function editarEmpleado(empleado) {
    setEditandoId(empleado.id);

    setForm({
      nombre: empleado.nombre || "",
      alias: empleado.alias || "",
      telefono: empleado.telefono || "",
      direccion: empleado.direccion || "",
      fecha_nacimiento: empleado.fecha_nacimiento || "",
      fecha_ingreso: empleado.fecha_ingreso || "",
      puesto: empleado.puesto || "Recta",
      pago_hora: empleado.pago_hora ?? "",
      observaciones: empleado.observaciones || "",
      activo: empleado.activo ?? true,
      usuario: empleado.usuario || "",
      password: "",
      rol: empleado.rol || "trabajador",
      auth_user_id: empleado.auth_user_id || null,
    });

    setMostrarPassword(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function cambiarEstado(empleado) {
    const confirmar = confirm(
      empleado.activo
        ? "¿Deseas inactivar este trabajador?"
        : "¿Deseas activar este trabajador?"
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("empleados")
      .update({
        activo: !empleado.activo,
      })
      .eq("id", empleado.id);

    if (error) {
      alert(error.message);
      return;
    }

    mostrarMensaje(
      empleado.activo
        ? "Trabajador inactivado"
        : "Trabajador activado"
    );

    cargarEmpleados();
  }

  const empleadosFiltrados = empleados.filter((empleado) => {
    const texto = `
      ${empleado.nombre || ""}
      ${empleado.alias || ""}
      ${empleado.puesto || ""}
      ${empleado.usuario || ""}
      ${empleado.rol || ""}
    `.toLowerCase();

    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <div>
      <h1>👷 Registro de trabajadores</h1>

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

      <section style={card}>
        <h2>
          {editandoId ? "Editar trabajador" : "Nuevo trabajador"}
        </h2>

        <h3 style={subtitulo}>Información personal</h3>

        <label style={label}>Nombre completo</label>

        <input
          placeholder="Nombre completo"
          value={form.nombre}
          onChange={(e) =>
            actualizarCampo("nombre", e.target.value)
          }
          style={input}
        />

        <label style={label}>Alias o apodo</label>

        <input
          placeholder="Alias o apodo"
          value={form.alias}
          onChange={(e) =>
            actualizarCampo("alias", e.target.value)
          }
          style={input}
        />

        <label style={label}>Teléfono</label>

        <input
          placeholder="Teléfono"
          value={form.telefono}
          onChange={(e) =>
            actualizarCampo("telefono", e.target.value)
          }
          style={input}
        />

        <label style={label}>Dirección</label>

        <input
          placeholder="Dirección"
          value={form.direccion}
          onChange={(e) =>
            actualizarCampo("direccion", e.target.value)
          }
          style={input}
        />

        <label style={label}>Fecha de nacimiento</label>

        <input
          type="date"
          value={form.fecha_nacimiento}
          onChange={(e) =>
            actualizarCampo("fecha_nacimiento", e.target.value)
          }
          style={input}
        />

        <label style={label}>Fecha de ingreso</label>

        <input
          type="date"
          value={form.fecha_ingreso}
          onChange={(e) =>
            actualizarCampo("fecha_ingreso", e.target.value)
          }
          style={input}
        />

        <label style={label}>Puesto</label>

        <select
          value={form.puesto}
          onChange={(e) =>
            actualizarCampo("puesto", e.target.value)
          }
          style={input}
        >
          {puestos.map((puesto) => (
            <option key={puesto} value={puesto}>
              {puesto}
            </option>
          ))}
        </select>

        <label style={label}>Pago por hora</label>

        <input
          placeholder="Pago por hora"
          type="number"
          min="0"
          step="0.01"
          value={form.pago_hora}
          onChange={(e) =>
            actualizarCampo("pago_hora", e.target.value)
          }
          style={input}
        />

        <label style={label}>Estado del trabajador</label>

        <select
          value={form.activo ? "activo" : "inactivo"}
          onChange={(e) =>
            actualizarCampo(
              "activo",
              e.target.value === "activo"
            )
          }
          style={input}
        >
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>

        <label style={label}>Observaciones</label>

        <textarea
          placeholder="Observaciones"
          value={form.observaciones}
          onChange={(e) =>
            actualizarCampo("observaciones", e.target.value)
          }
          style={{
            ...input,
            minHeight: 80,
            resize: "vertical",
          }}
        />

        <div style={separador} />

        <h3 style={subtitulo}>🔐 Acceso a Wishlist Taller</h3>

        <p style={ayuda}>
          El trabajador utilizará este usuario y contraseña para entrar a
          su perfil.
        </p>

        <label style={label}>Usuario</label>

        <input
          placeholder="Ejemplo: juan"
          autoComplete="off"
          value={form.usuario}
          onChange={(e) =>
            actualizarCampo(
              "usuario",
              limpiarUsuario(e.target.value)
            )
          }
          style={input}
        />

        <p style={ayuda}>
          El usuario no debe llevar espacios. Ejemplos: juan, ana.lopez o
          encargado1.
        </p>

        <label style={label}>
          {editandoId
            ? form.auth_user_id
              ? "Nueva contraseña"
              : "Contraseña para crear su cuenta"
            : "Contraseña"}
        </label>

        <div style={contenedorPassword}>
          <input
            type={mostrarPassword ? "text" : "password"}
            placeholder={
              editandoId && form.auth_user_id
                ? "Déjala vacía para conservar la contraseña actual"
                : "Mínimo 6 caracteres"
            }
            autoComplete="new-password"
            value={form.password}
            onChange={(e) =>
              actualizarCampo("password", e.target.value)
            }
            style={{
              ...input,
              margin: 0,
              paddingRight: 100,
            }}
          />

          <button
            type="button"
            onClick={() =>
              setMostrarPassword(!mostrarPassword)
            }
            style={botonVerPassword}
          >
            {mostrarPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        {editandoId && form.auth_user_id && (
          <p style={ayuda}>
            La contraseña actual no puede mostrarse por seguridad. Déjala
            vacía para conservarla o escribe una nueva para cambiarla.
          </p>
        )}

        {editandoId && !form.auth_user_id && (
          <div style={aviso}>
            Este trabajador fue registrado antes de crear el inicio de
            sesión. Escribe un usuario y una contraseña para crearle su
            cuenta.
          </div>
        )}

        <label style={label}>Tipo de acceso</label>

        <select
          value={form.rol}
          onChange={(e) =>
            actualizarCampo("rol", e.target.value)
          }
          style={input}
        >
          <option value="trabajador">Trabajador</option>
          <option value="encargado">Encargado</option>
        </select>

        <div style={descripcionRol}>
          {form.rol === "trabajador"
            ? "El trabajador tendrá acceso solamente a su perfil y a las funciones autorizadas."
            : "La encargada tendrá acceso a las funciones operativas autorizadas, pero no a las funciones exclusivas del administrador."}
        </div>

        <div style={contenedorBotones}>
          <button
            type="button"
            onClick={guardarEmpleado}
            disabled={guardando}
            style={{
              ...boton,
              opacity: guardando ? 0.65 : 1,
              cursor: guardando
                ? "not-allowed"
                : "pointer",
            }}
          >
            {guardando
              ? "Guardando..."
              : editandoId
                ? "Guardar cambios"
                : "Guardar trabajador"}
          </button>

          {editandoId && (
            <button
              type="button"
              onClick={limpiarFormulario}
              disabled={guardando}
              style={botonSecundario}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </section>

      <section style={card}>
        <h2>Trabajadores registrados</h2>

        <input
          placeholder="Buscar por nombre, puesto o usuario..."
          value={busqueda}
          onChange={(e) =>
            setBusqueda(e.target.value)
          }
          style={input}
        />

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: 900,
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={th}>Nombre</th>
                <th style={th}>Alias</th>
                <th style={th}>Puesto</th>
                <th style={th}>Usuario</th>
                <th style={th}>Rol</th>
                <th style={th}>Pago/hr</th>
                <th style={th}>Cuenta</th>
                <th style={th}>Estado</th>
                <th style={th}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {empleadosFiltrados.map((empleado) => (
                <tr key={empleado.id}>
                  <td style={td}>
                    {empleado.nombre}
                  </td>

                  <td style={td}>
                    {empleado.alias || "—"}
                  </td>

                  <td style={td}>
                    {empleado.puesto || "—"}
                  </td>

                  <td style={td}>
                    {empleado.usuario ? (
                      empleado.usuario
                    ) : (
                      <span style={{ color: "#b45309" }}>
                        Sin usuario
                      </span>
                    )}
                  </td>

                  <td style={td}>
                    {empleado.rol === "encargado"
                      ? "Encargado"
                      : "Trabajador"}
                  </td>

                  <td style={td}>
                    $
                    {Number(
                      empleado.pago_hora || 0
                    ).toFixed(2)}
                  </td>

                  <td style={td}>
                    {empleado.auth_user_id ? (
                      <span style={{ color: "#166534" }}>
                        ✅ Creada
                      </span>
                    ) : (
                      <span style={{ color: "#b45309" }}>
                        ⚠️ Pendiente
                      </span>
                    )}
                  </td>

                  <td style={td}>
                    {empleado.activo
                      ? "🟢 Activo"
                      : "🔴 Inactivo"}
                  </td>

                  <td style={td}>
                    <div style={acciones}>
                      <button
                        type="button"
                        onClick={() =>
                          editarEmpleado(empleado)
                        }
                        style={botonEditar}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          cambiarEstado(empleado)
                        }
                        style={
                          empleado.activo
                            ? botonInactivar
                            : botonActivar
                        }
                      >
                        {empleado.activo
                          ? "Inactivar"
                          : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {empleadosFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan="9"
                    style={{
                      ...td,
                      textAlign: "center",
                      padding: 25,
                      color: "#6b7280",
                    }}
                  >
                    No se encontraron trabajadores.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const card = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  marginBottom: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const subtitulo = {
  marginTop: 16,
  marginBottom: 6,
  color: "#1f2937",
};

const label = {
  display: "block",
  marginTop: 6,
  fontWeight: "bold",
  color: "#374151",
};

const ayuda = {
  color: "#6b7280",
  fontSize: 14,
  marginTop: 4,
  marginBottom: 10,
};

const input = {
  width: "100%",
  padding: 10,
  marginTop: 8,
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  boxSizing: "border-box",
  fontSize: 16,
};

const separador = {
  height: 1,
  background: "#e5e7eb",
  marginTop: 20,
  marginBottom: 20,
};

const contenedorPassword = {
  position: "relative",
  marginTop: 8,
  marginBottom: 10,
};

const botonVerPassword = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  padding: "7px 10px",
  border: "none",
  borderRadius: 6,
  background: "#e5e7eb",
  cursor: "pointer",
  fontWeight: "bold",
};

const aviso = {
  padding: 12,
  marginTop: 8,
  marginBottom: 12,
  borderRadius: 8,
  background: "#fef3c7",
  color: "#92400e",
  fontWeight: "bold",
};

const descripcionRol = {
  padding: 12,
  marginBottom: 16,
  borderRadius: 8,
  background: "#f3f4f6",
  color: "#4b5563",
  fontSize: 14,
};

const contenedorBotones = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 12,
};

const boton = {
  padding: "12px 18px",
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
};

const botonSecundario = {
  padding: "12px 18px",
  background: "#e5e7eb",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
};

const acciones = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const botonEditar = {
  padding: "7px 10px",
  border: "none",
  borderRadius: 6,
  background: "#dbeafe",
  color: "#1d4ed8",
  cursor: "pointer",
  fontWeight: "bold",
};

const botonInactivar = {
  padding: "7px 10px",
  border: "none",
  borderRadius: 6,
  background: "#fee2e2",
  color: "#b91c1c",
  cursor: "pointer",
  fontWeight: "bold",
};

const botonActivar = {
  padding: "7px 10px",
  border: "none",
  borderRadius: 6,
  background: "#dcfce7",
  color: "#166534",
  cursor: "pointer",
  fontWeight: "bold",
};

const th = {
  borderBottom: "1px solid #ddd",
  padding: 10,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const td = {
  borderBottom: "1px solid #eee",
  padding: 10,
  verticalAlign: "top",
};