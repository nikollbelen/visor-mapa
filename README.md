# 🏘️ Proyecto Inmobiliario 3D - Mikonos

Una aplicación web interactiva desarrollada con React, TypeScript y Cesium para la visualización 3D de un proyecto inmobiliario. La aplicación permite explorar lotes, áreas comunes, entorno y servicios de manera inmersiva.

## 🚀 Características Principales

### 🗺️ Visualización 3D
- **Motor 3D**: Cesium.js para renderizado 3D de alta calidad
- **Navegación**: Controles intuitivos para explorar el terreno
- **Vista 2D/3D**: Alternancia entre vistas planas y tridimensionales
- **Grid**: Visualización de cuadrícula para mediciones precisas

### 🏠 Gestión de Lotes
- **Catálogo de Lotes**: Visualización de todos los lotes disponibles
- **Estados**: Disponible, Reservado, Vendido con colores distintivos
- **Información Detallada**: Precio, área, dimensiones y ubicación
- **Búsqueda y Filtros**: Por precio, área, estado y ordenamiento
- **Sistema de Cotización**: Generación automática de cronogramas de pago

### 🏢 Áreas Comunes
- **Club House**: Instalaciones recreativas
- **Parque**: Espacios verdes comunitarios
- **Pórtico de Ingreso**: Acceso principal al proyecto

### 🌍 Entorno y Servicios
- **Categorías**: Restaurantes, Hoteles, Seguridad, Turismo, Playas
- **Información Detallada**: Descripción y ubicación de cada servicio
- **Rutas**: Cálculo de distancias y rutas de acceso
- **Marcadores Interactivos**: Puntos de interés con información

### 📸 Experiencia Multimedia
- **Fotos 360°**: Tours virtuales inmersivos con Kuula
- **Videos**: Contenido audiovisual del proyecto
- **Galería de Imágenes**: Visualización de áreas y servicios

## 🛠️ Tecnologías Utilizadas

### Frontend
- **React 19.1.1**: Framework principal
- **TypeScript**: Tipado estático
- **Vite**: Herramienta de construcción
- **CSS Modules**: Estilos modulares

### 3D y Visualización
- **Cesium.js**: Motor 3D para visualización geográfica
- **GeoJSON**: Datos geoespaciales
- **OpenRouteService API**: Cálculo de rutas

### Herramientas de Desarrollo
- **ESLint**: Linting de código
- **TypeScript ESLint**: Linting específico para TypeScript
- **date-fns**: Manipulación de fechas

## 📁 Estructura del Proyecto

```
src/
├── components/           # Componentes React
│   ├── BottomBar/       # Barra de controles inferiores
│   ├── Modals/          # Ventanas modales
│   │   ├── AreasModal/     # Modal de áreas comunes
│   │   ├── EntornoModal/   # Modal de entorno
│   │   ├── LotInfoModal/   # Modal de información de lotes
│   │   └── LotSearchModal/ # Modal de búsqueda de lotes
│   ├── Overlays/        # Superposiciones
│   │   ├── EntornoButtons/ # Botones de entorno
│   │   ├── ImageOverlay/  # Superposición de imágenes
│   │   ├── Photos360Overlay/ # Superposición 360°
│   │   └── VideoOverlay/  # Superposición de video
│   ├── Sidebar/         # Barra lateral
│   └── UI/              # Componentes de interfaz
├── Layout/              # Componentes de layout
│   ├── Instructions/    # Instrucciones de uso
│   └── SplashScreen/    # Pantalla de carga
├── types/               # Definiciones de tipos
└── App.tsx              # Componente principal
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js (versión 18 o superior)
- npm o yarn
- Token de Cesium Ion
- API Key de OpenRouteService

### Instalación

1. **Clonar el repositorio**
```bash
git clone <url-del-repositorio>
cd mi-proyecto
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
Crear un archivo `.env` en la raíz del proyecto:
```env
VITE_CESIUM_TOKEN=tu_token_de_cesium_ion
VITE_OPEN_ROUTE_SERVICE_KEY=tu_api_key_de_openroute
```

4. **Ejecutar en modo desarrollo**
```bash
npm run dev
```

5. **Construir para producción**
```bash
npm run build
```

## 📊 Datos Geoespaciales

El proyecto utiliza archivos GeoJSON para almacenar información geoespacial:

- **`lotes.geojson`**: Información de lotes (precio, área, estado, coordenadas)
- **`areas.geojson`**: Áreas comunes del proyecto
- **`entorno.geojson`**: Servicios y puntos de interés del entorno
- **`fotos.geojson`**: Ubicaciones de fotos 360°

## 🎮 Funcionalidades de Navegación

### Controles de Cámara
- **Home**: Vuelta a la vista inicial
- **Zoom In/Out**: Acercar y alejar
- **Up/Down**: Movimiento vertical de cámara
- **3D View**: Alternancia entre vista 2D y 3D
- **Grid**: Mostrar/ocultar cuadrícula de medición

### Interacción con Lotes
- **Selección**: Click en lotes para ver información
- **Hover**: Resaltado al pasar el mouse
- **Filtros**: Búsqueda por criterios específicos
- **Cotización**: Generación de cronogramas de pago

## 💰 Sistema de Cotización

### Modalidades de Pago
- **Crédito Hipotecario**: Financiamiento tradicional
- **Contado**: Pago único
- **Crédito Directo**: Financiamiento directo

### Características
- **Descuentos**: Aplicación de descuentos por monto o porcentaje
- **Cronogramas**: Generación automática de fechas de pago
- **Validaciones**: Verificación de fechas y montos
- **Exportación**: Generación de reportes de cotización

## 🎨 Interfaz de Usuario

### Diseño Responsivo
- **Desktop**: Experiencia completa con controles avanzados
- **Móvil**: Interfaz adaptada para dispositivos táctiles
- **Instrucciones**: Guías de uso para diferentes dispositivos

### Componentes Principales
- **Sidebar**: Navegación principal
- **BottomBar**: Controles de cámara
- **Modales**: Ventanas de información
- **Overlays**: Superposiciones multimedia

## 🔧 Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Construcción para producción
npm run preview  # Vista previa de la construcción
npm run lint     # Verificación de código
```

## 🌐 APIs Externas

### Cesium Ion
- **Token**: Requerido para el acceso a tiles y servicios
- **Configuración**: Se pasa automáticamente desde variables de entorno

### OpenRouteService
- **API Key**: Para cálculo de rutas y distancias
- **Funcionalidad**: Navegación desde el proyecto a puntos de interés

## 📱 Compatibilidad

### Navegadores Soportados
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Dispositivos
- **Desktop**: Experiencia completa
- **Tablet**: Interfaz adaptada
- **Móvil**: Controles táctiles optimizados

## 🚀 Despliegue

### Build de Producción
```bash
npm run build
```

Los archivos generados se encuentran en la carpeta `dist/` y están listos para ser desplegados en cualquier servidor web estático.

### Variables de Entorno Requeridas
- `VITE_CESIUM_TOKEN`: Token de Cesium Ion
- `VITE_OPEN_ROUTE_SERVICE_KEY`: API Key de OpenRouteService

## 📝 Notas de Desarrollo

### Arquitectura
- **React**: Componentes funcionales con hooks
- **TypeScript**: Tipado estático para mejor mantenimiento
- **Cesium**: Integración mediante eventos personalizados
- **Estado**: Gestión de estado local con useState

### Optimizaciones
- **Lazy Loading**: Carga diferida de componentes
- **Memoización**: Optimización de re-renderizados
- **Event Listeners**: Gestión eficiente de eventos
