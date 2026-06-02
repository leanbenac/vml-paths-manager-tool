# VML Paths Manager Tool 🛠️

Una suite de herramientas para Google Chrome diseñada específicamente para optimizar el flujo de trabajo de Project Managers, Leads y Publishers de VML, facilitando la gestión, extracción y generación de rutas de publicación (Publishing Paths) dentro del ecosistema de Adobe Experience Manager (AEM) y tickets de Jira.

---

## 📋 Requisitos e Instalación

1. **Requisitos**: Google Chrome (o cualquier navegador basado en Chromium).
2. **Instalación**:
   - Descarga o clona este repositorio en tu máquina.
   - Abre Google Chrome y navega a `chrome://extensions/`.
   - Activa el **"Modo de desarrollador"** (Developer mode) en la esquina superior derecha.
   - Haz clic en **"Cargar extensión sin empaquetar"** (Load unpacked).
   - Selecciona la carpeta raíz del proyecto (que contiene el archivo `manifest.json`).
   - Fija la extensión en la barra de herramientas para acceder con un clic.

---

## 🏗️ Arquitectura del Proyecto

```text
vml-paths-manager-tool/
├── manifest.json                  # Configuración de la extensión (Manifest V3)
├── assets/
│   └── logo-vml.png               # Logotipo y Branding
├── core/
│   ├── content.css                # Estilos inyectados en las pestañas
│   ├── modules-info.js            # Diccionario de documentación in-app
│   ├── popup.css                  # Estilos premium oscuros de la UI del popup
│   ├── popup.html                 # Estructura principal del popup
│   └── popup-ui.js                # Control de tooltips dinámicos de ayuda
├── modules/
│   ├── publish-path-generator/    # Módulo: Generador de Paths desde AEM (Oculto temporalmente)
│   └── jira-path-parser/          # Módulo: Extractor de Paths desde Jira (Activo)
├── scratch/                       # Scripts de prueba del parseador
└── Readme.md                      # Documentación del proyecto
```

---

## ⚙️ Descripción de los Módulos

La extensión cuenta con dos módulos principales diseñados para tareas opuestas pero complementarias:

### 1. Jira AEM Path Parser 🎫 (Módulo Activo)
Este módulo automatiza la **lectura y consolidación de paths de publicación** directamente desde los comentarios y descripciones de tickets de Jira, evitando el trabajo de buscar y verificar manualmente cada link.

* **Flujo de Un Solo Clic (Scan & Auto-Copy)**:
  - Estando en cualquier ticket de tu servidor de Jira (ej. `jira.uhub.biz` o `*.atlassian.net`), haz clic en **"SCAN ACTIVE JIRA TICKET"**.
  - El motor de scraping captura automáticamente la descripción del ticket y todo el historial de comentarios.
  - **Copiado al Portapapeles Automático**: Los paths detectados se procesan, clasifican y se copian directamente en tu portapapeles de manera automática.
* **Escaneo de Sub-tareas en Lote**:
  - Si el ticket tiene sub-tareas asociadas, el botón **"SCAN ALL SUB-TASKS"** se habilitará mostrando la cantidad de sub-tareas.
  - Al presionarlo, realiza peticiones asíncronas concurrentes a la API de Jira para compilar y unificar los paths de todas las sub-tareas en un solo paso.
* **Agrupación y Jerarquía Inteligente**:
  - Los resultados se clasifican automáticamente y se organizan bajo la siguiente jerarquía:
    1. **Assets**: Recursos de DAM, imágenes, videos o documentos (`/content/dam/...` excluyendo fragmentos).
    2. **VDM**: Páginas o consolas VDM (`/vdm` o `/vdm.html`).
    3. **CF (Content Fragments)**: Fragmentos de contenido (`/content/dam/.../cf/`).
    4. **XF (Experience Fragments)**: Fragmentos de experiencia (`/content/experience-fragments/...`).
    5. **Pages**: Páginas de sitios AEM (`/content/...` que no pertenezcan a las categorías anteriores).
  - Deduplica nombres de recursos de manera insensible a mayúsculas/minúsculas (ej. evita repetir `3 column` y `3 Column`).
* **Formato de Exportación Compacto**:
  - El formato copiado al portapapeles (o descargado) agrupa los elementos bajo una única cabecera por categoría, optimizando el espacio en los comentarios de Jira:
    ```text
    PUBLISHING PATH - CF

    https://author-p154363-e1620826.adobeaemcloud.com/assets.html/content/dam/na/cf/ford/en_ca/nameplate/mustang/2026/models/dark-horse-sc
    >>> settings
    >>> specs
    ```
  - **Botones Auxiliares**: Incluye botones para volver a copiar el formato consolidado (**COPY FORMATTED**) o descargar un archivo estructurado (**DOWNLOAD TXT**).

---

### 2. Publish Path Finder & Generator 🚀 (Módulo Oculto)
Este módulo realiza la tarea inversa: ayuda al usuario a **armar los paths de publicación** correctos a partir de la pestaña activa de AEM para luego poder crear tickets o comentarios en Jira.

* **Conversión de URLs del Editor a Consola**:
  - Detecta si estás posicionado sobre un editor de AEM y convierte automáticamente la URL activa en la ruta de su consola contenedora correspondiente:
    - **Pages**: De `/editor.html/content/.../pagina.html` a la carpeta contenedora en Sites (`/sites.html/content/...`).
    - **Content Fragments (CF)**: De `/editor.html/content/dam/...` a su carpeta contenedora en Assets DAM (`/assets.html/content/dam/...`).
    - **Experience Fragments (XF)**: De `/editor.html/content/experience-fragments/...` a su consola contenedora, removiendo la variación (ej. `/master.html`).
    - **VDM Author**: Convierte la edición de VDM a la consola de exploración (`/aem/vdm.html/browse/...`).
* **Detección Asíncrona de Assets**:
  - Cuenta con un **DOM Scanner** que busca paths DAM con extensiones en los campos de la página.
  - Emplea un **Sling JCR API Query** que consulta la estructura del fragmento en segundo plano (`/content/dam/....3.json`) para capturar de forma invisible e infalible todos los assets asociados al fragmento, incluso si están en campos ocultos o pestañas inactivas.
* **Formato Listo para Pegar**:
  - Copia la ruta de la carpeta contenedora seguida de `>>> [Título/Nombre del elemento]` para ser pegada en tus especificaciones de Jira.

---

## 🛡️ Seguridad y Privacidad (AppSec)

La extensión cumple estrictamente con los estándares recomendados por Google para **Manifest V3**:
1. **Zero Data Tracking**: No recopila, transmite ni almacena datos fuera del entorno local del navegador. Todo el procesamiento se realiza en memoria.
2. **Protección XSS**: Evita el uso de `eval()` e `innerHTML` dinámico sin sanitizar para evitar inyecciones maliciosas.
3. **Mismo Origen (Same-Origin)**: Accede de forma segura a los iframes de AEM validando políticas de origen cruzado.
4. **Permisos Mínimos**: Utiliza exclusivamente `storage` para recordar preferencias y `activeTab` para comunicarse con las pestañas activas del usuario de forma segura.