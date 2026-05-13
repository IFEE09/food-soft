// Colores fijos de marca — sin modo claro/oscuro
const B = {
  bg:        '#0D0D0D',   // Eerie Black
  surface:   '#141414',   // surface
  border:    '#333333',
  text:      '#FFFFFF',   // Pure White
  muted:     '#808080',   // Smoke Gray
  lime:      'var(--accent-blue)',   // Cyber Lime
  link:      'var(--accent-blue)',
};

const S = {
  page:    { minHeight: '100vh', background: B.bg, color: B.text, fontFamily: 'Inter, sans-serif', padding: '3rem 1rem' },
  wrap:    { maxWidth: '760px', margin: '0 auto' },
  header:  { borderBottom: `1px solid ${B.border}`, paddingBottom: '1.5rem', marginBottom: '2.5rem' },
  h1:      { fontSize: '1.75rem', fontWeight: 700, color: B.text, marginBottom: '0.5rem' },
  meta:    { fontSize: '0.8rem', color: B.muted, marginTop: '0.25rem' },
  section: { marginBottom: '2rem' },
  h2:      { fontSize: '1rem', fontWeight: 600, color: B.lime, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' },
  h3:      { fontSize: '0.85rem', fontWeight: 600, color: B.text, marginTop: '1rem', marginBottom: '0.5rem' },
  p:       { fontSize: '0.875rem', color: B.muted, lineHeight: '1.7', marginBottom: '0.75rem' },
  ul:      { paddingLeft: '1.25rem', fontSize: '0.875rem', color: B.muted, lineHeight: '1.7', marginBottom: '0.75rem' },
  li:      { marginBottom: '0.3rem' },
  strong:  { color: B.text },
  a:       { color: B.lime, textDecoration: 'underline' },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: '0.75rem' },
  th:      { border: `1px solid ${B.border}`, padding: '8px 12px', textAlign: 'left', color: B.lime, background: '#1A1A1A', fontWeight: 600 },
  td:      { border: `1px solid ${B.border}`, padding: '8px 12px', color: B.muted },
  footer:  { borderTop: `1px solid ${B.border}`, paddingTop: '1.5rem', marginTop: '2.5rem', textAlign: 'center', fontSize: '0.7rem', color: B.muted },
  logo:    { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' },
};

export default function PrivacyPolicy() {
  return (
    <div style={S.page}>
      <div style={S.wrap}>

        {/* Logo */}
        <div style={S.logo}>
          <img src="/omnikook-logo.png" alt="omnikook" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          <span style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
            <span style={{ color: B.lime }}>o</span><span style={{ color: B.text }}>mnikook</span>
          </span>
        </div>

        {/* Header */}
        <div style={S.header}>
          <h1 style={S.h1}>Política de Privacidad</h1>
          <p style={S.meta}><em>Privacy Policy</em> — Versión bilingüe / Bilingual version</p>
          <p style={S.meta}>Última actualización / Last updated: <strong style={S.strong}>10 de mayo de 2026</strong></p>
          <p style={S.meta}>Aplicable a / Applicable to: <strong style={S.strong}>Horno 74</strong> — Sistema de pedidos Omnikook</p>
        </div>

        {/* 1 */}
        <section style={S.section}>
          <h2 style={S.h2}>1. Responsable del tratamiento</h2>
          <p style={S.p}>
            <strong style={S.strong}>Horno 74</strong> (en adelante "el Responsable") es responsable del tratamiento
            de los datos personales recopilados a través del sistema <strong style={S.strong}>Omnikook</strong>,
            accesible mediante Facebook Messenger, WhatsApp e Instagram.
          </p>
          <p style={S.p}>
            Para efectos de la <em>Ley Federal de Protección de Datos Personales en Posesión de los Particulares</em> (LFPDPPP)
            de México, el domicilio del Responsable se encuentra en el Estado de Yucatán, México. Para efectos de la
            legislación de California (CalOPPA / CCPA), el Responsable opera como un negocio de alimentos que recopila
            información personal de usuarios en línea.
          </p>
        </section>

        {/* 2 */}
        <section style={S.section}>
          <h2 style={S.h2}>2. Datos personales que recopilamos</h2>
          <p style={S.p}>Al interactuar con nuestro bot de pedidos, recopilamos:</p>
          <ul style={S.ul}>
            <li style={S.li}>Nombre de usuario de la plataforma de mensajería.</li>
            <li style={S.li}>Identificador único de usuario (ID de Messenger, número de WhatsApp).</li>
            <li style={S.li}>Contenido de mensajes enviados al bot (texto de pedidos, dirección de entrega, nombre para el pedido).</li>
            <li style={S.li}>Historial de pedidos realizados a través del sistema.</li>
          </ul>
          <p style={S.p}>
            <strong style={S.strong}>Datos que NO recopilamos:</strong> No recopilamos datos de pago, números de tarjeta
            de crédito ni información financiera. No recopilamos datos biométricos, de salud ni datos sensibles.
          </p>
          <p style={S.p}>
            <strong style={S.strong}>Cookies:</strong> El sitio web puede utilizar cookies técnicas estrictamente
            necesarias para el funcionamiento de la sesión. No utilizamos cookies de seguimiento, publicidad ni
            análisis de comportamiento de terceros.
          </p>
        </section>

        {/* 3 */}
        <section style={S.section}>
          <h2 style={S.h2}>3. Finalidad del tratamiento</h2>
          <p style={S.p}>Utilizamos tus datos exclusivamente para:</p>
          <ul style={S.ul}>
            <li style={S.li}>Procesar y gestionar tus pedidos de alimentos.</li>
            <li style={S.li}>Comunicarte el estado de tu pedido y el tiempo estimado de entrega.</li>
            <li style={S.li}>Recordar tu nombre y dirección para facilitar pedidos futuros.</li>
            <li style={S.li}>Atender consultas, aclaraciones o reclamaciones relacionadas con tus pedidos.</li>
          </ul>
          <p style={S.p}>No utilizamos tus datos para mercadotecnia ni publicidad sin tu consentimiento expreso.</p>
        </section>

        {/* 4 */}
        <section style={S.section}>
          <h2 style={S.h2}>4. Base legal del tratamiento</h2>
          <p style={S.p}>
            El tratamiento se basa en: (a) la <strong style={S.strong}>ejecución del contrato de servicio</strong> al
            realizar un pedido; (b) tu <strong style={S.strong}>consentimiento tácito</strong> al iniciar una
            conversación con nuestro bot, conforme al Art. 8 de la LFPDPPP; y (c) nuestro{' '}
            <strong style={S.strong}>interés legítimo</strong> de operar el negocio de forma eficiente y segura.
          </p>
        </section>

        {/* 5 */}
        <section style={S.section}>
          <h2 style={S.h2}>5. Transferencias internacionales de datos</h2>
          <p style={S.p}>
            No vendemos ni cedemos tus datos a terceros con fines comerciales. Para operar el servicio, tus datos
            pueden ser procesados por los siguientes proveedores fuera de México (Art. 36 LFPDPPP):
          </p>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Proveedor</th>
                <th style={S.th}>País</th>
                <th style={S.th}>Finalidad</th>
                <th style={S.th}>Política de privacidad</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>Meta Platforms, Inc.</td>
                <td style={S.td}>EUA</td>
                <td style={S.td}>Plataforma de mensajería (Messenger, WhatsApp, Instagram)</td>
                <td style={S.td}><a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" style={S.a}>facebook.com/privacy</a></td>
              </tr>
              <tr>
                <td style={S.td}>Railway (PBC)</td>
                <td style={S.td}>EUA</td>
                <td style={S.td}>Infraestructura en la nube (alojamiento del sistema)</td>
                <td style={S.td}><a href="https://railway.app/legal/privacy" target="_blank" rel="noopener noreferrer" style={S.a}>railway.app/legal/privacy</a></td>
              </tr>
              <tr>
                <td style={S.td}>DeepSeek (High-Flyer AI)</td>
                <td style={S.td}>China</td>
                <td style={S.td}>Modelo de IA para interpretar mensajes de pedidos</td>
                <td style={S.td}><a href="https://www.deepseek.com/privacy" target="_blank" rel="noopener noreferrer" style={S.a}>deepseek.com/privacy</a></td>
              </tr>
            </tbody>
          </table>
          <p style={{ ...S.p, marginTop: '0.75rem', fontSize: '0.75rem' }}>
            Al usar nuestro servicio, consientes expresamente la transferencia internacional de tus datos a los
            proveedores indicados, conforme al Art. 36 de la LFPDPPP.
          </p>
        </section>

        {/* 6 */}
        <section style={S.section}>
          <h2 style={S.h2}>6. Retención de datos</h2>
          <p style={S.p}>
            Conservamos el historial de pedidos durante <strong style={S.strong}>12 meses</strong> desde la fecha del
            pedido. Los datos de sesión del bot se eliminan automáticamente tras{' '}
            <strong style={S.strong}>24 horas de inactividad</strong>. Una vez cumplida la finalidad, los datos serán
            cancelados o disociados.
          </p>
        </section>

        {/* 7 */}
        <section style={S.section}>
          <h2 style={S.h2}>7. Derechos ARCO (México) y derechos de privacidad (EUA)</h2>

          <h3 style={S.h3}>7.1 Derechos ARCO — LFPDPPP</h3>
          <p style={S.p}>Conforme a la LFPDPPP, tienes derecho a:</p>
          <ul style={S.ul}>
            <li style={S.li}><strong style={S.strong}>Acceso:</strong> conocer qué datos tenemos sobre ti y cómo los usamos.</li>
            <li style={S.li}><strong style={S.strong}>Rectificación:</strong> solicitar la corrección de datos inexactos o incompletos.</li>
            <li style={S.li}><strong style={S.strong}>Cancelación:</strong> solicitar la supresión de tus datos cuando ya no sean necesarios.</li>
            <li style={S.li}><strong style={S.strong}>Oposición:</strong> oponerte al tratamiento de tus datos para finalidades específicas.</li>
          </ul>
          <p style={S.p}>
            Para ejercer tus derechos ARCO, contáctanos por WhatsApp o Messenger de Horno 74 indicando: (a) nombre
            completo, (b) derecho que deseas ejercer y (c) documentos de apoyo. Responderemos en un máximo de{' '}
            <strong style={S.strong}>20 días hábiles</strong> (Art. 32 LFPDPPP). Si procede, los cambios se harán
            efectivos en <strong style={S.strong}>15 días hábiles</strong> adicionales.
          </p>

          <h3 style={S.h3}>7.2 Derechos bajo la ley de California (CCPA / CPRA)</h3>
          <p style={S.p}>Si eres residente de California, tienes derecho a:</p>
          <ul style={S.ul}>
            <li style={S.li}><strong style={S.strong}>Derecho a saber:</strong> solicitar información sobre los datos que recopilamos.</li>
            <li style={S.li}><strong style={S.strong}>Derecho a eliminar:</strong> solicitar la eliminación de tu información personal.</li>
            <li style={S.li}><strong style={S.strong}>Derecho a corregir:</strong> solicitar la corrección de información inexacta.</li>
            <li style={S.li}><strong style={S.strong}>Derecho a no discriminación:</strong> no recibirás trato discriminatorio por ejercer tus derechos.</li>
            <li style={S.li}><strong style={S.strong}>Derecho a no vender:</strong> no vendemos ni compartimos tu información con terceros para publicidad cruzada.</li>
          </ul>
          <p style={S.p}>
            Responderemos solicitudes CCPA/CPRA en un plazo de <strong style={S.strong}>45 días calendario</strong>,
            con posibilidad de extensión de 45 días adicionales en casos complejos.
          </p>
        </section>

        {/* 8 */}
        <section style={S.section}>
          <h2 style={S.h2}>8. Menores de edad</h2>
          <p style={S.p}>
            Nuestro servicio <strong style={S.strong}>no está dirigido a personas menores de 13 años</strong>. No
            recopilamos intencionalmente datos de menores. Si eres padre, madre o tutor y tienes conocimiento de que
            un menor nos ha proporcionado datos, contáctanos de inmediato. Conforme a COPPA (EUA) y LFPDPPP (México).
          </p>
        </section>

        {/* 9 */}
        <section style={S.section}>
          <h2 style={S.h2}>9. Medidas de seguridad</h2>
          <p style={S.p}>
            Implementamos medidas técnicas y organizativas para proteger tus datos: comunicaciones cifradas (HTTPS/TLS),
            autenticación segura con tokens JWT, validación de firma criptográfica (HMAC-SHA256) en mensajes de Meta,
            y acceso restringido a la base de datos por roles.
          </p>
          <p style={S.p}>
            En caso de vulneración de seguridad que afecte tus derechos, te notificaremos en el menor tiempo posible,
            conforme al Art. 20 de la LFPDPPP.
          </p>
        </section>

        {/* 10 */}
        <section style={S.section}>
          <h2 style={S.h2}>10. Cookies y tecnologías de rastreo</h2>
          <p style={S.p}>
            El sistema utiliza únicamente <strong style={S.strong}>cookies técnicas de sesión</strong> necesarias para
            la autenticación en el panel de administración. No utilizamos cookies de publicidad, rastreo de
            comportamiento ni análisis de terceros. Conforme a CalOPPA, puedes configurar tu navegador para rechazar
            cookies, aunque esto puede afectar la funcionalidad del panel.
          </p>
        </section>

        {/* 11 */}
        <section style={S.section}>
          <h2 style={S.h2}>11. Cambios a esta política</h2>
          <p style={S.p}>
            Podemos actualizar esta política periódicamente. La fecha de "última actualización" al inicio del documento
            refleja la versión vigente. Los cambios sustanciales serán notificados a través de nuestros canales de
            mensajería.
          </p>
        </section>

        {/* 12 */}
        <section style={S.section}>
          <h2 style={S.h2}>12. Contacto y autoridad competente</h2>
          <p style={S.p}>Para ejercer tus derechos o hacer consultas, contáctanos a través de:</p>
          <ul style={S.ul}>
            <li style={S.li}>La página de Facebook de <strong style={S.strong}>Horno 74</strong> (Messenger)</li>
            <li style={S.li}>WhatsApp de Horno 74</li>
          </ul>
          <p style={S.p}>
            Si tu solicitud no fue atendida satisfactoriamente, puedes acudir ante el{' '}
            <strong style={S.strong}>INAI</strong> en México (
            <a href="https://home.inai.org.mx" target="_blank" rel="noopener noreferrer" style={S.a}>home.inai.org.mx</a>
            ), o ante la <strong style={S.strong}>California Privacy Protection Agency (CPPA)</strong> si eres
            residente de California (
            <a href="https://cppa.ca.gov" target="_blank" rel="noopener noreferrer" style={S.a}>cppa.ca.gov</a>).
          </p>
        </section>

        {/* Footer */}
        <div style={S.footer}>
          <p>© 2026 Horno 74 · Todos los derechos reservados · Cumple con LFPDPPP (México) · CalOPPA · CCPA/CPRA · COPPA (EUA)</p>
        </div>

      </div>
    </div>
  );
}
