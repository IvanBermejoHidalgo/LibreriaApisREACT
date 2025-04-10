import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// Configuración de iconos
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const restaurantIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1679/1679018.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

function App() {
  const [provinces, setProvinces] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [loading, setLoading] = useState(false);

  // 1. Cargar provincias
  useEffect(() => {
    axios.get('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-provinces.geojson')
      .then(response => setProvinces(response.data))
      .catch(error => {
        console.error("Error cargando provincias:", error);
      });
  }, []);

  // 2. Buscar restaurantes (limitado a 50)
  const fetchRestaurants = async (provinceName) => {
    setLoading(true);
    setSelectedProvince(provinceName);
    setRestaurants([]);
    
    try {
      // Obtener coordenadas del centro
      const nominatimResponse = await axios.get(
        `https://nominatim.openstreetmap.org/search?q=${provinceName}, España&format=json&polygon=1&addressdetails=1`
      );
      
      if (nominatimResponse.data.length > 0) {
        const { lat, lon } = nominatimResponse.data[0];
        
        // Consulta optimizada con límite de 50 resultados
        const overpassQuery = `
          [out:json];
          (
            node[amenity=restaurant](around:10000,${lat},${lon});
            way[amenity=restaurant](around:10000,${lat},${lon});
            relation[amenity=restaurant](around:10000,${lat},${lon});
          );
          out body ${50};
          >;
          out skel qt;
        `;
        
        const response = await axios.get(
          `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`
        );

        // Procesar solo los primeros 50 resultados
        const limitedResults = response.data.elements
          .filter(el => el.lat && el.lon || el.center)
          .map(el => ({
            id: el.id,
            lat: el.lat || el.center.lat,
            lon: el.lon || el.center.lon,
            tags: el.tags || {}
          }))
          .slice(0, 50); // Aseguramos el límite

        setRestaurants(limitedResults);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Estilos (igual que antes)
  const provinceStyle = {
    fillColor: "#4CAF50",
    weight: 1,
    opacity: 1,
    color: "#2E7D32",
    fillOpacity: 0.4,
  };

  const highlightStyle = {
    fillColor: "#FFC107",
    weight: 2,
    opacity: 1,
    color: "#FFA000",
    fillOpacity: 0.7,
  };

  const onEachProvince = (feature, layer) => {
    layer.on({
      mouseover: (e) => {
        layer.setStyle(highlightStyle);
        layer.bindTooltip(feature.properties.name).openTooltip();
      },
      mouseout: (e) => {
        layer.setStyle(provinceStyle);
        layer.closeTooltip();
      },
      click: () => {
        fetchRestaurants(feature.properties.name);
      }
    });
  };

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <h1 style={{ textAlign: "center", padding: "10px", backgroundColor: "#2E7D32", color: "white" }}>
        Restaurantes por Provincia (Límite: 50)
      </h1>
      
      <div style={{ padding: "10px", backgroundColor: "#f5f5f5" }}>
        {selectedProvince && (
          <div>
            <h3 style={{ margin: 0 }}>
              {loading ? "Buscando..." : `Mostrando ${restaurants.length} restaurantes en ${selectedProvince}`}
            </h3>
            {!loading && restaurants.length === 50 && (
              <p style={{ margin: "5px 0 0", color: "#d32f2f" }}>
                Se muestran solo los primeros 50 resultados
              </p>
            )}
          </div>
        )}
      </div>
      
      <MapContainer 
        center={[40.4168, -3.7038]} 
        zoom={6} 
        style={{ height: "calc(100% - 100px)", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {provinces && (
          <GeoJSON
            data={provinces}
            style={provinceStyle}
            onEachFeature={onEachProvince}
          />
        )}

        {restaurants.map((restaurant, index) => (
          <Marker 
            key={`${restaurant.id}-${index}`} 
            position={[restaurant.lat, restaurant.lon]} 
            icon={restaurantIcon}
          >
            <Popup>
              <div>
                <h3>{restaurant.tags?.name || `Restaurante ${index + 1}`}</h3>
                {restaurant.tags?.cuisine && <p><strong>Cocina:</strong> {restaurant.tags.cuisine}</p>}
                <p><strong>Provincia:</strong> {selectedProvince}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default App;