export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 sm:p-12">

        {/* Header */}
        <div className="mb-8 border-b pb-6">
          <h1 className="text-3xl font-bold text-gray-900">Política de Privacidad</h1>
          <p className="mt-1 text-sm text-gray-500">
            <em>Privacy Policy</em> — Versión bilingüe / Bilingual version
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Última actualización / Last updated: <strong>10 de mayo de 2026</strong>
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Aplicable a / Applicable to: <strong>Horno 74</strong> — Sistema de pedidos Omnikook
          </p>
        </div>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">

          {/* ── 1. Responsable ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              1. Responsable del tratamiento de datos personales
            </h2>
            <p>
              <strong>Horno 74</strong> (en adelante, "nosotros", "el Restaurante" o "el Responsable")
              es el responsable del tratamiento de los datos personales recopilados a través del
              sistema de pedidos en línea <strong>Omnikook</strong>, accesible mediante Facebook
              Messenger, WhatsApp e Instagram.
            </p>
            <p className="mt-2">
              Para efectos de la <em>Ley Federal de Protección de Datos Personales en Posesión de
              los Particulares</em> (LFPDPPP) de México, el domicilio del Responsable se encuentra
              en el Estado de Yucatán, México. Para efectos de la legislación de California
              (CalOPPA / CCPA), el Responsable opera como un negocio de alimentos que recopila
              información personal de usuarios en línea.
            </p>
          </section>

          {/* ── 2. Datos ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              2. Datos personales que recopilamos
            </h2>
            <p>Al interactuar con nuestro bot de pedidos, recopilamos la siguiente información:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Nombre de usuario de la plataforma de mensajería (Facebook, WhatsApp, Instagram).</li>
              <li>Identificador único de usuario de la plataforma (ID de Messenger, número de WhatsApp).</li>
              <li>Contenido de los mensajes enviados al bot (texto de pedidos, dirección de entrega, nombre para el pedido).</li>
              <li>Historial de pedidos realizados a través del sistema.</li>
            </ul>
            <p className="mt-2">
              <strong>Datos que NO recopilamos:</strong> No recopilamos datos de pago, números de
              tarjeta de crédito ni información financiera directamente. Las transacciones se
              realizan en persona o a través de plataformas de pago externas. No recopilamos datos
              biométricos, de salud ni datos sensibles en los términos del Art. 3, fracción VI de
              la LFPDPPP.
            </p>
            <p className="mt-2">
              <strong>Cookies:</strong> El sitio web de Omnikook puede utilizar cookies técnicas
              estrictamente necesarias para el funcionamiento de la sesión. No utilizamos cookies
              de seguimiento, publicidad ni análisis de comportamiento de terceros.
            </p>
          </section>

          {/* ── 3. Finalidad ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              3. Finalidad del tratamiento
            </h2>
            <p>Utilizamos tus datos personales exclusivamente para las siguientes finalidades <strong>primarias</strong> (necesarias para el servicio):</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Procesar y gestionar tus pedidos de alimentos.</li>
              <li>Comunicarte el estado de tu pedido y el tiempo estimado de entrega.</li>
              <li>Recordar tu nombre y dirección para facilitar pedidos futuros.</li>
              <li>Atender consultas, aclaraciones o reclamaciones relacionadas con tus pedidos.</li>
            </ul>
            <p className="mt-2">
              No utilizamos tus datos para finalidades <strong>secundarias</strong> (mercadotecnia,
              publicidad o prospección comercial) sin tu consentimiento expreso.
            </p>
          </section>

          {/* ── 4. Base legal ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              4. Base legal del tratamiento
            </h2>
            <p>
              El tratamiento de tus datos personales se basa en: (a) la <strong>ejecución del
              contrato de servicio</strong> que se formaliza al realizar un pedido; (b) tu
              <strong> consentimiento tácito</strong> al iniciar una conversación con nuestro bot
              de pedidos, conforme al Art. 8 de la LFPDPPP; y (c) nuestro <strong>interés
              legítimo</strong> de operar el negocio de forma eficiente y segura.
            </p>
          </section>

          {/* ── 5. Transferencias ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              5. Transferencias y remisiones de datos
            </h2>
            <p>
              No vendemos ni cedemos tus datos personales a terceros con fines comerciales.
              Para operar el servicio, tus datos pueden ser procesados por los siguientes
              <strong> encargados del tratamiento</strong>, ubicados fuera de México (transferencia
              internacional conforme al Art. 36 de la LFPDPPP):
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-200 px-3 py-2 text-left">Proveedor</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">País</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Finalidad</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Política de privacidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Meta Platforms, Inc.</td>
                    <td className="border border-gray-200 px-3 py-2">EUA</td>
                    <td className="border border-gray-200 px-3 py-2">Plataforma de mensajería (Messenger, WhatsApp, Instagram)</td>
                    <td className="border border-gray-200 px-3 py-2">
                      <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">facebook.com/privacy</a>
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">Railway (PBC)</td>
                    <td className="border border-gray-200 px-3 py-2">EUA</td>
                    <td className="border border-gray-200 px-3 py-2">Infraestructura en la nube (alojamiento del sistema)</td>
                    <td className="border border-gray-200 px-3 py-2">
                      <a href="https://railway.app/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">railway.app/legal/privacy</a>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">DeepSeek (High-Flyer AI)</td>
                    <td className="border border-gray-200 px-3 py-2">China</td>
                    <td className="border border-gray-200 px-3 py-2">Modelo de inteligencia artificial para interpretar mensajes de pedidos</td>
                    <td className="border border-gray-200 px-3 py-2">
                      <a href="https://www.deepseek.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">deepseek.com/privacy</a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Al usar nuestro servicio, consientes expresamente la transferencia internacional de
              tus datos a los proveedores indicados, conforme al Art. 36 de la LFPDPPP.
            </p>
          </section>

          {/* ── 6. Retención ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              6. Retención de datos
            </h2>
            <p>
              Conservamos el historial de pedidos durante un período de <strong>12 meses</strong>
              contados a partir de la fecha del pedido, para fines operativos y de soporte al
              cliente. Los datos de sesión del bot (estado de conversación) se eliminan
              automáticamente tras <strong>24 horas de inactividad</strong>. Una vez cumplida la
              finalidad y los plazos legales aplicables, los datos serán cancelados o disociados.
            </p>
          </section>

          {/* ── 7. Derechos ARCO ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              7. Derechos ARCO (México) y derechos de privacidad (EUA)
            </h2>

            <h3 className="font-semibold text-gray-700 mt-3 mb-1">7.1 Derechos ARCO — LFPDPPP</h3>
            <p>
              Conforme a la <em>Ley Federal de Protección de Datos Personales en Posesión de los
              Particulares</em> y su Reglamento, tienes derecho a:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Acceso:</strong> conocer qué datos personales tenemos sobre ti y cómo los usamos.</li>
              <li><strong>Rectificación:</strong> solicitar la corrección de datos inexactos o incompletos.</li>
              <li><strong>Cancelación:</strong> solicitar la supresión de tus datos cuando ya no sean necesarios para la finalidad que motivó su tratamiento.</li>
              <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos para finalidades específicas.</li>
            </ul>
            <p className="mt-2">
              Para ejercer tus derechos ARCO, envía una solicitud a través de nuestro WhatsApp
              o la página de Facebook de Horno 74, indicando: (a) nombre completo, (b) descripción
              clara del derecho que deseas ejercer y (c) cualquier documento que facilite la
              localización de tus datos. Responderemos en un plazo máximo de <strong>20 días
              hábiles</strong> contados a partir de la recepción de tu solicitud, conforme al
              Art. 32 de la LFPDPPP. Si la solicitud procede, los cambios se harán efectivos
              en un plazo de <strong>15 días hábiles</strong> adicionales.
            </p>
            <p className="mt-2">
              Tienes derecho a revocar tu consentimiento en cualquier momento, sin que ello tenga
              efectos retroactivos, mediante el mismo canal de contacto.
            </p>

            <h3 className="font-semibold text-gray-700 mt-4 mb-1">7.2 Derechos bajo la ley de California (CCPA / CPRA)</h3>
            <p>
              Si eres residente del Estado de California, EUA, tienes los siguientes derechos
              adicionales conforme a la <em>California Consumer Privacy Act</em> (CCPA) y la
              <em> California Privacy Rights Act</em> (CPRA):
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Derecho a saber:</strong> solicitar información sobre las categorías y datos específicos que recopilamos sobre ti.</li>
              <li><strong>Derecho a eliminar:</strong> solicitar la eliminación de tu información personal, sujeto a ciertas excepciones.</li>
              <li><strong>Derecho a corregir:</strong> solicitar la corrección de información personal inexacta.</li>
              <li><strong>Derecho a no discriminación:</strong> no recibirás un trato discriminatorio por ejercer tus derechos de privacidad.</li>
              <li>
                <strong>Derecho a no vender ni compartir:</strong> no vendemos ni compartimos tu
                información personal con terceros para fines de publicidad cruzada. Si deseas
                confirmación explícita, contáctanos.
              </li>
            </ul>
            <p className="mt-2">
              Para ejercer tus derechos bajo la CCPA/CPRA, contáctanos a través de los canales
              indicados en la Sección 10. Responderemos en un plazo de <strong>45 días
              calendario</strong>, con posibilidad de extensión de 45 días adicionales en casos
              complejos.
            </p>
          </section>

          {/* ── 8. Menores ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              8. Menores de edad
            </h2>
            <p>
              Nuestro servicio <strong>no está dirigido a personas menores de 13 años</strong>.
              No recopilamos intencionalmente datos personales de menores de 13 años. Si eres
              padre, madre o tutor y tienes conocimiento de que un menor nos ha proporcionado
              datos personales, contáctanos de inmediato para que podamos eliminar dicha
              información. Lo anterior es conforme a la <em>Children's Online Privacy Protection
              Act</em> (COPPA) de EUA y a los principios de protección de datos de la LFPDPPP.
            </p>
          </section>

          {/* ── 9. Seguridad ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              9. Medidas de seguridad
            </h2>
            <p>
              Implementamos medidas técnicas y organizativas razonables para proteger tus datos
              personales contra acceso no autorizado, pérdida, alteración o divulgación, incluyendo:
              comunicaciones cifradas (HTTPS/TLS), autenticación segura con tokens JWT, validación
              de firma criptográfica (HMAC-SHA256) en todos los mensajes recibidos de Meta, y
              acceso restringido a la base de datos por roles.
            </p>
            <p className="mt-2">
              En caso de una vulneración de seguridad que afecte significativamente tus derechos
              patrimoniales o morales, te notificaremos a través de los canales disponibles en
              el menor tiempo posible, conforme al Art. 20 de la LFPDPPP.
            </p>
          </section>

          {/* ── 10. Cookies ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              10. Cookies y tecnologías de rastreo
            </h2>
            <p>
              El sistema Omnikook utiliza únicamente <strong>cookies técnicas de sesión</strong>
              estrictamente necesarias para el funcionamiento de la autenticación en el panel
              de administración. No utilizamos cookies de publicidad, rastreo de comportamiento
              ni análisis de terceros (Google Analytics, Facebook Pixel u otros). Al usar el
              sistema, aceptas el uso de estas cookies técnicas.
            </p>
            <p className="mt-2">
              Conforme a la <em>California Online Privacy Protection Act</em> (CalOPPA), esta
              política describe nuestras prácticas de cookies. Puedes configurar tu navegador
              para rechazar cookies, aunque esto puede afectar la funcionalidad del panel de
              administración.
            </p>
          </section>

          {/* ── 11. Cambios ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              11. Cambios a esta política
            </h2>
            <p>
              Podemos actualizar esta política periódicamente para reflejar cambios en nuestras
              prácticas o en la legislación aplicable. La fecha de "última actualización" al
              inicio del documento refleja la versión vigente. Te recomendamos revisarla
              ocasionalmente. Los cambios sustanciales serán notificados a través de nuestros
              canales de mensajería.
            </p>
          </section>

          {/* ── 12. Contacto ── */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              12. Contacto y autoridad competente
            </h2>
            <p>
              Para ejercer tus derechos ARCO, presentar una queja o hacer cualquier consulta
              sobre esta política, contáctanos a través de:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>La página de Facebook de <strong>Horno 74</strong> (Messenger)</li>
              <li>WhatsApp de Horno 74</li>
            </ul>
            <p className="mt-3">
              Si consideras que tu solicitud no fue atendida satisfactoriamente, tienes derecho
              a acudir ante el <strong>Instituto Nacional de Transparencia, Acceso a la
              Información y Protección de Datos Personales (INAI)</strong> en México
              (<a href="https://home.inai.org.mx" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">home.inai.org.mx</a>),
              o ante la <strong>California Privacy Protection Agency (CPPA)</strong> si eres
              residente de California
              (<a href="https://cppa.ca.gov" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">cppa.ca.gov</a>).
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t text-center">
          <p className="text-xs text-gray-400">
            © 2026 Horno 74 · Todos los derechos reservados ·{' '}
            Cumple con LFPDPPP (México) · CalOPPA · CCPA/CPRA · COPPA (EUA)
          </p>
        </div>
      </div>
    </div>
  );
}
