/**
 * Política de Privacidad — Nexora
 */

import Link from "next/link";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
      <div className="text-text-muted leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 text-text-muted ml-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background landing-bg">
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="brand-nexora text-xl hover:opacity-90 transition-opacity">
            Nexora
          </Link>
          <Link href="/" className="text-sm text-text-muted hover:text-white transition">
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="heading-page text-4xl mb-3">Política de Privacidad</h1>
        <p className="text-text-muted text-sm mb-12">Última actualización: 9 de marzo de 2026</p>

        <Section title="1. Introducción">
          <p>Bienvenido a Nexora.</p>
          <p>
            Nexora es una plataforma SaaS que permite a emprendedores y empresas crear tiendas online
            y utilizar agentes de inteligencia artificial para interactuar con clientes, automatizar
            conversaciones y facilitar procesos de venta a través de distintos canales digitales.
          </p>
          <p>
            La presente Política de Privacidad describe cómo recopilamos, utilizamos, almacenamos y
            protegemos la información cuando utilizas nuestros servicios, nuestro sitio web o cualquier
            producto relacionado con Nexora.
          </p>
          <p>Al utilizar Nexora, aceptás las prácticas descritas en esta política.</p>
        </Section>

        <Section title="2. Información que recopilamos">
          <p>
            Podemos recopilar diferentes tipos de información dependiendo del uso de la plataforma.
          </p>

          <h3 className="text-white font-medium mt-6 mb-2">2.1 Información de registro</h3>
          <p>Cuando creás una cuenta en Nexora podemos recopilar:</p>
          <List items={[
            "Nombre completo",
            "Dirección de correo electrónico",
            "Foto de perfil (si utilizás inicio de sesión con Google)",
            "Identificador de usuario",
            "Información básica de autenticación",
          ]} />
          <p>Esta información es necesaria para crear y administrar tu cuenta dentro de la plataforma.</p>

          <h3 className="text-white font-medium mt-6 mb-2">2.2 Información de tiendas</h3>
          <p>Cuando utilizás Nexora para crear una tienda online podemos almacenar:</p>
          <List items={[
            "Nombre de la tienda",
            "URL o slug de la tienda",
            "Catálogo de productos (imágenes, categorías, descripciones, precios, inventario)",
          ]} />
          <p>
            Estos datos pertenecen exclusivamente al usuario propietario de la tienda. Nexora actúa
            únicamente como plataforma tecnológica para almacenar y gestionar dicha información.
          </p>

          <h3 className="text-white font-medium mt-6 mb-2">2.3 Información de clientes</h3>
          <p>Cuando utilizás Nexora para interactuar con clientes, pueden recopilarse datos como:</p>
          <List items={[
            "Nombre del cliente",
            "Número de teléfono",
            "Mensajes enviados y recibidos",
            "Historial de conversaciones",
            "Preferencias del cliente",
            "Historial de pedidos",
          ]} />
          <p>
            Estos datos se recopilan únicamente con el objetivo de facilitar el proceso de venta y
            atención automatizada.
          </p>

          <h3 className="text-white font-medium mt-6 mb-2">2.4 Información de conversaciones</h3>
          <p>
            Cuando los clientes interactúan con los agentes de IA de Nexora, el sistema puede almacenar:
          </p>
          <List items={[
            "Mensajes enviados por el cliente",
            "Respuestas generadas por la inteligencia artificial",
            "Etapa de la conversación",
            "Intención detectada",
            "Metadatos de la conversación",
            "Duración de la interacción",
          ]} />
          <p>Estos datos se utilizan para:</p>
          <List items={[
            "Mejorar la calidad del servicio",
            "Mantener contexto en las conversaciones",
            "Permitir al dueño de la tienda revisar interacciones",
          ]} />

          <h3 className="text-white font-medium mt-6 mb-2">2.5 Información técnica</h3>
          <p>También podemos recopilar información técnica como:</p>
          <List items={[
            "Dirección IP",
            "Tipo de navegador",
            "Dispositivo utilizado",
            "Sistema operativo",
            "Registros del sistema",
            "Errores de la plataforma",
          ]} />
          <p>
            Esta información se utiliza para mejorar la estabilidad y seguridad del servicio.
          </p>
        </Section>

        <Section title="3. Uso de la información">
          <p>Utilizamos la información recopilada para los siguientes fines:</p>
          <List items={[
            "Proporcionar acceso a la plataforma Nexora",
            "Permitir la creación y administración de tiendas online",
            "Facilitar la interacción entre agentes de inteligencia artificial y clientes",
            "Procesar solicitudes y consultas",
            "Mejorar la experiencia del usuario",
            "Mantener la seguridad del sistema",
            "Detectar actividades fraudulentas",
            "Mejorar el rendimiento de nuestros servicios",
          ]} />
        </Section>

        <Section title="4. Uso de inteligencia artificial">
          <p>
            Nexora utiliza sistemas de inteligencia artificial para generar respuestas automatizadas
            en conversaciones con clientes.
          </p>
          <p>Estos sistemas pueden analizar:</p>
          <List items={[
            "Contexto de conversación",
            "Intención del cliente",
            "Información de productos",
            "Historial de interacción",
          ]} />
          <p>
            La inteligencia artificial se utiliza exclusivamente para mejorar la experiencia de
            atención y automatizar procesos comerciales.
          </p>
          <p>
            Las respuestas generadas por la IA pueden no ser perfectas y Nexora recomienda a los
            usuarios supervisar las interacciones cuando sea necesario.
          </p>
        </Section>

        <Section title="5. Integraciones con terceros">
          <p>
            Nexora puede integrarse con servicios de terceros para proporcionar funcionalidades
            adicionales. Entre estos servicios pueden incluirse:
          </p>
          <List items={[
            "Plataformas de mensajería",
            "Servicios de autenticación",
            "Sistemas de pago",
            "Proveedores de infraestructura",
            "Herramientas de análisis",
          ]} />
          <p>
            Cada uno de estos servicios tiene sus propias políticas de privacidad. Nexora no es
            responsable por las prácticas de privacidad de servicios externos.
          </p>
        </Section>

        <Section title="6. Uso de WhatsApp y canales de mensajería">
          <p>
            Cuando se utilizan integraciones de mensajería como WhatsApp, los mensajes pueden ser
            transmitidos a través de sistemas externos.
          </p>
          <p>
            El usuario es responsable de asegurarse de cumplir con las políticas y condiciones de
            dichas plataformas. Nexora actúa únicamente como intermediario tecnológico entre el
            sistema de mensajería y el agente de inteligencia artificial.
          </p>
        </Section>

        <Section title="7. Seguridad de la información">
          <p>
            La seguridad de los datos es una prioridad para Nexora. Implementamos diversas medidas
            técnicas y organizativas para proteger la información, incluyendo:
          </p>
          <List items={[
            "Control de acceso a sistemas",
            "Autenticación segura",
            "Cifrado de comunicaciones",
            "Monitoreo de actividad",
            "Almacenamiento protegido",
            "Auditoría de eventos",
          ]} />
          <p>
            A pesar de estas medidas, ningún sistema es completamente seguro y Nexora no puede
            garantizar seguridad absoluta.
          </p>
        </Section>

        <Section title="8. Retención de datos">
          <p>Conservamos la información únicamente durante el tiempo necesario para:</p>
          <List items={[
            "Proporcionar nuestros servicios",
            "Cumplir obligaciones legales",
            "Resolver disputas",
            "Mantener registros operativos",
          ]} />
          <p>
            Los usuarios pueden solicitar la eliminación de sus datos cuando lo deseen, sujeto a las
            limitaciones legales aplicables.
          </p>
        </Section>

        <Section title="9. Derechos del usuario">
          <p>Los usuarios de Nexora tienen derecho a:</p>
          <List items={[
            "Acceder a sus datos",
            "Modificar información incorrecta",
            "Solicitar eliminación de datos",
            "Retirar consentimiento de procesamiento",
            "Solicitar exportación de datos",
          ]} />
          <p>Las solicitudes pueden realizarse a través de los canales de contacto oficiales.</p>
        </Section>

        <Section title="10. Responsabilidad del usuario">
          <p>Los usuarios de Nexora son responsables de:</p>
          <List items={[
            "Utilizar la plataforma de manera legal",
            "Cumplir con regulaciones aplicables",
            "Obtener consentimiento de clientes cuando sea necesario",
            "Manejar de forma responsable los datos de clientes",
          ]} />
          <p>
            Nexora no se responsabiliza por el uso indebido de la plataforma por parte de sus usuarios.
          </p>
        </Section>

        <Section title="11. Cambios en la política de privacidad">
          <p>
            Nexora puede actualizar esta política de privacidad en cualquier momento para reflejar
            cambios en nuestros servicios o requisitos legales.
          </p>
          <p>
            Cuando se realicen cambios importantes se notificará a los usuarios a través de la
            plataforma o por correo electrónico.
          </p>
          <p>
            El uso continuo del servicio después de una actualización implica la aceptación de la
            nueva política.
          </p>
        </Section>

        <div className="border-t border-white/10 pt-8 mt-16 text-center">
          <p className="text-text-muted text-sm">
            © {new Date().getFullYear()} Nexora. Todos los derechos reservados.
          </p>
        </div>
      </main>
    </div>
  );
}
