# VML Paths Manager Tool 🛠️

Una herramienta de gestión y generación de paths de publicación diseñada específicamente para optimizar las tareas de los Project Managers, Leads y Publishers de VML, especialmente dentro de ecosistemas como Adobe Experience Manager (AEM).

## 📋 Requisitos
* Google Chrome (o cualquier navegador basado en Chromium).
* Los archivos de la extensión descargados en una carpeta local.

## 🚀 Instalación
1. Descarga o clona este repositorio en tu máquina.
2. Abre Google Chrome y navega a `chrome://extensions/`.
3. Activa el **"Modo de desarrollador"** (Developer mode) en el interruptor de la esquina superior derecha.
4. Haz clic en el botón **"Cargar extensión sin empaquetar"** (Load unpacked).
5. Selecciona la carpeta raíz que contiene el archivo `manifest.json`.
6. ¡Listo! Fija la extensión en tu barra de herramientas para un acceso rápido.

## 🏗️ Arquitectura de Carpetas

```text
vml-paths-manager-tool/
├── manifest.json                  # Configuración (Manifest V3)
├── assets/
│   └── logo-vml.png               # Branding
├── core/
│   ├── content.css                # Estilos inyectados
│   ├── modules-info.js            # Base de documentación in-app de la UI
│   ├── popup.css                  # Estilos de la UI
│   ├── popup.html                 # UI principal del popup
│   └── popup-ui.js                # Control de Tooltips y Versión de la UI
├── modules/
│   ├── publish-path-generator/    # Módulo: Publish Path Generator / Finder (Comentado/Oculto temporalmente)
│   └── jira-path-parser/          # Módulo: Jira AEM Path Parser
├── scratch/                       # Scripts de prueba del parseador de paths
└── Readme.md                      # Documentación del usuario
```

## ⚙️ Uso

### Jira AEM Path Parser 🎫 (Fase 1 Completada)
Módulo centralizado diseñado para escanear, analizar y consolidar de forma automática los paths de AEM descritos o comentados en los tickets de Jira.

* **Escaneo Automático con un Clic**:
  - Navega a cualquier ticket en tu servidor de Jira (ej. `jira.uhub.biz` o `*.atlassian.net`) y presiona **"SCAN ACTIVE JIRA TICKET"**.
  - El motor de scraping de la extensión capturará automáticamente la descripción del ticket y todo el historial de comentarios (soportando los contenedores `.comment-body`, `.action-body.floated` y `.action-body.flooded`).
* **Parseador de Texto Manual e HTML**:
  - Si prefieres, puedes pegar cualquier fragmento de texto o código fuente HTML directo de los comentarios en la sección *"Or Paste Jira Ticket Description/Comments"*.
  - La extensión sanitiza el HTML y unescapa caracteres especiales automáticamente (como `&gt;&gt;` -> `>>`), aislando de forma segura el texto y las rutas AEM.
* **Vinculación Dinámica e Inteligente**:
  - Identifica las URLs de AEM de tipo Sites, Assets, Fragmentos o Consolas de autoría.
  - Vincula de forma directa los elementos hijos declarados abajo con `>>` o `>>>` al path JCR de la carpeta contenedora.
  - **Filtro de Enlaces Sueltos**: El algoritmo descarta automáticamente URLs individuales que actúan como links de verificación y no poseen sub-elementos declarados abajo, evitando duplicados o basura en la lista.
* **Consolidación y Deduplicación**:
  - Si los componentes de una misma carpeta de AEM están dispersos a lo largo de varios comentarios del ticket, la herramienta los agrupa de forma automática bajo un único bloque JCR unificado.
* **Enlaces Directos de Edición ("Edit")**:
  - Genera botones **"Edit"** dinámicos al lado de cada sub-elemento que abren el fragmento de contenido o página directamente en el editor correspondiente de AEM (`/editor.html`).
* **Formatos de Copiado**:
  - **Copy JCR Paths**: Copia al portapapeles una lista limpia con las rutas JCR absolutas listas para herramientas internas o scripts.
  - **Copy Formatted**: Copia la lista de paths con el formato de publicación listo para pegar directamente en un comentario de Jira.

---

### Publish Path Finder & Generator (Módulo Oculto)
* Diseñado para acelerar la creación de tickets de publicación para **Content Fragments**, **Experience Fragments**, **Pages**, **VDM Author**, **Assets** (imágenes, videos, documentos) y **Carpetas de AEM (Assets, XFs, Sites, VDM)**.
* **Copia Inteligente de URL**:
  - Para *Content Fragments*: Convierte la URL del editor (`/editor.html/content/dam/...`) a la carpeta contenedora en Assets (`/assets.html/content/dam/...`) eliminando el último segmento de la URL.
  - Para *Experience Fragments*: Convierte la URL del editor (`ui#/aem/editor.html/content/experience-fragments/...`) a la carpeta contenedora (`/aem/experience-fragments.html/content/experience-fragments/...`) eliminando la variación final (ej. `master.html`).
  - Para *Pages*: Convierte la URL del editor (`ui#/aem/editor.html/content/...`) a la carpeta contenedora en Sites (`/sites.html/content/...`) eliminando el nombre de página final (ej. `f-rodriguez.html`).
  - Para *VDM Author*: Convierte la URL del editor (`/aem/vdm.html/edit/content/...`) a la consola contenedora en browse (`/aem/vdm.html/browse/content/...`) eliminando la última sección contextual (ej. `/options`).
  - Para *Assets* (Automático y Manual): Convierte el path del asset (`/content/dam/.../imagen.jpg`) a la URL de su carpeta contenedora en Assets DAM (`/assets.html/content/dam/...`) eliminando el nombre del archivo.
  - Para *Carpetas de AEM*: Estando parado sobre cualquier carpeta en consolas de AEM (Assets DAM, Experience Fragments, Sites o VDM), copia la URL limpia de la consola e incluye los títulos de todos los elementos contenidos en ella en formato de lista.
* **Detección Automática Híbrida de Assets**: Al abrir el módulo, la extensión realiza una búsqueda en segundo plano en dos etapas:
  - **DOM Scanner**: Escanea los inputs/textareas editables del DOM buscando paths `/content/dam/` con extensión.
  - **Sling JCR API Query**: Realiza una petición asíncrona al repositorio JCR del Content Fragment (`/content/dam/....3.json`) capturando de forma invisible y garantizada todos los assets del fragmento, resolviendo el problema de campos que aún no han sido renderizados o se encuentran en pestañas no activas.
  - **Indicador de Estado en Tiempo Real**: Esta sección cuenta con un elegante badge indicador de estado en su cabecera (`Scanning...`, `Auto-Detected`, o `Not Detected`) que refleja el resultado del escaneo de assets en tiempo real. Adicionalmente, cada fila de la lista se decora con un tag visual `Auto` para certificar su detección directa.
* **Copia Manual de Assets**: Cuenta con un área de texto dedicada para pegar de forma manual cualquier path de asset (ej. copiado de Excel) y generar su path formateado.
* **Extracción de Título o Nombre Nativo**: 
  - Para CFs y XFs: Captura el título real desde el DOM (`div.cfm-editor-title-fragment` o `div.editor-GlobalBar-pageTitle`).
  - Para VDM Author: Captura la sección activa (ej. `Options`, `Equipments`, `Specs`) desde el header.
  - Para Pages y Assets: Extrae el nombre o archivo directamente del final del path (eliminando la extensión `.html` si aplica).
  - Para Carpetas de AEM: Extrae el título real (`dc:title` o `jcr:title`) de cada elemento hijo del repositorio JCR vía Sling API (con fallback de raspado del DOM si la llamada API fallara).
* **Formato Listo para Tickets**: Copia al portapapeles una cadena formateada con la URL de la carpeta padre seguida de `>>> [Título/Nombre]`, lista para ser pegada en tus tickets de Jira o herramientas internas.

-------------------------------------------------
## 🛡️ Seguridad y Privacidad (AppSec)

Esta extensión ha sido desarrollada siguiendo estrictamente los altos estándares de seguridad y las mejores prácticas para **Manifest V3** de Chrome:

1. **Zero Data Tracking**: La extensión no recolecta, almacena, ni transmite ningún tipo de información. Todo el procesamiento ocurre de manera local en el navegador.
2. **XSS Protection (DOM Sanitization)**: Se evita el uso de `innerHTML` o `eval()`. La inyección de resaltado se realiza mediante `classList` y manipulación segura de nodos de texto.
3. **Prevención de CSS Injection**: Los estilos se inyectan mediante plantillas estáticas y validaciones estrictas.
4. **Iframe Traversal Seguro**: El algoritmo de búsqueda accede exclusivamente a iframes que cumplen con la política de **mismo origen (Same-Origin)**.
5. **Isolated World**: El script opera en un mundo aislado provisto por Chrome, garantizando que no pueda interferir con la lógica de negocio ni acceder a variables globales del sitio web.
6. **Permisos Mínimos**: Se utiliza `storage` para persistir preferencias y `activeTab` para validar la seguridad de la página.