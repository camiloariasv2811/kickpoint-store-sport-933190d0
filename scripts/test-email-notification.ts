import fs from "fs";
import path from "path";

// Load environment variables if available
if (typeof (process as any).loadEnvFile === "function") {
  try {
    (process as any).loadEnvFile();
  } catch {
    /* ignore */
  }
}

try {
  const envPath = path.resolve(".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = (match[2] || "").trim().replace(/^["']|["']$/g, "");
      }
    }
  }
} catch {
  /* ignore */
}

async function runEmailVerification() {
  console.log("=================================================");
  console.log("   KICKPOINT EMAIL NOTIFICATION SYSTEM AUDIT    ");
  console.log("=================================================\n");

  const {
    getAdminEmail,
    getResendApiKey,
    getResendFromEmail,
    isResendConfigured,
    getPublicStoreUrl,
    buildEmailMessage,
    sendEmailNotification,
  } = await import("../src/lib/email.server");

  // 1. Check environment variables
  const apiKey = getResendApiKey();
  const adminEmail = getAdminEmail();
  const fromEmail = getResendFromEmail();
  const publicUrl = getPublicStoreUrl();
  const isConfigured = isResendConfigured();

  const maskedKey = apiKey
    ? apiKey.slice(0, 5) + "..." + apiKey.slice(-4)
    : "(NO CONFIGURADA O VACÍA)";

  console.log("1. CONFIGURACIÓN DEL ENTORNO:");
  console.log(" - RESEND_API_KEY:", maskedKey);
  console.log(" - RESEND_API_KEY activa/válida:", isConfigured);
  console.log(" - ADMIN_NOTIFICATION_EMAIL:", adminEmail);
  console.log(" - RESEND_FROM_EMAIL:", fromEmail);
  console.log(" - KICKPOINT_PUBLIC_URL:", publicUrl);

  // 2. Test Message Builder Template
  console.log("\n2. VERIFICACIÓN DE PLANTILLA, TABLA DE PRODUCTOS Y BOTÓN:");
  const testPayload = {
    eventType: "order_created" as const,
    recipientEmail: adminEmail,
    recipientType: "admin" as const,
    orderId: "test-order-uuid-123",
    orderCode: "KP-TEST-9999",
    customerName: "Carlos Pérez",
    customerPhone: "+584121234567",
    customerEmail: "carlos.perez@example.com",
    total: 75.5,
    paymentMethod: "Pago Móvil (0102 Banco de Venezuela)",
    paymentReference: "REF-88997766",
    items: [
      {
        productName: "Camiseta Deportiva Kickpoint",
        size: "M",
        color: "Negro",
        quantity: 2,
        unitPrice: 25.0,
        subtotal: 50.0,
      },
      {
        productName: "Shorts Kickpoint Pro",
        size: "L",
        color: "Azul",
        quantity: 1,
        unitPrice: 25.5,
        subtotal: 25.5,
      },
    ],
  };

  const { subject, text, html } = buildEmailMessage(testPayload);
  console.log(" - Asunto generado:", subject);
  console.log(" - Botón URL:", `${publicUrl}/admin/pedidos`);
  console.log(
    " - Contiene '🚨 TIENES UN NUEVO PEDIDO':",
    text.includes("🚨 TIENES UN NUEVO PEDIDO") || html.includes("TIENES UN NUEVO PEDIDO"),
  );
  console.log(
    " - Contiene 'Pendiente de verificación':",
    text.includes("Pendiente de verificación") || html.includes("Pendiente de verificación"),
  );
  console.log(" - Contiene 'VERIFICAR PEDIDO':", html.includes("VERIFICAR PEDIDO"));
  console.log(
    " - Contiene correo del cliente:",
    text.includes("carlos.perez@example.com") && html.includes("carlos.perez@example.com"),
  );
  console.log(
    " - Contiene producto 1 (Camiseta Deportiva Kickpoint):",
    html.includes("Camiseta Deportiva Kickpoint"),
  );
  console.log(
    " - Contiene producto 2 (Shorts Kickpoint Pro):",
    html.includes("Shorts Kickpoint Pro"),
  );
  console.log(
    " - Contiene talla y color en tabla:",
    html.includes("Talla: <strong>M</strong>") && html.includes("Color: Negro"),
  );

  // 3. Test sendEmailNotification function
  console.log("\n3. EJECUCIÓN DE sendEmailNotification():");
  const sendResult = await sendEmailNotification({
    ...testPayload,
    metadata: {
      isTest: true,
      testTimestamp: new Date().toISOString(),
    },
  });

  console.log(" - Resultado ok:", sendResult.ok);
  console.log(" - Status:", sendResult.status);
  console.log(" - Idempotency Key:", sendResult.idempotencyKey);
  console.log(" - Provider Message ID:", sendResult.providerMessageId || "N/A");
  console.log(" - Error message (si aplica):", sendResult.errorMessage || "Ninguno");

  // 4. Test Idempotency duplicate check
  console.log("\n4. PRUEBA DE IDEMPOTENCIA (mismo idempotencyKey):");
  const duplicateResult = await sendEmailNotification({
    ...testPayload,
    metadata: {
      idempotencyKey: sendResult.idempotencyKey,
    },
  });
  console.log(" - Segundo intento status:", duplicateResult.status);

  // 5. Simulación de notificación de pedido real de checkout
  console.log("\n5. SIMULACIÓN DE PEDIDO REAL DE CHECKOUT:");
  const realOrderPayload = {
    eventType: "order_created" as const,
    recipientEmail: adminEmail,
    recipientType: "admin" as const,
    orderId: "ord-test-sample-88",
    orderCode: "KP-2026-0822-001",
    customerName: "María González",
    customerPhone: "+584149876543",
    customerEmail: "maria.gonzalez@example.com",
    total: 35.0,
    paymentMethod: "Pago Móvil (0102 BDV)",
    paymentReference: "REF-PAGOMOVIL-998877",
  };

  const orderEmailMsg = buildEmailMessage(realOrderPayload);
  console.log(" - Asunto del pedido:", orderEmailMsg.subject);
  console.log(
    " - Contiene Código de Pedido (#KP-2026-0822-001):",
    orderEmailMsg.html.includes("#KP-2026-0822-001"),
  );
  console.log(
    " - Contiene Nombre del Cliente (María González):",
    orderEmailMsg.html.includes("María González"),
  );
  console.log(
    " - Contiene Correo del Cliente (maria.gonzalez@example.com):",
    orderEmailMsg.html.includes("maria.gonzalez@example.com"),
  );
  console.log(
    " - Contiene Referencia de Pago (REF-PAGOMOVIL-998877):",
    orderEmailMsg.html.includes("REF-PAGOMOVIL-998877"),
  );
  console.log(
    " - Contiene Botón VERIFICAR PEDIDO:",
    orderEmailMsg.html.includes("VERIFICAR PEDIDO"),
  );
  console.log(" - URL del Botón:", `${publicUrl}/admin/pedidos`);

  const orderSendResult = await sendEmailNotification({
    ...realOrderPayload,
    metadata: {
      isTest: true,
      testedAt: new Date().toISOString(),
    },
  });

  console.log(" - Despacho de notificación de pedido:", {
    ok: orderSendResult.ok,
    status: orderSendResult.status,
    idempotencyKey: orderSendResult.idempotencyKey,
    providerMessageId: orderSendResult.providerMessageId || "N/A",
    errorMessage: orderSendResult.errorMessage || "Ninguno",
  });

  console.log("\n=================================================");
  console.log("           AUDITORÍA COMPLETADA                  ");
  console.log("=================================================");
}

runEmailVerification().catch((err) => {
  console.error("FATAL ERROR IN TEST SCRIPT:", err);
  process.exit(1);
});
