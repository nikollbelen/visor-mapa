# 🏘️ Proyecto Inmobiliario 3D - Mikonos Residencial Playa

Una aplicación web interactiva desarrollada con React, TypeScript y Cesium para la visualización 3D de un proyecto inmobiliario. Permite explorar lotes, áreas comunes, entorno y servicios de manera inmersiva con un sistema completo de cotización y gestión de usuarios.

## 🚀 Características Principales

### 🗺️ Visualización 3D
- **Motor 3D**: Cesium.js para renderizado 3D de alta calidad
- **Navegación**: Controles intuitivos para explorar el terreno
- **Vista 2D/3D**: Alternancia entre vistas planas y tridimensionales
- **Grid**: Visualización de cuadrícula para mediciones precisas

### 🏠 Gestión de Lotes
- **Catálogo de Lotes**: Visualización de todos los lotes disponibles
- **Estados**: Disponible, Reservado, Vendido con colores distintivos
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

### 📸 Experiencia Multimedia
- **Fotos 360°**: Tours virtuales inmersivos con Kuula
- **Videos**: Contenido audiovisual del proyecto
- **Galería de Imágenes**: Visualización de áreas y servicios

### 👥 Sistema de Usuarios
- **Autenticación**: Sistema de login con validación
- **Perfiles de Usuario**: Gestión de información personal
- **Vendedores**: Base de datos de vendedores con IDs únicos
- **Persistencia**: Almacenamiento local de sesiones

### 💰 Sistema de Cotización Avanzado
- **Modalidades de Pago**: Crédito Hipotecario, Contado, Crédito Directo
- **Descuentos**: Aplicación de descuentos por monto o porcentaje
- **Cronogramas Inteligentes**: Generación automática con fechas editables
- **Validaciones**: Verificación de fechas y montos
- **Exportación**: Generación de PDFs e impresión

## 🛠️ Tecnologías Utilizadas

### Frontend
- **React 19.1.1**: Framework principal con hooks modernos
- **TypeScript**: Tipado estático para mejor mantenimiento
- **Vite 7.1.7**: Herramienta de construcción rápida
- **CSS Tradicional**: Estilos globales por componente

### 3D y Visualización
- **Cesium.js**: Motor 3D para visualización geográfica
- **GeoJSON**: Datos geoespaciales estructurados
- **OpenRouteService API**: Cálculo de rutas y distancias

### Herramientas de Desarrollo
- **ESLint**: Linting de código con reglas estrictas
- **date-fns 4.1.0**: Manipulación avanzada de fechas
- **jsPDF 3.0.3**: Generación de documentos PDF

## 📁 Estructura del Proyecto

```
src/
├── components/           # Componentes React
│   ├── BottomBar/       # Barra de controles inferiores
│   ├── Modals/          # Ventanas modales
│   │   ├── AreasModal/     # Modal de áreas comunes
│   │   ├── ContactModal/    # Modal de contacto y datos
│   │   ├── EntornoModal/   # Modal de entorno
│   │   ├── LoginModal/     # Modal de autenticación
│   │   ├── LotInfoModal/   # Modal principal de lotes
│   │   ├── LotSearchModal/ # Modal de búsqueda de lotes
│   │   └── UserInfoModal/  # Modal de información de usuario
│   ├── Overlays/        # Superposiciones multimedia
│   ├── Sidebar/         # Barra lateral de navegación
│   └── UI/              # Componentes de interfaz
├── Layout/              # Componentes de layout
├── cesium/              # Configuración de Cesium
└── App.tsx              # Componente principal

public/
├── data/               # Datos geoespaciales y configuración
│   ├── areas.geojson      # Áreas comunes del proyecto
│   ├── entorno.geojson    # Servicios del entorno
│   ├── fotos.geojson      # Ubicaciones de fotos 360°
│   ├── lotes.geojson      # Información de lotes
│   └── sellers.json       # Base de datos de vendedores
└── images/             # Recursos multimedia
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
- **`sellers.json`**: Base de datos de vendedores con IDs únicos

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

## 💰 Sistema de Cotización Avanzado

### Modalidades de Pago
- **Crédito Hipotecario**: Financiamiento tradicional con separación, inicial y cuotas
- **Contado**: Pago único con opciones de separación e inicial
- **Crédito Directo**: Financiamiento directo con cuotas personalizables

### Características Avanzadas
- **Descuentos Inteligentes**: Aplicación automática por monto o porcentaje
- **Cronogramas Editables**: Fechas personalizables con validación
- **Cuotas Equivalentes**: Distribución automática de pagos
- **Sincronización**: Datos de vendedor y cliente integrados
- **Validaciones**: Verificación de fechas (no anteriores a hoy)
- **Exportación**: Generación de PDFs e impresión con datos completos

## 🎨 Interfaz de Usuario

### Diseño Responsivo
- **Desktop**: Experiencia completa con controles avanzados
- **Tablet**: Interfaz adaptada con controles optimizados
- **Móvil**: Controles táctiles optimizados para navegación

### Componentes Principales
- **Sidebar**: Navegación principal con categorías
- **BottomBar**: Controles de cámara y vista
- **Modales**: Ventanas de información especializadas
- **Overlays**: Superposiciones multimedia

