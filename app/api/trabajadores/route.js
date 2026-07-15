import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function crearSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local"
    );
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function limpiarUsuario(usuario = "") {
  return usuario.trim().toLowerCase().replace(/\s+/g, "");
}

/*
  Supabase Auth inicia sesión con correo y contraseña.

  Como en Wishlist Taller queremos mostrar solamente un nombre de usuario,
  internamente convertimos:

  juan -> juan@wishlist.local

  La pantalla de login debe utilizar exactamente la misma conversión.
*/
function usuarioAEmail(usuario) {
  return `${limpiarUsuario(usuario)}@wishlist.local`;
}

export async function POST(request) {
  let supabaseAdmin;
  let authUserId = null;

  try {
    supabaseAdmin = crearSupabaseAdmin();

    const body = await request.json();

    const nombre = body.nombre?.trim();
    const usuario = limpiarUsuario(body.usuario);
    const password = body.password || "";
    const rol = body.rol === "encargado" ? "encargado" : "trabajador";

    if (!nombre) {
      return NextResponse.json(
        { error: "Escribe el nombre del trabajador." },
        { status: 400 }
      );
    }

    if (!usuario) {
      return NextResponse.json(
        { error: "Escribe un usuario para el trabajador." },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9._-]+$/.test(usuario)) {
      return NextResponse.json(
        {
          error:
            "El usuario solamente puede llevar letras, números, punto, guion o guion bajo.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener por lo menos 6 caracteres." },
        { status: 400 }
      );
    }

    const emailInterno = usuarioAEmail(usuario);

    const { data: usuarioExistente } = await supabaseAdmin
      .from("empleados")
      .select("id")
      .ilike("usuario", usuario)
      .maybeSingle();

    if (usuarioExistente) {
      return NextResponse.json(
        { error: "Ese nombre de usuario ya está registrado." },
        { status: 409 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailInterno,
        password,
        email_confirm: true,
        user_metadata: {
          nombre,
          usuario,
          rol,
        },
        app_metadata: {
          rol,
        },
      });

    if (authError) {
      const mensaje = authError.message?.toLowerCase() || "";

      if (
        mensaje.includes("already") ||
        mensaje.includes("registered") ||
        mensaje.includes("exists")
      ) {
        return NextResponse.json(
          { error: "Ese usuario ya tiene una cuenta de acceso." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    authUserId = authData.user.id;

    const empleado = {
      nombre,
      alias: body.alias?.trim() || "",
      telefono: body.telefono?.trim() || "",
      direccion: body.direccion?.trim() || "",
      fecha_nacimiento: body.fecha_nacimiento || null,
      fecha_ingreso: body.fecha_ingreso || null,
      puesto: body.puesto || "Recta",
      pago_hora: Number(body.pago_hora || 0),
      observaciones: body.observaciones?.trim() || "",
      activo: body.activo !== false,
      usuario,
      rol,
      auth_user_id: authUserId,
    };

    const { data: empleadoCreado, error: empleadoError } =
      await supabaseAdmin
        .from("empleados")
        .insert([empleado])
        .select()
        .single();

    if (empleadoError) {
      // Evita dejar una cuenta suelta si falló el registro del empleado.
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      return NextResponse.json(
        { error: empleadoError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      mensaje: "Trabajador y cuenta creados correctamente.",
      empleado: empleadoCreado,
    });
  } catch (error) {
    if (authUserId && supabaseAdmin) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
    }

    console.error("Error al crear trabajador:", error);

    return NextResponse.json(
      { error: error.message || "No fue posible crear al trabajador." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const supabaseAdmin = crearSupabaseAdmin();
    const body = await request.json();

    const empleadoId = body.id;
    const authUserId = body.auth_user_id;
    const usuario = limpiarUsuario(body.usuario);
    const password = body.password || "";
    const rol = body.rol === "encargado" ? "encargado" : "trabajador";

    if (!empleadoId) {
      return NextResponse.json(
        { error: "No se recibió el identificador del trabajador." },
        { status: 400 }
      );
    }

    if (!body.nombre?.trim()) {
      return NextResponse.json(
        { error: "Escribe el nombre del trabajador." },
        { status: 400 }
      );
    }

    if (!usuario) {
      return NextResponse.json(
        { error: "Escribe el usuario del trabajador." },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9._-]+$/.test(usuario)) {
      return NextResponse.json(
        {
          error:
            "El usuario solamente puede llevar letras, números, punto, guion o guion bajo.",
        },
        { status: 400 }
      );
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener por lo menos 6 caracteres." },
        { status: 400 }
      );
    }

    const { data: usuarioRepetido, error: consultaError } =
      await supabaseAdmin
        .from("empleados")
        .select("id")
        .ilike("usuario", usuario)
        .neq("id", empleadoId)
        .maybeSingle();

    if (consultaError) {
      return NextResponse.json(
        { error: consultaError.message },
        { status: 400 }
      );
    }

    if (usuarioRepetido) {
      return NextResponse.json(
        { error: "Ese nombre de usuario pertenece a otro trabajador." },
        { status: 409 }
      );
    }

    const datosEmpleado = {
      nombre: body.nombre.trim(),
      alias: body.alias?.trim() || "",
      telefono: body.telefono?.trim() || "",
      direccion: body.direccion?.trim() || "",
      fecha_nacimiento: body.fecha_nacimiento || null,
      fecha_ingreso: body.fecha_ingreso || null,
      puesto: body.puesto || "Recta",
      pago_hora: Number(body.pago_hora || 0),
      observaciones: body.observaciones?.trim() || "",
      activo: body.activo !== false,
      usuario,
      rol,
    };

    let cuentaId = authUserId;

    if (!cuentaId) {
      if (!password) {
        return NextResponse.json(
          {
            error:
              "Este trabajador todavía no tiene cuenta. Escribe una contraseña para crearla.",
          },
          { status: 400 }
        );
      }

      const { data: authData, error: crearError } =
        await supabaseAdmin.auth.admin.createUser({
          email: usuarioAEmail(usuario),
          password,
          email_confirm: true,
          user_metadata: {
            nombre: datosEmpleado.nombre,
            usuario,
            rol,
          },
          app_metadata: {
            rol,
          },
        });

      if (crearError) {
        return NextResponse.json(
          { error: crearError.message },
          { status: 400 }
        );
      }

      cuentaId = authData.user.id;
      datosEmpleado.auth_user_id = cuentaId;
    } else {
      const cambiosAuth = {
        email: usuarioAEmail(usuario),
        email_confirm: true,
        user_metadata: {
          nombre: datosEmpleado.nombre,
          usuario,
          rol,
        },
        app_metadata: {
          rol,
        },
      };

      if (password) {
        cambiosAuth.password = password;
      }

      const { error: authError } =
        await supabaseAdmin.auth.admin.updateUserById(
          cuentaId,
          cambiosAuth
        );

      if (authError) {
        return NextResponse.json(
          { error: authError.message },
          { status: 400 }
        );
      }
    }

    const { data: empleadoActualizado, error: empleadoError } =
      await supabaseAdmin
        .from("empleados")
        .update(datosEmpleado)
        .eq("id", empleadoId)
        .select()
        .single();

    if (empleadoError) {
      return NextResponse.json(
        { error: empleadoError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      mensaje: "Trabajador y cuenta actualizados correctamente.",
      empleado: empleadoActualizado,
    });
  } catch (error) {
    console.error("Error al actualizar trabajador:", error);

    return NextResponse.json(
      { error: error.message || "No fue posible actualizar al trabajador." },
      { status: 500 }
    );
  }
}