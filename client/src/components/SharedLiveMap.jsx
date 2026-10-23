import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function SharedLiveMap({ request, role = 'donor' }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const polylineRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Default coordinates (Central Pune)
    const defaultCenter = [18.5284, 73.8567];

    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: true
      });

      // Dark / Sleek Map tiles via CartoDB or OpenStreetMap
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Custom Leaflet Icons using HTML emoji/badges
    const createCustomIcon = (emoji, label, color) => {
      return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="
            background: ${color};
            color: #ffffff;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.45);
            border: 3px solid #ffffff;
            position: relative;
          ">
            ${emoji}
            <div style="
              position: absolute;
              bottom: -20px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(15, 23, 42, 0.9);
              color: #ffffff;
              padding: 2px 8px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
              border: 1px solid rgba(255,255,255,0.2);
            ">${label}</div>
          </div>
        `,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
        popupAnchor: [0, -21]
      });
    };

    // Clear old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (!request) return;

    const bounds = [];

    // 1. Donor Pickup Marker
    if (request.pickupLat && request.pickupLng) {
      const donorPos = [request.pickupLat, request.pickupLng];
      bounds.push(donorPos);

      const donorMarker = L.marker(donorPos, {
        icon: createCustomIcon('🏪', 'Pickup: ' + (request.donorName || 'Donor'), '#10b981')
      }).addTo(map);

      donorMarker.bindPopup(`
        <div style="font-family: inherit; color: #111827;">
          <h4 style="margin: 0 0 4px; color: #047857; font-size: 14px;">🏪 ${request.donorName || 'Donor'}</h4>
          <p style="margin: 0 0 4px; font-size: 12px;"><strong>Pickup:</strong> ${request.pickupAddress || 'Address'}</p>
          <p style="margin: 0; font-size: 12px;"><strong>Meal:</strong> ${request.mealName} (${request.quantityRequested} servings)</p>
        </div>
      `);
      markersRef.current.donor = donorMarker;
    }

    // 2. Receiver Destination Marker
    if (request.receiverLat && request.receiverLng) {
      const receiverPos = [request.receiverLat, request.receiverLng];
      bounds.push(receiverPos);

      const receiverMarker = L.marker(receiverPos, {
        icon: createCustomIcon('🏠', 'Destination: ' + (request.receiverName || 'Receiver'), '#6366f1')
      }).addTo(map);

      receiverMarker.bindPopup(`
        <div style="font-family: inherit; color: #111827;">
          <h4 style="margin: 0 0 4px; color: #4338ca; font-size: 14px;">🏠 ${request.receiverName || 'Shelter'}</h4>
          <p style="margin: 0 0 4px; font-size: 12px;"><strong>Destination:</strong> ${request.receiverAddress || 'Address'}</p>
          <p style="margin: 0; font-size: 12px;"><strong>ETA:</strong> ~${request.deliveryETA || 10} minutes</p>
        </div>
      `);
      markersRef.current.receiver = receiverMarker;
    }

    // 3. Rider Current / Simulated Marker
    const riderLat = request.currentRiderLat || request.pickupLat;
    const riderLng = request.currentRiderLng || request.pickupLng;

    if (riderLat && riderLng) {
      const riderPos = [riderLat, riderLng];
      bounds.push(riderPos);

      const riderMarker = L.marker(riderPos, {
        icon: createCustomIcon('🛵', (request.assignedRiderName || 'Rider') + ' (' + (request.simulationStep || 0) + '%)', '#f59e0b')
      }).addTo(map);

      riderMarker.bindPopup(`
        <div style="font-family: inherit; color: #111827;">
          <h4 style="margin: 0 0 4px; color: #b45309; font-size: 14px;">🛵 ${request.assignedRiderName || 'Volunteer Rider'}</h4>
          <p style="margin: 0 0 4px; font-size: 12px;"><strong>Status:</strong> ${request.assignmentStatus}</p>
          <p style="margin: 0 0 4px; font-size: 12px;"><strong>Vehicle:</strong> ${request.riderVehicle || 'Two-Wheeler'}</p>
          <p style="margin: 0; font-size: 12px;"><strong>Delivery ETA:</strong> ${request.deliveryETA || 0} mins</p>
        </div>
      `);
      markersRef.current.rider = riderMarker;
    }

    // Route Polyline
    if (request.pickupLat && request.pickupLng && request.receiverLat && request.receiverLng) {
      const lineCoords = [
        [request.pickupLat, request.pickupLng],
        [riderLat, riderLng],
        [request.receiverLat, request.receiverLng]
      ];

      const polyline = L.polyline(lineCoords, {
        color: '#6366f1',
        weight: 5,
        opacity: 0.85,
        dashArray: '8, 8',
        lineCap: 'round'
      }).addTo(map);

      polylineRef.current = polyline;
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [request]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} className="map-container" style={{ height: '380px' }} />

      {/* Map Legend & Realtime telemetry overlay */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(10px)',
        padding: '8px 14px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        fontSize: '0.78rem',
        color: '#ffffff',
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
      }}>
        <span>🏪 Pickup Point</span>
        <span>🛵 Rider Pos ({request?.simulationStep || 0}%)</span>
        <span>🏠 Destination</span>
        <span style={{ color: '#34d399', fontWeight: 'bold' }}>• ETA ~{request?.deliveryETA || 0}m</span>
      </div>
    </div>
  );
}
