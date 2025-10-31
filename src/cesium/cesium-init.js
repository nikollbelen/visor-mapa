// Cesium configuration

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;
// Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
const viewer = new Cesium.Viewer("cesiumContainer", {
  animation: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  fullscreenButton: false,
  requestRenderMode: true,
  pickTranslucentDepth: true,
});
// Global variables for lots
let lotesPositions = [];
let processedLots = [];
let lotesDataSource = null;

// Variables to handle hover
let highlightedMarcador = null;
let highlightedMarcadorOriginalScale = null;
let selected = null;
let selectedOriginalMaterial = null;

// Functions to detect device type and adjust label properties
function getDeviceType() {
  const width = window.innerWidth;
  if (width <= 768) {
    return 'mobile';
  } else if (width <= 1024) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

function getLabelFont() {
  const deviceType = getDeviceType();
  switch (deviceType) {
    case 'mobile':
      return "700 8pt Arial, sans-serif";
    case 'tablet':
      return "800 8pt Arial, sans-serif";
    case 'desktop':
    default:
      return "900 9pt Arial, sans-serif";
  }
}

function getLabelScale() {
  const deviceType = getDeviceType();
  switch (deviceType) {
    case 'mobile':
      return 0.6;
    case 'tablet':
      return 0.8;
    case 'desktop':
    default:
      return 1.0;
  }
}

function getLabelOutlineWidth() {
  const deviceType = getDeviceType();
  switch (deviceType) {
    case 'mobile':
      return 1.5;
    case 'tablet':
      return 2;
    case 'desktop':
    default:
      return 2;
  }
}

// Lot colors
const disponible = window.Cesium.Color.fromCssColorString("#00BA13");
const reservado = window.Cesium.Color.fromCssColorString("#F5E200");
const vendido = window.Cesium.Color.fromCssColorString("#D11F00");
const modeSelected = window.Cesium.Color.fromCssColorString("#FFFFFF");

let maxPrice = 0;
let maxArea = 0;
let minPrice = 0;
let minArea = 0;

// Load custom map image
try {
  viewer.imageryLayers.addImageryProvider(
    await window.Cesium.IonImageryProvider.fromAssetId(3971478)
  );
} catch (error) {
  console.error("❌ Error loading map image:", error);
}

async function loadLotesData() {
  try {
    const response = await fetch("./data/lotes.geojson");
    const lotesData = await response.json();

    // 1) Obtener propiedades desde API por POST y mapear por fid (manteniendo geometrías locales)
    let fidToApiProps = new Map();
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const apiUrl = `${apiBaseUrl}/lots/project/6904f3e87d0fa4e90586cdf9`;
      
      const apiResp = await fetch(apiUrl, { 
        method: "GET",
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (apiResp.ok) {
        const apiJson = await apiResp.json();
        const lots = (apiJson && apiJson.data && Array.isArray(apiJson.data.lots)) ? apiJson.data.lots : [];
        lots.forEach((lot) => {
          const fidKey = String(lot.fid);
          fidToApiProps.set(fidKey, lot);
        });
      } else {
        console.error("Error al obtener lots desde API:", apiResp.status);
      }
    } catch (apiErr) {
      console.error("Fallo al llamar al endpoint de lots:", apiErr);
    }

    // 2) Fusionar propiedades del API dentro de cada feature por fid, manteniendo geometry local
    if (lotesData && Array.isArray(lotesData.features)) {
      lotesData.features.forEach((feature) => {
        if (!feature || !feature.properties) return;
        const localFid = feature.properties.fid;
        if (localFid == null) return;
        const api = fidToApiProps.get(String(localFid));
        if (!api) return;

        // Mapear campos del API -> esquema usado en la app
        // API: { phase, block, lot, area, price, state, fid }
        // Local: { manzana, lote, area, precio, estado }
        const mapped = {
          manzana: api.block ?? feature.properties.manzana,
          lote: api.lot ?? feature.properties.lote,
          area: api.area ?? feature.properties.area,
          precio: api.price ?? feature.properties.precio,
          estado: api.state ? String(api.state).toLowerCase() : feature.properties.estado,
        };

        // Escribir propiedades fusionadas sin tocar geometry
        feature.properties.manzana = mapped.manzana;
        feature.properties.lote = mapped.lote;
        feature.properties.area = mapped.area;
        feature.properties.precio = mapped.precio;
        feature.properties.estado = mapped.estado;

        // Opcional: conservar extras del API para usos futuros
        feature.properties._api = {
          id: api.id,
          phase: api.phase,
          project_id: api.project_id,
          updated_at: api.updated_at,
          is_active: api.is_active,
        };
      });
    }

    // Extract all polygon positions for flyToView
    lotesPositions = extractLotesPositions(lotesData);

    // Process and format lot data once
    const feats = lotesData.features || [];
    processedLots = feats
      .filter((f) => f && f.properties)
      .filter((f) => {
        const p = f.properties || {};
        const number = p.number || "";
        const lote = p.lote || "";
        return (
          number !== "Jardín" &&
          (lote !== "" || (number !== "" && !isNaN(parseInt(number))))
        );
      })
      .map((f, idx) => {
        const p = f.properties || {};
        // Normalize area (already comes as number or numeric string in new schema)
        let areaNum = 0;
        if (typeof p.area === "string") {
          areaNum = parseFloat(p.area.replace(",", ".")) || 0;
        } else if (typeof p.area === "number") {
          areaNum = p.area;
        }
        // Price
        let precioNum = 0;
        if (typeof p.precio === "string") {
          precioNum = parseFloat(p.precio.replace(",", ".")) || 0;
        } else if (typeof p.precio === "number") {
          precioNum = p.precio;
        }

        // Calculate maximum price
        if (precioNum > maxPrice) {
          maxPrice = precioNum;
        }

        // Calculate minimum price (only for first valid lot or if current is smaller)
        if (minPrice === 0 || precioNum < minPrice) {
          minPrice = precioNum;
        }

        // Calculate maximum area
        if (areaNum > maxArea) {
          maxArea = areaNum;
        }

        // Calculate minimum area (only for first valid lot or if current is smaller)
        if (minArea === 0 || areaNum < minArea) {
          minArea = areaNum;
        }

        const estado = p.estado || "disponible";
        const manzana = p.manzana || "";
        const lote = p.lote || "";
        return {
          id: p.direccion || `${idx}`,
          number:
            p.direccion ||
            (manzana || lote
              ? `Mz. ${manzana} - Lote ${lote}`
              : p.number || `Lote ${idx + 1}`),
          price: precioNum,
          area: areaNum,
          status: String(estado).toLowerCase(),
        };
      });

    // Create Cesium data source from the loaded data
    lotesDataSource = new window.Cesium.GeoJsonDataSource();
    await lotesDataSource.load(lotesData);

    // Add labels to each terrain polygon
    const entities = lotesDataSource.entities.values;
    let polygonLabels = [];
    entities.forEach((entity) => {
      if (entity.polygon && entity.properties && entity.properties.number) {
        const positions = entity.polygon.hierarchy.getValue(
          window.Cesium.JulianDate.now()
        ).positions;

        // Calculate the center of the polygon
        const center =
          window.Cesium.BoundingSphere.fromPoints(positions).center;

        // Get the number from properties
        const lote = entity.properties.lote.getValue();

        // Add a label at the center of the polygon
        const labelEntity = viewer.entities.add({
          position: center,
          label: {
            text:
              entity.properties.manzana && entity.properties.lote
                ? `${entity.properties.manzana}${entity.properties.lote}`
                : "",
            font: getLabelFont(),
            fillColor: window.Cesium.Color.WHITE,
            outlineColor: window.Cesium.Color.GRAY,
            outlineWidth: getLabelOutlineWidth(),
            style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: window.Cesium.VerticalOrigin.CENTER,
            pixelOffset: new window.Cesium.Cartesian2(0, 0),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scale: getLabelScale(),
            heightReference: window.Cesium.HeightReference.CLAMP_TO_GROUND,
            show: !!lote,
          },
        });
        polygonLabels.push(labelEntity);
      }
    });

    // Add Mykonos marker
    const referencePoint =
      window.Cesium.BoundingSphere.fromPoints(lotesPositions).center;
    const MAX_DISTANCE = 550;
    const mykonosMarker = viewer.entities.add({
      id: "mykonos_marker",
      name: "Mykonos",
      position: referencePoint,
      billboard: {
        image: "images/mikonos_marker.png",
        width: 150,
        height: 200,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: window.Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        alignedAxis: window.Cesium.Cartesian3.ZERO,
        pixelOffset: window.Cesium.Cartesian2.ZERO,
        eyeOffset: window.Cesium.Cartesian3.ZERO,
        scaleByDistance: new window.Cesium.NearFarScalar(
          100.0,
          1.0,
          2000.0,
          0.5
        ),
        heightReference: window.Cesium.HeightReference.CLAMP_TO_GROUND,
        show: true,
      },
    });
    const NEAR_DISTANCE = 200.0;
    const FAR_DISTANCE = 201.0;

    // Event that runs before each frame
    viewer.scene.preRender.addEventListener(function () {
      // Get the distance from the camera to the reference point
      const distance = window.Cesium.Cartesian3.distance(
        viewer.camera.positionWC,
        referencePoint
      );

      // Control lot label visibility
      polygonLabels.forEach((entity) => {
        const show = distance < MAX_DISTANCE;
        if (entity.label) {
          entity.label.show = show;
          if (distance <= NEAR_DISTANCE) {
            entity.label.scale = 1.5;
          } else if (distance >= FAR_DISTANCE) {
            entity.label.scale = 1.0;
          }
        }
      });

      // Control Mykonos marker visibility
      if (mykonosMarker && mykonosMarker.billboard) {
        // Show Mykonos only when you are far away (>=550m, same distance where labels disappear)
        mykonosMarker.billboard.show = distance >= MAX_DISTANCE;
      }

      // Control visibility of all markers except environment
      const allEntities = viewer.entities.values;
      allEntities.forEach((entity) => {
        // Exclude environment markers and Mykonos marker
        if (
          entity.id &&
          !entity.id.startsWith("marcador_entorno_") &&
          entity.id !== "mykonos_marker" &&
          entity.billboard
        ) {
          // Show markers when you are less than 550m away (same distance as labels)
          entity.billboard.show = distance < MAX_DISTANCE;

          // Also control labels if they exist
          if (entity.label) {
            entity.label.show = distance < MAX_DISTANCE;
          }
        }
      });
    });

    // Add the data source to the viewer after processing
    viewer.dataSources.add(lotesDataSource);

    // Apply styles to polygons
    try {
      const entities = lotesDataSource.entities.values.filter((e) => e.polygon);
      entities.forEach((e) => {
        let fid;
        if (e.properties && e.properties.fid) {
          fid =
            typeof e.properties.fid.getValue === "function"
              ? e.properties.fid.getValue()
              : e.properties.fid;
        }

        // Check if the lot is empty
        const loteValue = e.properties.lote ? e.properties.lote.getValue() : "";
        if (loteValue === "") {
          // For empty lots, make completely transparent
          e.polygon.material = disponible.withAlpha(0);
          e.polygon.height = 0.1;
          e.polygon.heightReference =
            window.Cesium.HeightReference.RELATIVE_TO_GROUND;
          e.polygon.outline = true;
          e.polygon.outlineColor = window.Cesium.Color.BLACK.withAlpha(0);
          e._baseMaterial =
            window.Cesium.Color.fromCssColorString("#fff").withAlpha(0.01); // Save transparent material
          return; // Skip to next
        }

        // For valid lots, apply normal configuration
        e.polygon.height = 0.1;
        e.polygon.heightReference =
          window.Cesium.HeightReference.RELATIVE_TO_GROUND;
        e.polygon.outline = true;
        e.polygon.outlineColor = window.Cesium.Color.BLACK.withAlpha(0);

        // Assign material according to status
        let baseMaterial = disponible; // Default material
        if (e.properties.estado.getValue() === "disponible") {
          baseMaterial = disponible.withAlpha(0.5);
        } else if (e.properties.estado.getValue() === "reservado") {
          baseMaterial = reservado.withAlpha(0.5);
        } else if (e.properties.estado.getValue() === "vendido") {
          baseMaterial = vendido.withAlpha(0.5);
        }

        // Assign the material and save the base material for restoration
        e.polygon.material = baseMaterial;
        e._baseMaterial = baseMaterial;
      });
    } catch (err) {
      console.error("Error applying styles to terreno.geojson (by fid):", err);
    }

    // Setup interaction handlers
    setupLoteInteractions();

    // Fly to lotes view
    flyToLotesView();
  } catch (error) {
    console.error("Error loading lotes.geojson:", error);
  }
}

function setupLoteInteractions() {
  const handler = new window.Cesium.ScreenSpaceEventHandler(
    viewer.scene.canvas
  );
  window.loteClickHandler = handler; // Store reference globally

  // Helper functions
  window.getFid = (entity) => {
    if (!entity || !entity.properties) return undefined;
    const p = entity.properties.fid;
    return typeof p?.getValue === "function" ? p.getValue() : p;
  };

  window.getNumber = (entity) => {
    if (!entity || !entity.properties) return undefined;
    const number = entity.properties.number;
    return typeof number?.getValue === "function" ? number.getValue() : number;
  };

  window.getDireccion = (entity) => {
    if (!entity || !entity.properties) return undefined;
    const props = entity.properties;
    const direccion = props.direccion;
    const manzana = props.manzana;
    const lote = props.lote;
    const valDireccion =
      typeof direccion?.getValue === "function"
        ? direccion.getValue()
        : direccion;
    const valManzana =
      typeof manzana?.getValue === "function" ? manzana.getValue() : manzana;
    const valLote =
      typeof lote?.getValue === "function" ? lote.getValue() : lote;
    if (!valDireccion && (valManzana || valLote)) {
      const mz = valManzana ? String(valManzana).trim() : "";
      const lt = valLote ? String(valLote).trim() : "";
      return `Mz. ${mz} - Lote ${lt}`.trim();
    }
    return valDireccion;
  };

  window.getArea = (entity) => {
    if (!entity || !entity.properties) return undefined;
    const area = entity.properties.area;
    const raw = typeof area?.getValue === "function" ? area.getValue() : area;
    if (typeof raw === "string") {
      const match = raw.replace(",", ".").match(/[0-9]+(?:\.[0-9]+)?/);
      return match ? `${parseFloat(match[0]).toFixed(2)} m²` : raw;
    }
    if (typeof raw === "number") {
      return `${raw.toFixed(2)} m²`;
    }
    return raw;
  };

  window.getEstado = (entity) => {
    if (!entity || !entity.properties) return undefined;
    const estado = entity.properties.estado || entity.properties.status;
    return typeof estado?.getValue === "function" ? estado.getValue() : estado;
  };

  window.getPrecio = (entity) => {
    if (!entity || !entity.properties) return undefined;
    const precio = entity.properties.precio || entity.properties.price;
    const val =
      typeof precio?.getValue === "function" ? precio.getValue() : precio;
    if (val == null || val === "") return undefined;
    const num =
      typeof val === "string" ? parseFloat(val.replace(",", ".")) : val;
    return isNaN(num) ? undefined : num;
  };

  // Function to calculate lot boundaries/colindancias
  window.getColindancias = (entity) => {
    if (!entity || !entity.properties)
      return { left: "N/A", right: "N/A", front: "N/A", back: "N/A" };

    // Get lot number and manzana to calculate boundaries
    const lote = entity.properties.lote;
    const valLote =
      typeof lote?.getValue === "function" ? lote.getValue() : lote;

    // Simple boundary calculation based on lot number
    const lotNumber = parseInt(valLote);

    return {
      left: lotNumber > 9 ? `${lotNumber - 1}.5 ML` : `${lotNumber + 1}.5 ML`,
      right: lotNumber > 9 ? `${lotNumber - 2}.5 ML` : `${lotNumber + 2}.5 ML`,
      front: lotNumber > 9 ? `${lotNumber - 3}.5 ML` : `${lotNumber + 3}.5 ML`,
      back: lotNumber > 9 ? `${lotNumber - 4}.5 ML` : `${lotNumber + 4}.5 ML`,
    };
  };

  // Point-in-polygon test
  const getPolygonPositionsCartographic = (entity) => {
    const now = window.Cesium.JulianDate.now();
    const hierarchy = window.Cesium.Property.getValueOrDefault(
      entity.polygon.hierarchy,
      now
    );
    if (!hierarchy) return [];
    const positions = hierarchy.positions || hierarchy;
    return positions.map((pos) =>
      window.Cesium.Cartographic.fromCartesian(pos)
    );
  };

  const pointInPolygon = (pointCarto, polyCartos) => {
    if (!pointCarto || !polyCartos || polyCartos.length < 3) return false;
    const x = pointCarto.longitude;
    const y = pointCarto.latitude;
    let inside = false;
    for (let i = 0, j = polyCartos.length - 1; i < polyCartos.length; j = i++) {
      const xi = polyCartos[i].longitude,
        yi = polyCartos[i].latitude;
      const xj = polyCartos[j].longitude,
        yj = polyCartos[j].latitude;
      const intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // State variables for interactions
  let highlighted = null;
  let highlightedOriginalMaterial = null;

  // Hover interaction
  handler.setInputAction((movement) => {
    // 1) Quick attempt with drillPick
    const picked = viewer.scene.drillPick(movement.endPosition) || [];
    let entity = picked.map((p) => p.id).find((id) => id && id.polygon) || null;

    // Restore hover if we moved away or to another entity
    if (highlighted && highlighted !== entity) {
      viewer.scene.canvas.style.cursor = "default";
      // Don't touch if it's the selected one
      if (highlighted !== selected) {
        highlighted.polygon.material = highlighted._baseMaterial;
      }
      highlighted = null;
      highlightedOriginalMaterial = null;
      viewer.scene.requestRender();
    }

    if (entity) {
      const fid = getFid(entity);
      if (fid !== undefined) {
        // Check if the lot is empty
        const loteValue = entity.properties.lote
          ? entity.properties.lote.getValue()
          : "";
        if (loteValue === "") {
          // For empty lots, don't hover or change cursor
          viewer.scene.canvas.style.cursor = "default";
          return;
        }

        viewer.scene.canvas.style.cursor = "pointer";
        // Avoid highlighting if already selected
        if (highlighted !== entity && entity !== selected) {
          highlighted = entity;
          entity.polygon.material = modeSelected.withAlpha(0.5);
          viewer.scene.requestRender();
        }
      }
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // Click interaction
  handler.setInputAction((click) => {

    const picked = viewer.scene.drillPick(click.position) || [];
    let entity = picked.map((p) => p.id).find((id) => id && id.polygon) || null;

    // Fallback by point-in-polygon
    if (!entity) {
      const cart = viewer.scene.pickPosition(click.position);
      if (cart) {
        const carto = window.Cesium.Cartographic.fromCartesian(cart);
        const polyEntity = lotesDataSource.entities.values.find((e) => {
          if (!e.polygon) return false;
          const fid = getFid(e);
          if (fid === 0) return false;
          const ring = getPolygonPositionsCartographic(e);
          return pointInPolygon(carto, ring);
        });
        if (polyEntity) entity = polyEntity;
      }
    }

    if (!entity) return;
    const fid = getFid(entity);
    if (fid === undefined) return;
    // Primero limpiar todo (botones, marcadores, modales, rutas)
    reiniciarMenu();

    // Select new entity
    selected = entity;
    selectedOriginalMaterial = entity._baseMaterial || entity.polygon.material;
    entity.polygon.material = modeSelected;

    viewer.scene.requestRender();

    // Disparar evento para mostrar modal del lote
    window.dispatchEvent(
      new CustomEvent("loteSelected", {
        detail: {
          entity: entity,
          direccion: getDireccion(entity),
          area: getArea(entity),
          precio: getPrecio(entity),
          estado: getEstado(entity),
          boundaries: getColindancias(entity),
        },
      })
    );
  }, window.Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

loadLotesData();

function extractLotesPositions(lotesData) {
  const positions = [];

  if (!lotesData || !lotesData.features) {
    console.warn("No lot data to extract positions");
    return positions;
  }

  lotesData.features.forEach((feature) => {
    if (feature.geometry && feature.geometry.coordinates) {
      const coords = feature.geometry.coordinates;

      // Handle different geometry types
      if (feature.geometry.type === "Polygon") {
        // For polygons, use the first ring (exterior)
        const ring = coords[0];
        ring.forEach((coord) => {
          positions.push(
            window.Cesium.Cartesian3.fromDegrees(coord[0], coord[1])
          );
        });
      } else if (feature.geometry.type === "Point") {
        // For points
        positions.push(
          window.Cesium.Cartesian3.fromDegrees(coords[0], coords[1])
        );
      }
    }
  });

  return positions;
}

// Global functions

function flyToLotesView() {
  if (lotesPositions && lotesPositions.length > 0) {
    flyToView(lotesPositions);
  } else {
    console.warn("No hay posiciones de lotes disponibles para volar");
    // Fallback a coordenadas fijas si no hay posiciones
    const fallbackPositions = [
      window.Cesium.Cartesian3.fromDegrees(-71.8976, -17.0995),
      window.Cesium.Cartesian3.fromDegrees(-71.8964, -17.0996),
      window.Cesium.Cartesian3.fromDegrees(-71.8974, -17.1003),
    ];
    flyToView(fallbackPositions);
  }
}

function flyToView(positions) {
  if (!viewer || !positions || positions.length === 0) return;

  const boundingSphere = window.Cesium.BoundingSphere.fromPoints(positions);
  // Ajustar la vista para mostrar todos los marcadores
  viewer.camera.flyToBoundingSphere(boundingSphere, {
    duration: 1.5,
    offset: new window.Cesium.HeadingPitchRange(
      0.0,
      window.Cesium.Math.toRadians(-90),
      boundingSphere.radius * 3.8
    ),
  });
}

function hoverMarcadores() {
  if (!viewer) return;

  viewer.screenSpaceEventHandler.setInputAction(function onMouseMove(movement) {
    const picked = viewer.scene.drillPick(movement.endPosition) || [];
    let entity =
      picked
        .map((p) => p.id)
        .find((id) => id && id.id && id.id.startsWith("marcador_")) || null;

    // Restore hover if we moved away or to another entity
    if (highlightedMarcador && highlightedMarcador !== entity) {
      // Restore original scale
      if (highlightedMarcadorOriginalScale !== null) {
        highlightedMarcador.billboard.scale = highlightedMarcadorOriginalScale;
      }
      highlightedMarcador = null;
      highlightedMarcadorOriginalScale = null;
      viewer.scene.requestRender();
    }

    if (entity && entity.id && entity.id.startsWith("marcador_")) {
      // Apply hover if not the same marker
      if (highlightedMarcador !== entity) {
        highlightedMarcador = entity;
        // Save the original scale
        highlightedMarcadorOriginalScale = entity.billboard.scale._value || 1.0;
        // Make the marker a bit bigger
        entity.billboard.scale = highlightedMarcadorOriginalScale * 1.2;
        viewer.scene.requestRender();
      }

      viewer.scene.canvas.style.cursor = "pointer";
    } else {
      viewer.scene.canvas.style.cursor = "default";
    }
  }, window.Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}

// Sidebar

function reiniciarMenu() {
  console.log("Reiniciando menu");
  // Remove active classes from all sidebar buttons
  const fotosBtn = document.getElementById("fotos");
  const areasBtn = document.getElementById("areas");
  const lotesBtn = document.getElementById("lotes");
  const entornoBtn = document.getElementById("entorno");
  const videoBtn = document.getElementById("video");

  if (fotosBtn) fotosBtn.classList.remove("active");
  if (areasBtn) areasBtn.classList.remove("active");
  if (lotesBtn) lotesBtn.classList.remove("active");
  if (entornoBtn) entornoBtn.classList.remove("active");
  if (videoBtn) videoBtn.classList.remove("active");

  // Hide all modals and overlays
  const modalOverlay = document.getElementById("modalOverlay");
  const overlay360 = document.getElementById("overlay360");
  const commonAreasModalOverlay = document.getElementById(
    "commonAreasModalOverlay"
  );
  const lotSearchModalOverlay = document.getElementById(
    "lotSearchModalOverlay"
  );
  const aroundButtonsContainer = document.getElementById(
    "aroundButtonsContainer"
  );
  const aroundModalOverlay = document.getElementById("aroundModalOverlay");

  if (modalOverlay) if (modalOverlay.classList.contains("show")) {
    modalOverlay.classList.remove("show");
    modalOverlay.classList.add("hide");
  }
  if (overlay360) overlay360.style.display = "none";
  if (commonAreasModalOverlay) commonAreasModalOverlay.style.display = "none";
  if (lotSearchModalOverlay) lotSearchModalOverlay.style.display = "none";
  if (aroundButtonsContainer) aroundButtonsContainer.style.display = "none";
  if (aroundModalOverlay) aroundModalOverlay.style.display = "none";

  // Clear selected lot state using global function
  if (selected) {
    const base = selected._baseMaterial || selectedOriginalMaterial;
    if (base) selected.polygon.material = base;
  }
  selected = null;
  selectedOriginalMaterial = null;
  if (viewer) viewer.scene.requestRender();

  // Clear ALL markers when changing mode
  if (viewer) {
    const allEntitiesToRemove = viewer.entities.values.filter(
      (entity) =>
        entity.id &&
        (entity.id.startsWith("marcador_foto_") ||
          entity.id.startsWith("area_comun_") ||
          entity.id.startsWith("marcador_entorno_"))
    );
    allEntitiesToRemove.forEach((entity) => viewer.entities.remove(entity));
  }

  // Clear previous route if exists
  clearRoute();

  // Return to lots view
  flyToLotesView();
}

// Fotos 360°

async function handleFotos() {
  reiniciarMenu();

  // Activate photos button
  const fotosBtn = document.getElementById("fotos");
  if (fotosBtn) fotosBtn.classList.add("active");

  try {
    const response = await fetch("./data/fotos.geojson");
    const fotosData = await response.json();

    if (fotosData && fotosData.features) {
      const positions = [];

      fotosData.features.forEach((feature) => {
        const fid = feature.properties.fid;
        const kuulaUrl = feature.properties.kuula_url;
        const coordinates = feature.geometry.coordinates;

        viewer.entities.add({
          id: `marcador_foto_${fid}`,
          position: window.Cesium.Cartesian3.fromDegrees(
            coordinates[0],
            coordinates[1]
          ),
          billboard: {
            image: "images/sidebar/360/360.png",
            width: 45,
            height: 58,
            verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
            horizontalOrigin: window.Cesium.HorizontalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            color: window.Cesium.Color.WHITE,
            scale: 1.0,
            show: true,
            scaleByDistance: new window.Cesium.NearFarScalar(
              100.0,
              1.0,
              2000.0,
              0.5
            ),
            alignedAxis: window.Cesium.Cartesian3.ZERO,
            pixelOffset: window.Cesium.Cartesian2.ZERO,
            eyeOffset: window.Cesium.Cartesian3.ZERO,
            heightReference: window.Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          properties: {
            coordinates: coordinates,
            kuulaUrl: kuulaUrl,
          },
        });

        positions.push(
          window.Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1])
        );
      });

      // Configure hover events for markers
      hoverMarcadores();
      // Configure click for markers
      clickMarcadores360();

      if (positions.length > 0) {
        flyToView(positions);
      }
    }
  } catch (error) {
    console.error("Error al cargar las fotos 360°:", error);
  }
}

// Function to handle clicks on 360° markers
function clickMarcadores360() {
  if (!viewer) return;

  viewer.screenSpaceEventHandler.setInputAction(function onLeftClick(click) {
    const pickedObject = viewer.scene.pick(click.position);

    if (pickedObject && pickedObject.id) {
      const entity = pickedObject.id;
      const entityId = entity.id;

      if (entityId && entityId.startsWith("marcador_foto_")) {
        const kuulaUrl = entity.properties.kuulaUrl._value;
        openOverlay360(kuulaUrl);
        console.log("clickMarcadores360 click");
      }
    }
  }, window.Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// Function to open 360° overlay
function openOverlay360(kuulaUrl) {
  window.dispatchEvent(
    new CustomEvent("openPhotos360", {
      detail: { kuulaUrl: kuulaUrl },
    })
  );
}

// Function to close 360° overlay
function closeOverlay360() {
  // Only dispatch custom event for React
  // React will handle hiding the overlay
  window.dispatchEvent(new CustomEvent("closePhotos360"));
}

// Áreas comunes

async function handleAreasComunes() {
  reiniciarMenu();

  // Activate areas button
  const areasBtn = document.getElementById("areas");
  if (areasBtn) areasBtn.classList.add("active");

  let areasData = null;

  try {
    // Cargar datos desde la API de Apico
    const response = await fetch("https://api.apico.dev/v1/gE2H1N/1vL47XFQKS6ajoKccemle7MYYDStFVawgnopVpfzz-UA/values/areas");
    const apiData = await response.json();
    
    // Usar directamente los datos de la API sin transformar a GeoJSON
    areasData = apiData;

    if (areasData && areasData.values) {
      const positions = [];

      // Crear marcadores para cada área usando directamente los datos de la API
      areasData.values.forEach((row) => {
        const fid = parseInt(row[0]);
        const name = row[1];
        const marker = row[2];
        const image = row[3];
        const longitude = parseFloat(row[4]);
        const latitude = parseFloat(row[5]);

        // Crear marcador con imagen areas_comunes.svg
        viewer.entities.add({
          id: `area_comun_${fid}`,
          position: window.Cesium.Cartesian3.fromDegrees(
            longitude,
            latitude
          ),
          billboard: {
            image: marker,
            width: 45,
            height: 58,
            verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
            horizontalOrigin: window.Cesium.HorizontalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            color: window.Cesium.Color.WHITE,
            scale: 1.0,
            show: true,
            scaleByDistance: new window.Cesium.NearFarScalar(
              100.0,
              1.0,
              2000.0,
              0.5
            ),
            alignedAxis: window.Cesium.Cartesian3.ZERO,
            pixelOffset: window.Cesium.Cartesian2.ZERO,
            eyeOffset: window.Cesium.Cartesian3.ZERO,
            heightReference: window.Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          label: {
            text: name,
            font: "bold 12pt sans-serif",
            fillColor: window.Cesium.Color.WHITE,
            outlineColor: window.Cesium.Color.BLACK,
            outlineWidth: 2,
            style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new window.Cesium.Cartesian2(0, 10),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition:
              new window.Cesium.DistanceDisplayCondition(0.0, 2000.0),
          },
          properties: {
            fid: fid,
            name: name,
            image: image,
            coordinates: [longitude, latitude],
          },
        });

        positions.push(
          window.Cesium.Cartesian3.fromDegrees(longitude, latitude)
        );
      });

      if (positions.length > 0) {
        flyToView(positions);
      }
    }
  } catch (error) {
    console.error("Error al cargar las áreas comunes:", error);
  }

  if (areasData) {
    populateAreasModal(areasData);
  }

  // Show common areas modal
  window.dispatchEvent(
    new CustomEvent("openAreasModal", {
      detail: { areasData: areasData },
    })
  );
}
// Function to populate the common areas modal with GeoJSON data
function populateAreasModal(areasData) {
  // Pasar los datos directamente de la API sin transformar
  window.dispatchEvent(
    new CustomEvent("populateAreasModal", {
      detail: { areasData: areasData },
    })
  );
}

// Function to open common area image
function openAreasComunesImage(imageUrl) {
  window.dispatchEvent(
    new CustomEvent("openAreasImage", {
      detail: { imageUrl: imageUrl },
    })
  );
}

// Function to fly to common area
function flyToAreaComun(fid) {
  const entity = viewer.entities.getById(`area_comun_${fid}`);
  if (entity) {
    const position = entity.position.getValue(viewer.clock.currentTime);

    if (position) {
      const boundingSphere = new window.Cesium.BoundingSphere(position, 54);

      viewer.camera.flyToBoundingSphere(boundingSphere, {
        duration: 1.5,
        offset: new window.Cesium.HeadingPitchRange(
          0,
          window.Cesium.Math.toRadians(-45),
          0
        ),
      });
    } else {
      console.error(`No se pudo obtener la posición del área común ${fid}`);
    }
  } else {
    console.error(`No se encontró el área común con fid ${fid}`);
  }
}
// Lotes

// Expose max values for React
window.getMaxPrice = function () {
  return maxPrice;
};

window.getMaxArea = function () {
  return maxArea;
};

// Expose min values for React
window.getMinPrice = function () {
  return minPrice;
};

window.getMinArea = function () {
  return minArea;
};

function handleLotes() {
  reiniciarMenu();

  // Activate lots button
  const lotesBtn = document.getElementById("lotes");
  if (lotesBtn) lotesBtn.classList.add("active");

  // Volar a la vista de lotes
  flyToLotesView();

  // Dispatch event to open lot search modal
  window.dispatchEvent(new CustomEvent("openLotSearchModal"));
}

// Lot filtering and search functions
function applyFilters(lots) {
  const priceMin = parseInt(
    document.querySelector('input[name="priceMin"]')?.value || 0
  );
  const priceMax = parseInt(
    document.querySelector('input[name="priceMax"]')?.value || maxPrice
  );
  const areaMin = parseInt(
    document.querySelector('input[name="areaMin"]')?.value || 0
  );
  const areaMax = parseInt(
    document.querySelector('input[name="areaMax"]')?.value || maxArea
  );

  const selectedStatus = Array.from(
    document.querySelectorAll(".status-btn.active")
  ).map((btn) => btn.getAttribute("data-status"));

  return lots.filter((lot) => {
    // Price filter - price range
    if (lot.price < priceMin || lot.price > priceMax) return false;

    // Area filter - area range
    if (lot.area < areaMin || lot.area > areaMax) return false;

    // Status filter
    if (selectedStatus.length > 0 && !selectedStatus.includes(lot.status))
      return false;

    return true;
  });
}

function applySorting(lots) {
  const sortSelect = document.getElementById("sortSelect");
  const sortValue = sortSelect ? sortSelect.value : "area-asc";

  return lots.sort((a, b) => {
    switch (sortValue) {
      case "area-asc":
        return a.area - b.area;
      case "area-desc":
        return b.area - a.area;
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "number-asc":
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return numA - numB;
      case "number-desc":
        const numA_desc = parseInt(a.number) || 0;
        const numB_desc = parseInt(b.number) || 0;
        return numB_desc - numA_desc;
      default:
        return 0;
    }
  });
}

function renderLotCards(lots) {
  const container = document.getElementById("lotCardsContainer");
  if (!container) return;

  container.innerHTML = "";

  lots.forEach((lot) => {
    const card = document.createElement("div");
    card.className = "lot-card";
    card.innerHTML = `
              <div class="lot-card-header">${lot.number}</div>
              <div class="lot-card-separator"></div>
              <div class="lot-card-status ${lot.status}">${
                lot.status.charAt(0).toUpperCase() + lot.status.slice(1)
              }</div>
              <div class="lot-card-details">
                <span class="lot-card-label">Precio</span>
                <span class="lot-card-value">$ ${lot.price.toLocaleString()}</span>
              </div>
              <div class="lot-card-details">
                <span class="lot-card-label">Área</span>
                <span class="lot-card-value">${lot.area.toFixed(2)} m²</span>
              </div>
              <button class="lot-card-view-more-btn" onclick="handleLotCardClick('${
                lot.number
              }')">
                Ver más <i class="fas fa-arrow-right"></i>
              </button>
            `;
    container.appendChild(card);
  });
}

window.handleLotCardClick = function (lotNumber) {
  reiniciarMenu();

  // Buscar la entidad del lote en el datasource de Cesium
  const allEntities = viewer.dataSources.get(0).entities.values;

  // Extraer manzana y lote del lot.number
  const lot = lotNumber; // "Mz. E - Lote 15"
  const manzanaMatch = lot.match(/Mz\.\s*([A-Z]+)/);
  const loteMatch = lot.match(/Lote\s*(\d+)/);

  const manzana = manzanaMatch ? manzanaMatch[1] : ""; // "E"
  const loteNum = loteMatch ? loteMatch[1] : ""; // "15"

  // Buscar por manzana y lote en las propiedades
  const lotEntity = allEntities.find((entity) => {
    if (!entity.properties) return false;

    const entityManzana = entity.properties.manzana
      ? entity.properties.manzana._value
      : "";
    const entityLote = entity.properties.lote
      ? entity.properties.lote._value
      : "";

    console.log("Comparando:", {
      buscandoManzana: manzana,
      buscandoLote: loteNum,
      entityManzana: entityManzana,
      entityLote: entityLote,
    });

    return entityManzana === manzana && entityLote === loteNum;
  });

  console.log("Entidad encontrada:", lotEntity);

  if (lotEntity) {
    // Deseleccionar el lote anteriormente seleccionado
    if (selected) {
      selected.polygon.material = selectedOriginalMaterial;
      selected = null;
      selectedOriginalMaterial = null;
    }

    // Seleccionar el nuevo lote
    selected = lotEntity;
    selectedOriginalMaterial =
      lotEntity._baseMaterial || lotEntity.polygon.material;
    lotEntity.polygon.material = modeSelected;

    // Volar hacia el lote
    viewer.flyTo(lotEntity, {
      duration: 2,
      offset: new window.Cesium.HeadingPitchRange(
        0,
        window.Cesium.Math.toRadians(-45),
        500
      ),
    });

    // Disparar evento para mostrar modal del lote
    window.dispatchEvent(
      new CustomEvent("loteSelected", {
        detail: {
          entity: lotEntity,
          direccion: getDireccion(lotEntity),
          area: getArea(lotEntity),
          precio: getPrecio(lotEntity),
          estado: getEstado(lotEntity),
          boundaries: getColindancias(lotEntity),
        },
      })
    );
  } else {
    console.error("No se encontró la entidad del lote con ID:", lotId);
    console.log(
      "Primeras 5 entidades con propiedades:",
      allEntities.slice(0, 5).map((e) => ({
        id: e.id,
        properties: e.properties
          ? Object.keys(e.properties).reduce((acc, key) => {
              acc[key] = e.properties[key]._value;
              return acc;
            }, {})
          : null,
      }))
    );
  }
};

function loadLotData() {
  try {
    if (!processedLots || processedLots.length === 0) {
      console.error(
        "Datos de lotes procesados no están disponibles. Asegúrate de que loadLotesData() se ejecute primero."
      );
      return;
    }

    // Aplicar filtros
    const filteredLots = applyFilters(processedLots);

    // Apply sorting
    const sortedLots = applySorting(filteredLots);

    // Update results count
    const resultsCount = document.getElementById("resultsCount");
    if (resultsCount) {
      resultsCount.textContent = `Mostrando (${sortedLots.length}) lotes`;
    }

    // Render lot cards
    renderLotCards(sortedLots);
  } catch (e) {
    console.error("No se pudo procesar datos de lotes", e);
  }
}

// Entorno

async function handleEntorno() {
  reiniciarMenu();

  // Activate environment button
  const entornoBtn = document.getElementById("entorno");
  if (entornoBtn) entornoBtn.classList.add("active");

  // Ensure button container is visible
  const aroundButtonsContainer = document.getElementById(
    "aroundButtonsContainer"
  );
  if (aroundButtonsContainer) {
    aroundButtonsContainer.style.display = "flex";
  }

  // Dispatch event to show environment buttons
  window.dispatchEvent(new CustomEvent("openEntornoButtons"));

  // Load all markers from entorno.geojson
  await loadEntornoMarkers();

  // Activate "Todos" button initially
  updateEntornoButtonsState("Todos");
}

// Function to return to initial environment state (without closing everything)
function resetEntornoToInitialState() {
  // Close modal if open
  const aroundModalOverlay = document.getElementById("aroundModalOverlay");
  if (aroundModalOverlay) {
    aroundModalOverlay.style.display = "none";
  }

  // Ensure button container is visible
  const aroundButtonsContainer = document.getElementById(
    "aroundButtonsContainer"
  );
  if (aroundButtonsContainer) {
    aroundButtonsContainer.style.display = "flex";
  }

  // Clear previous route
  clearRoute();

  // Clear existing markers
  const entitiesToRemove = viewer.entities.values.filter(
    (entity) => entity.id && entity.id.startsWith("marcador_entorno_")
  );
  entitiesToRemove.forEach((entity) => viewer.entities.remove(entity));

  // Reload all markers
  loadEntornoMarkers();

  // Fly to show all markers
  const positions = [];
  viewer.entities.values.forEach((entity) => {
    if (entity.id && entity.id.startsWith("marcador_entorno_")) {
      const position = entity.position.getValue(viewer.clock.currentTime);
      if (position) {
        positions.push(position);
      }
    }
  });

  if (positions.length > 0) {
    flyToView(positions);
  }

  // Activate "Todos" button
  updateEntornoButtonsState("Todos");
}
// Clear route
function clearRoute() {
  if (window.currentRoute) {
    viewer.entities.remove(window.currentRoute);
    window.currentRoute = null;
  }
}
// Function to filter environment markers by type
async function filterEntornoByType(tipo) {
  // Close location modal if open
  const locationModal = document.getElementById("aroundModalOverlay");
  if (locationModal) locationModal.style.display = "none";

  // Clear previous route if exists
  clearRoute();

  // Remover marcadores del entorno existentes
  const entitiesToRemove = viewer.entities.values.filter(
    (entity) => entity.id && entity.id.startsWith("marcador_entorno_")
  );
  entitiesToRemove.forEach((entity) => viewer.entities.remove(entity));

  // Si es "Todos", cargar sin filtro, sino filtrar por tipo
  const filterType = tipo === "Todos" ? null : tipo;
  await loadEntornoMarkers(filterType);

  // Reconfigurar event handlers después de cargar nuevos marcadores
  hoverMarcadores();
  clickMarcadoresAround();

  // Actualizar estado visual de los botones
  updateEntornoButtonsState(tipo);
}

// Function to load environment markers from entorno.geojson
async function loadEntornoMarkers(filterType = null) {
  try {
    const response = await fetch("./data/entorno.geojson");
    const entornoData = await response.json();

    if (entornoData && entornoData.features) {
      const positions = [];

      // Filtrar features por tipo si se especifica
      const filteredFeatures = filterType
        ? entornoData.features.filter(
            (feature) => feature.properties.tipo === filterType
          )
        : entornoData.features;

      filteredFeatures.forEach((feature) => {
        const fid = feature.properties.fid;
        const tipo = feature.properties.tipo;
        const nombre = feature.properties.nombre;
        const icono = feature.properties.icono;
        const coordinates = feature.geometry.coordinates;
        const imagen = feature.properties.imagen;

        viewer.entities.add({
          id: `marcador_entorno_${fid}`,
          position: window.Cesium.Cartesian3.fromDegrees(
            coordinates[0],
            coordinates[1]
          ),
          billboard: {
            image: icono,
            height: 80,
            verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
            horizontalOrigin: window.Cesium.HorizontalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            color: window.Cesium.Color.WHITE,
            scale: 1.0,
            show: true,
            alignedAxis: window.Cesium.Cartesian3.ZERO,
            pixelOffset: window.Cesium.Cartesian2.ZERO,
            eyeOffset: window.Cesium.Cartesian3.ZERO,
            heightReference: window.Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          properties: {
            type: "entorno",
            fid: fid,
            tipo: tipo,
            nombre: nombre,
            coordinates: coordinates,
            imagen: imagen,
          },
        });

        positions.push(
          window.Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1])
        );
      });

      // Hover marcadores
      hoverMarcadores();

      // Click marcadores entorno
      clickMarcadoresAround();

      // Adjust camera to show all markers
      flyToView(positions);
    }
  } catch (error) {
    console.error("Error al cargar los marcadores del entorno:", error);
  }
}

// Function to configure environment marker interactions
function clickMarcadoresAround() {
  // Remover handler anterior si existe
  if (window.entornoClickHandler) {
    viewer.screenSpaceEventHandler.removeInputAction(
      window.Cesium.ScreenSpaceEventType.LEFT_CLICK
    );
  }

  // Click event for environment markers
  window.entornoClickHandler = viewer.screenSpaceEventHandler.setInputAction(
    function onLeftClick(movement) {
      const pickedObject = viewer.scene.pick(movement.position);

      // If nothing was clicked, exit
      if (!window.Cesium.defined(pickedObject)) return;

      // Verificar si el clic fue sobre un Entity con billboard
      if (pickedObject.id && pickedObject.id.billboard) {
        const locationId = pickedObject.id.id;
        const locationProperties = pickedObject.id.properties;

        // Si es un marcador del entorno, mostrar modal
        if (locationId && locationId.startsWith("marcador_entorno_")) {
          const position = locationProperties.coordinates._value;
          const nombre = locationProperties.nombre._value;
          const tipo = locationProperties.tipo._value;
          const imagen = locationProperties.imagen._value;

          // Show modal with location information
          showLocationModal(nombre, position, tipo, imagen);
        }
      }
    },
    window.Cesium.ScreenSpaceEventType.LEFT_CLICK
  );
}

// Function to show location modal
function showLocationModal(title, coordinates, tipo = null, imagen = null) {
  // Remove previous route if exists
  clearRoute();

  // Asegurar que el modal de entorno sea visible
  const aroundModalOverlay = document.getElementById("aroundModalOverlay");
  if (aroundModalOverlay) {
    aroundModalOverlay.style.display = "flex";
  }

  // Disparar evento para abrir el modal de entorno
  window.dispatchEvent(
    new CustomEvent("openEntornoModal", {
      detail: {
        title: title,
        coordinates: coordinates,
        tipo: tipo,
        imagen: imagen,
      },
    })
  );
}

// Function to calculate and show route
async function calculateRoute(token, start, end, tipo = null) {
  try {
    // Obtener la API key desde la variable global
    const openRouteServiceKey = token;

    if (!openRouteServiceKey) {
      console.error(
        "OpenRouteService API key no encontrada. Asegúrate de definir VITE_OPEN_ROUTE_SERVICE_KEY en tu archivo .env"
      );
      return false;
    }

    const response = await fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?` +
        `api_key=${openRouteServiceKey}&` +
        `start=${start[0]},${start[1]}&` +
        `end=${end[0]},${end[1]}`
    );

    if (!response.ok) {
      throw new Error(`Error en la petición: ${response.status}`);
    }

    const data = await response.json();
    const coords = data.features[0].geometry.coordinates;
    const positions = [];
    coords.forEach((coord) => {
      positions.push(coord[0], coord[1]);
    });

    // Extract time and distance information
    const duration = data.features[0].properties.summary.duration; // in seconds
    const distance = data.features[0].properties.summary.distance; // in meters
    const durationMinutes = Math.round(duration / 60); // convert to minutes

    // Remove previous route if exists
    clearRoute();

    // Select color according to type
    const colorMap = {
      Playas: new window.Cesium.Color(251 / 255, 224 / 255, 73 / 255, 1.0),
      Restaurantes: new window.Cesium.Color(
        29 / 255,
        183 / 255,
        121 / 255,
        1.0
      ),
      Hoteles: new window.Cesium.Color(251 / 255, 195 / 255, 145 / 255, 1.0),
      Turismo: new window.Cesium.Color(251 / 255, 73 / 255, 73 / 255, 1.0),
      Seguridad: new window.Cesium.Color(73 / 255, 156 / 255, 251 / 255, 1.0),
    };

    const routeColor =
      tipo && colorMap[tipo]
        ? colorMap[tipo]
        : new window.Cesium.Color(0.1, 0.1, 0.1, 1.0);

    const boundingSphere = window.Cesium.BoundingSphere.fromPoints(
      window.Cesium.Cartesian3.fromDegreesArray(positions)
    );
    // Crear la nueva ruta
    window.currentRoute = viewer.entities.add({
      name: "Ruta",
      polyline: {
        positions: window.Cesium.Cartesian3.fromDegreesArray(positions),
        width: 15,
        material: routeColor,
        clampToGround: true,
        shadows: window.Cesium.ShadowMode.DISABLED,
      },
    });

    // Move camera to frame everything
    viewer.camera.flyToBoundingSphere(boundingSphere, {
      duration: 2,
      offset: new window.Cesium.HeadingPitchRange(
        window.Cesium.Math.toRadians(0), // horizontal orientation
        window.Cesium.Math.toRadians(-30), // downward tilt
        boundingSphere.radius * 3 // distance so the entire route fits
      ),
    });

    // Return route information
    return {
      success: true,
      duration: durationMinutes,
      distance: Math.round(distance),
    };
  } catch (error) {
    console.error("Error al calcular la ruta:", error);
    return false;
  }
}

// Function to update visual state of environment buttons
function updateEntornoButtonsState(activeType) {
  const buttons = document.querySelectorAll(
    "#aroundButtonsContainer .around-button"
  );

  buttons.forEach((button) => {
    const buttonText = button.querySelector(".around-button span").textContent;

    if (buttonText === activeType) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
}

// Video

function handleVideo() {
  reiniciarMenu();

  // Activate video button
  const videoBtn = document.getElementById("video");
  if (videoBtn) videoBtn.classList.add("active");

  // Dispatch event to show video overlay
  window.dispatchEvent(new CustomEvent("openVideoOverlay"));
}

// Function to close video
function closeVideoOverlay() {
  // Pause and reset video if exists
  const video = document.getElementById("videoPlayer");
  if (video) {
    video.pause();
    video.currentTime = 0;
  }

  // Deactivate video button
  const videoBtn = document.getElementById("video");
  if (videoBtn) {
    videoBtn.classList.remove("active");
  }
}

// Expose additional functions globally
window.hoverMarcadores = hoverMarcadores;
window.clearRoute = clearRoute;
window.flyToView = flyToView;
window.reiniciarMenu = reiniciarMenu;
window.handleFotos = handleFotos;
window.handleAreasComunes = handleAreasComunes;
window.handleLotes = handleLotes;
window.handleEntorno = handleEntorno;
window.handleVideo = handleVideo;
window.clickMarcadores360 = clickMarcadores360;
window.openOverlay360 = openOverlay360;
window.closeOverlay360 = closeOverlay360;
window.populateAreasModal = populateAreasModal;
window.openAreasComunesImage = openAreasComunesImage;
window.loadLotData = loadLotData;
window.applyFilters = applyFilters;
window.applySorting = applySorting;
window.renderLotCards = renderLotCards;
window.filterEntornoByType = filterEntornoByType;
window.loadEntornoMarkers = loadEntornoMarkers;
window.clickMarcadoresAround = clickMarcadoresAround;
window.showLocationModal = showLocationModal;
window.calculateRoute = calculateRoute;
window.updateEntornoButtonsState = updateEntornoButtonsState;
window.resetEntornoToInitialState = resetEntornoToInitialState;
window.closeVideoOverlay = closeVideoOverlay;
window.flyToAreaComun = flyToAreaComun;

// Bottom bar

function moveCameraUp() {
  const cam = viewer.camera;
  const getStep = () => Math.max(5.0, cam.positionCartographic.height * 0.1);

  const currentPosition = cam.position;
  const newPosition = window.Cesium.Cartesian3.add(
    currentPosition,
    window.Cesium.Cartesian3.multiplyByScalar(
      cam.up,
      getStep(),
      new window.Cesium.Cartesian3()
    ),
    new window.Cesium.Cartesian3()
  );

  cam.flyTo({
    destination: newPosition,
    duration: 1.0,
  });
}

function moveCameraDown() {
  const cam = viewer.camera;
  const getStep = () => Math.max(5.0, cam.positionCartographic.height * 0.1);

  const currentPosition = cam.position;
  const newPosition = window.Cesium.Cartesian3.subtract(
    currentPosition,
    window.Cesium.Cartesian3.multiplyByScalar(
      cam.up,
      getStep(),
      new window.Cesium.Cartesian3()
    ),
    new window.Cesium.Cartesian3()
  );

  cam.flyTo({
    destination: newPosition,
    duration: 1.0,
  });
}

function zoomIn() {
  const cam = viewer.camera;
  const getZoomStep = () =>
    Math.max(1.0, cam.positionCartographic.height * 0.15);

  const currentHeight = cam.positionCartographic.height;
  const newHeight = Math.max(10, currentHeight - getZoomStep());

  cam.flyTo({
    destination: window.Cesium.Cartesian3.fromRadians(
      cam.positionCartographic.longitude,
      cam.positionCartographic.latitude,
      newHeight
    ),
    duration: 1.0,
  });
}

function zoomOut() {
  const cam = viewer.camera;
  const getZoomStep = () =>
    Math.max(1.0, cam.positionCartographic.height * 0.15);

  const currentHeight = cam.positionCartographic.height;
  const newHeight = currentHeight + getZoomStep();

  cam.flyTo({
    destination: window.Cesium.Cartesian3.fromRadians(
      cam.positionCartographic.longitude,
      cam.positionCartographic.latitude,
      newHeight
    ),
    duration: 1.0,
  });
}

function goHome() {
  try {
    flyToLotesView();
  } catch (error) {
    console.error("Error al volar a la vista superior:", error);
  }
}

function view3D() {
  const boundingSphere =
    window.Cesium.BoundingSphere.fromPoints(lotesPositions);
  viewer.camera.flyToBoundingSphere(boundingSphere, {
    offset: new window.Cesium.HeadingPitchRange(
      window.Cesium.Math.toRadians(0.0),
      window.Cesium.Math.toRadians(-15.0),
      boundingSphere.radius * 3
    ),
  });
}

// Update labels when window is resized
function updateLabelsOnResize() {
  if (window.polygonLabels && window.polygonLabels.length > 0) {
    window.polygonLabels.forEach(labelEntity => {
      if (labelEntity.label) {
        labelEntity.label.font = getLabelFont();
        labelEntity.label.scale = getLabelScale();
        labelEntity.label.outlineWidth = getLabelOutlineWidth();
      }
    });
  }
}

// Add resize listener
window.addEventListener('resize', updateLabelsOnResize);

function toggleGrid() {
  const btnGrid = document.getElementById("grid");

  if (!lotesDataSource) return;
  const entitiesAll = lotesDataSource.entities.values.filter((e) => e.polygon);
  entitiesAll.forEach((e) => {
    console.log(e.properties.manzana._value);
    console.log(e.properties.lote._value);
    const loteValue = e.properties.lote ? e.properties.lote.getValue() : "";
    if (loteValue === "") {
      e.polygon.material = disponible.withAlpha(0);
      e._baseMaterial = disponible.withAlpha(0);
      return;
    }

    if (btnGrid.classList.contains("active")) {
      if (e.properties.estado.getValue() === "disponible") {
        e._baseMaterial = disponible.withAlpha(0.5);
      } else if (e.properties.estado.getValue() === "reservado") {
        e._baseMaterial = reservado.withAlpha(0.5);
      } else if (e.properties.estado.getValue() === "vendido") {
        e._baseMaterial = vendido.withAlpha(0.5);
      }
      if (e !== selected) {
        e.polygon.material = e._baseMaterial;
      }
    } else {
      if (e !== selected) {
        e.polygon.material = modeSelected.withAlpha(0.1);
      }
      e._baseMaterial = modeSelected.withAlpha(0.1);
    }
  });

  if (btnGrid.classList.contains("active")) {
    btnGrid.classList.remove("active");
  } else {
    btnGrid.classList.add("active");
  }

  if (viewer) viewer.scene.requestRender();
}

window.moveCameraUp = moveCameraUp;
window.moveCameraDown = moveCameraDown;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.goHome = goHome;
window.view3D = view3D;
window.toggleGrid = toggleGrid;
