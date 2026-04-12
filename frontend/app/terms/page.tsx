/**
 * Términos de Uso — Agentro
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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background landing-bg">
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <img src="/logo-white.png" alt="Agentro" className="h-10 w-auto" />
          </Link>
          <Link href="/" className="text-sm text-text-muted hover:text-white transition">
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="heading-page text-4xl mb-3">Términos de Uso</h1>
        <p className="text-text-muted text-sm mb-12">Última actualización: 9 de marzo de 2026</p>

        <Section title="1. Introducción">
          <p>Bienvenido a Agentro.</p>
          <p>
            Estos Términos de Uso regulan el acceso y utilización de la plataforma Agentro, incluyendo
            el sitio web, aplicaciones, servicios, software, herramientas de inteligencia artificial y
            cualquier funcionalidad relacionada.
          </p>
          <p>
            Al acceder o utilizar Agentro, el usuario acepta quedar sujeto a estos términos. Si el
            usuario no está de acuerdo con alguna parte de estos términos, debe abstenerse de utilizar
            el servicio.
          </p>
        </Section>

        <Section title="2. Descripción del servicio">
          <p>
            Agentro es una plataforma tecnológica que permite a usuarios crear tiendas online y utilizar
            agentes de inteligencia artificial para interactuar con clientes, automatizar conversaciones
            y facilitar procesos de venta.
          </p>
          <p>Las funcionalidades de Agentro pueden incluir, entre otras:</p>
          <List items={[
            "Creación y gestión de tiendas online",
            "Gestión de productos y catálogos",
            "Interacción automatizada con clientes",
            "Agentes de inteligencia artificial",
            "Integración con plataformas de mensajería",
            "Seguimiento de pedidos",
            "Herramientas de gestión comercial",
          ]} />
          <p>
            Agentro se reserva el derecho de modificar o actualizar las funcionalidades del servicio en
            cualquier momento.
          </p>
        </Section>

        <Section title="3. Registro de usuario">
          <p>
            Para utilizar ciertas funcionalidades de Agentro, el usuario deberá crear una cuenta.
          </p>
          <p>El usuario se compromete a:</p>
          <List items={[
            "Proporcionar información veraz y actualizada",
            "Mantener la confidencialidad de sus credenciales",
            "Ser responsable de toda actividad realizada bajo su cuenta",
          ]} />
          <p>
            Agentro no será responsable por accesos no autorizados derivados del uso indebido de
            credenciales por parte del usuario.
          </p>
        </Section>

        <Section title="4. Uso permitido de la plataforma">
          <p>El usuario acepta utilizar Agentro únicamente para fines legales y legítimos.</p>
          <p>El usuario se compromete a no utilizar la plataforma para:</p>
          <List items={[
            "Actividades fraudulentas",
            "Distribución de contenido ilegal",
            "Envío de spam o mensajes masivos no solicitados",
            "Violación de derechos de terceros",
            "Manipulación indebida del sistema",
            "Intento de acceso no autorizado a la infraestructura",
          ]} />
          <p>
            Agentro se reserva el derecho de suspender o cancelar cuentas que incumplan estas normas.
          </p>
        </Section>

        <Section title="5. Uso de inteligencia artificial">
          <p>
            Agentro utiliza agentes de inteligencia artificial para generar respuestas automatizadas a
            clientes.
          </p>
          <p>El usuario reconoce que:</p>
          <List items={[
            "Las respuestas generadas por IA pueden contener errores",
            "Agentro no garantiza la exactitud absoluta de las respuestas generadas",
            "El usuario es responsable de supervisar las interacciones con clientes cuando lo considere necesario",
          ]} />
          <p>
            Agentro no será responsable por decisiones comerciales tomadas exclusivamente a partir de
            respuestas generadas por sistemas de inteligencia artificial.
          </p>
        </Section>

        <Section title="6. Datos de clientes">
          <p>
            Los usuarios pueden recopilar y gestionar información de sus propios clientes a través de
            la plataforma.
          </p>
          <p>El usuario es responsable de:</p>
          <List items={[
            "Cumplir con las leyes de protección de datos aplicables",
            "Obtener consentimiento de los clientes cuando sea necesario",
            "Utilizar la información únicamente para fines legítimos",
          ]} />
          <p>
            Agentro actúa únicamente como proveedor de infraestructura tecnológica y no es responsable
            por el uso que los usuarios hagan de los datos de clientes.
          </p>
        </Section>

        <Section title="7. Integraciones externas">
          <p>
            La plataforma Agentro puede integrarse con servicios de terceros como plataformas de
            mensajería, proveedores de pago u otras herramientas externas.
          </p>
          <p>
            El uso de dichas integraciones puede estar sujeto a términos y condiciones adicionales
            establecidos por dichos proveedores.
          </p>
          <p>
            Agentro no se responsabiliza por interrupciones, cambios o limitaciones impuestas por
            servicios externos.
          </p>
        </Section>

        <Section title="8. Contenido del usuario">
          <p>
            Los usuarios pueden cargar contenido dentro de la plataforma, incluyendo:
          </p>
          <List items={[
            "Imágenes",
            "Descripciones de productos",
            "Mensajes",
            "Datos comerciales",
          ]} />
          <p>El usuario conserva la propiedad sobre dicho contenido.</p>
          <p>
            Sin embargo, al utilizar Agentro, el usuario concede a la plataforma una licencia limitada
            para almacenar, procesar y mostrar dicho contenido con el único fin de proporcionar el
            servicio.
          </p>
        </Section>

        <Section title="9. Disponibilidad del servicio">
          <p>Agentro se esfuerza por mantener el servicio disponible de forma continua.</p>
          <p>
            Sin embargo, el usuario reconoce que pueden ocurrir interrupciones debido a:
          </p>
          <List items={[
            "Mantenimiento del sistema",
            "Actualizaciones de software",
            "Fallos técnicos",
            "Problemas en servicios externos",
            "Causas fuera del control de Agentro",
          ]} />
          <p>Agentro no garantiza disponibilidad ininterrumpida del servicio.</p>
        </Section>

        <Section title="10. Limitación de responsabilidad">
          <p>
            En la medida máxima permitida por la ley, Agentro no será responsable por:
          </p>
          <List items={[
            "Pérdidas comerciales",
            "Pérdida de datos",
            "Interrupciones del negocio",
            "Daños indirectos o consecuenciales",
            "Decisiones comerciales tomadas por los usuarios",
          ]} />
          <p>El uso de la plataforma se realiza bajo la responsabilidad exclusiva del usuario.</p>
        </Section>

        <Section title="11. Suspensión o terminación de cuentas">
          <p>Agentro se reserva el derecho de suspender o cancelar cuentas que:</p>
          <List items={[
            "Violen estos términos",
            "Utilicen la plataforma de manera abusiva",
            "Representen un riesgo para la seguridad del sistema",
            "Incumplan normativas legales aplicables",
          ]} />
          <p>
            La terminación de una cuenta puede implicar la pérdida de acceso a ciertos datos
            almacenados en la plataforma.
          </p>
        </Section>

        <Section title="12. Propiedad intelectual">
          <p>
            Todos los derechos relacionados con la plataforma Agentro, incluyendo software, diseño,
            código, logotipos y funcionalidades, pertenecen a Agentro o a sus respectivos titulares.
          </p>
          <p>
            Queda prohibida la reproducción, distribución o modificación del software sin autorización
            previa.
          </p>
        </Section>

        <Section title="13. Modificaciones del servicio">
          <p>
            Agentro puede modificar, suspender o eliminar funcionalidades del servicio en cualquier
            momento. Estas modificaciones pueden incluir:
          </p>
          <List items={[
            "Cambios en características",
            "Mejoras en el sistema",
            "Modificaciones en integraciones",
            "Ajustes técnicos necesarios",
          ]} />
          <p>
            Agentro no será responsable por posibles impactos derivados de estas modificaciones.
          </p>
        </Section>

        <Section title="14. Cambios en los términos">
          <p>Agentro puede actualizar estos Términos de Uso en cualquier momento.</p>
          <p>
            Cuando se realicen cambios significativos, los usuarios serán notificados a través de la
            plataforma o por correo electrónico.
          </p>
          <p>
            El uso continuado del servicio implica la aceptación de los términos actualizados.
          </p>
        </Section>

        <Section title="15. Terminación del servicio">
          <p>El usuario puede dejar de utilizar Agentro en cualquier momento.</p>
          <p>
            La eliminación de una cuenta puede implicar la eliminación de datos asociados, salvo
            aquellos que deban conservarse por razones legales u operativas.
          </p>
        </Section>

        <Section title="16. Legislación aplicable">
          <p>
            Estos términos se regirán por las leyes aplicables en la jurisdicción correspondiente al
            proveedor del servicio.
          </p>
          <p>
            Cualquier disputa relacionada con estos términos será resuelta conforme a dichas leyes.
          </p>
        </Section>

        <div className="border-t border-white/10 pt-8 mt-16 text-center">
          <p className="text-text-muted text-sm">
            © {new Date().getFullYear()} Agentro. Todos los derechos reservados.
          </p>
        </div>
      </main>
    </div>
  );
}
