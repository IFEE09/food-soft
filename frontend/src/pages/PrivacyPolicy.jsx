import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 sm:p-12">
        {/* Header */}
        <div className="mb-8 border-b pb-6">
          <h1 className="text-3xl font-bold text-gray-900">Política de Privacidad</h1>
          <p className="mt-2 text-sm text-gray-500">
            Última actualización: 10 de mayo de 2026
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Aplicable a: <strong>Horno 74</strong> — Sistema de pedidos Omnikook
          </p>
        </div>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">1. Responsable del tratamiento</h2>
            <p>
              <strong>Horno 74</strong> (en adelante, "nosotros" o "el Restaurante") es el responsable del
              tratamiento de los datos personales recopilados a través de nuestro sistema de pedidos
              en línea Omnikook, accesible mediante Facebook Messenger, WhatsApp e Instagram.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Datos que recopilamos</h2>
            <p>Al interactuar con nuestro bot de pedidos, podemos recopilar la siguiente información:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Nombre de usuario de la plataforma de mensajería (Facebook, WhatsApp, Instagram).</li>
              <li>Identificador único de usuario de la plataforma (ID de Messenger, número de WhatsApp).</li>
              <li>Contenido de los mensajes enviados al bot (texto de pedidos, dirección de entrega, nombre para el pedido).</li>
              <li>Historial de pedidos realizados a través del sistema.</li>
            </ul>
            <p className="mt-2">
              No recopilamos datos de pago directamente. Las transacciones se realizan en persona o
              a través de plataformas de pago externas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Finalidad del tratamiento</h2>
            <p>Utilizamos tus datos exclusivamente para:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Procesar y gestionar tus pedidos de alimentos.</li>
              <li>Comunicarte el estado de tu pedido y tiempo estimado de entrega.</li>
              <li>Recordar tu nombre y dirección para facilitar pedidos futuros (con tu consentimiento implícito al usar el servicio).</li>
              <li>Mejorar la calidad de nuestro servicio de atención al cliente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">4. Base legal</h2>
            <p>
              El tratamiento de tus datos se basa en la ejecución del contrato de servicio (tu pedido),
              en tu consentimiento al iniciar una conversación con nuestro bot, y en nuestro interés
              legítimo de operar el negocio de forma eficiente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Compartición de datos</h2>
            <p>
              No vendemos ni compartimos tus datos personales con terceros con fines comerciales.
              Tus datos pueden ser procesados por:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Meta Platforms, Inc.</strong> — como proveedor de la plataforma de mensajería (Facebook Messenger, Instagram, WhatsApp), sujeto a su propia <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Política de Privacidad</a>.</li>
              <li><strong>Railway</strong> — como proveedor de infraestructura en la nube donde se aloja el sistema.</li>
              <li><strong>DeepSeek</strong> — como proveedor del modelo de inteligencia artificial que interpreta los mensajes de texto de los pedidos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">6. Retención de datos</h2>
            <p>
              Conservamos el historial de pedidos durante un período de 12 meses para fines operativos
              y de soporte. Los datos de conversación en el bot (estado de sesión) se eliminan
              automáticamente tras 24 horas de inactividad.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">7. Tus derechos</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Acceder a los datos personales que tenemos sobre ti.</li>
              <li>Solicitar la corrección de datos inexactos.</li>
              <li>Solicitar la eliminación de tus datos.</li>
              <li>Oponerte al tratamiento de tus datos.</li>
            </ul>
            <p className="mt-2">
              Para ejercer cualquiera de estos derechos, contáctanos a través de nuestro Facebook
              Messenger o al número de WhatsApp de Horno 74.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">8. Seguridad</h2>
            <p>
              Implementamos medidas técnicas y organizativas razonables para proteger tus datos,
              incluyendo comunicaciones cifradas (HTTPS/TLS), autenticación segura y validación
              de firma criptográfica en todos los mensajes recibidos de Meta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">9. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta política periódicamente. La fecha de "última actualización"
              al inicio del documento refleja la versión vigente. Te recomendamos revisarla
              ocasionalmente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">10. Contacto</h2>
            <p>
              Si tienes preguntas sobre esta política de privacidad, puedes contactarnos a través
              de la página de Facebook de <strong>Horno 74</strong> o directamente por WhatsApp.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t text-center">
          <p className="text-xs text-gray-400">© 2026 Horno 74 · Todos los derechos reservados</p>
        </div>
      </div>
    </div>
  );
}
