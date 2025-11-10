import { Component, OnInit, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { MaterialService } from '../../services/material.service';
import { Material } from '../../models/material.model';
import { GovernmentColors } from '../../config/colors.config';

interface RestrictedZone {
  id: string;
  name: string;
  type: string;
  coordinates: number[][][];
  bufferDistance: number;
  source: 'geojson' | 'manual';
}

interface AnalysisResult {
  isValid: boolean;
  restrictions: string[];
  nearestMaterials: {
    material: Material;
    distance: number;
    travelTime: number;
  }[];
  recommendations: string[];
}

interface GeoJSONFeature {
  type: string;
  properties: {
    name: string;
    [key: string]: any;
  };
  geometry: {
    type: string;
    coordinates: any;
  };
}

interface GeoJSONData {
  type: string;
  features: GeoJSONFeature[];
}

@Component({
  selector: 'app-decision-support',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './decision-support.html',
  styleUrls: ['./decision-support.scss']
})
export class DecisionSupport implements OnInit, AfterViewInit {
  private materialService = inject(MaterialService);
  private http = inject(HttpClient);
  
  private map: L.Map | undefined;
  private markers: L.Marker[] = [];
  private siteMarker: L.Marker | null = null;
  private restrictedZonesLayer: L.LayerGroup | undefined;
  private bufferZonesLayer: L.LayerGroup | undefined;
  private materialMarkersLayer: L.LayerGroup | undefined;
  
  materials = signal<Material[]>([]);
  selectedSite = signal<{ lat: number; lng: number } | null>(null);
  analysisResult = signal<AnalysisResult | null>(null);
  isLoading = signal(false);
  isAnalyzing = signal(false);
  isLoadingRestrictions = signal(false);
  
  Math = Math;
  restrictedZonesData: RestrictedZone[] = [];

  ngOnInit() {
    this.loadRestrictedZones();
    this.loadMaterials();
  }

  ngAfterViewInit() {
    this.initMap();
  }

  public async loadRestrictedZones(): Promise<void> {
    this.isLoadingRestrictions.set(true);
    
    try {
      await this.loadGeoJSONData();
      console.log('Loaded restricted zones from GeoJSON:', this.restrictedZonesData.length);
    } catch (error) {
      console.error('Error loading restricted zones from GeoJSON:', error);
      this.loadManualRestrictedZones();
    } finally {
      this.isLoadingRestrictions.set(false);
    }
  }

private async loadGeoJSONData(): Promise<void> {
  try {
    console.log('Attempting to load GeoJSON data...');
    
    // Try multiple possible paths
    const possiblePaths = [
      '/geojson.geojson',
      '/geojson.geojson',
      './geojson.geojson',
      '/geojson.geojson'
    ];

    let geojsonData: GeoJSONData | undefined;
    let loadedPath = '';

    for (const path of possiblePaths) {
      try {
        console.log(`Trying to load from: ${path}`);
        geojsonData = await this.http.get<GeoJSONData>(path).toPromise();
        loadedPath = path;
        console.log(`✅ Successfully loaded GeoJSON from: ${path}`);
        break;
      } catch (error) {
        console.warn(`❌ Failed to load from ${path}:`, error);
        continue;
      }
    }

    if (!geojsonData) {
      console.warn('⚠️ Could not load GeoJSON from any path, using manual data');
      throw new Error('GeoJSON not found');
    }

    if (geojsonData?.features) {
      console.log(`📊 Processing ${geojsonData.features.length} features from GeoJSON`);
      this.processGeoJSONFeatures(geojsonData.features);
    } else {
      throw new Error('Invalid GeoJSON data structure - no features found');
    }
  } catch (error) {
    console.error('🚨 Failed to load GeoJSON file:', error);
    throw error;
  }
}
  private processGeoJSONFeatures(features: GeoJSONFeature[]): void {
    features.forEach((feature, index) => {
      if (!feature.properties?.name) return;

      const zoneType = this.determineZoneType(feature);
      const bufferDistance = this.getBufferDistance(zoneType);
      
      let coordinates: number[][][] = [];

      try {
        if (feature.geometry.type === 'Polygon') {
          coordinates = feature.geometry.coordinates;
        } else if (feature.geometry.type === 'MultiPolygon') {
          // Use the first polygon for simplicity, or you can handle all polygons
          coordinates = feature.geometry.coordinates[0];
        } else if (feature.geometry.type === 'Point') {
          const point = feature.geometry.coordinates;
          const circle = turf.circle(point, 0.5, { units: 'kilometers' });
          coordinates = [(circle.geometry as any).coordinates];
        } else {
          console.warn(`Unsupported geometry type: ${feature.geometry.type}`);
          return;
        }

        if (coordinates.length > 0) {
          this.restrictedZonesData.push({
            id: `geojson-${feature.properties.name}-${index}`,
            name: feature.properties.name,
            type: zoneType,
            coordinates: coordinates,
            bufferDistance: bufferDistance,
            source: 'geojson'
          });
        }
      } catch (error) {
        console.warn('Error processing GeoJSON feature:', feature.properties.name, error);
      }
    });
  }

private determineZoneType(feature: GeoJSONFeature): string {
  const name = feature.properties.name?.toLowerCase() || '';
  const otherProps = JSON.stringify(feature.properties).toLowerCase();

  // Check for airport-related terms
  if (name.includes('airport') || name.includes('aerodrome') || otherProps.includes('aeroway')) {
    return 'Airport';
  }
  
  // Check for protected area terms
  if (name.includes('national park') || name.includes('reserve') || name.includes('protected') || 
      name.includes('conservancy') || name.includes('wildlife')) {
    return 'Protected Area';
  }
  
  // Check for water body terms
  if (name.includes('lake') || name.includes('river') || name.includes('water') || 
      name.includes('reservoir') || otherProps.includes('natural=water')) {
    return 'Water Body';
  }

  // Default based on properties - FIXED: Use bracket notation for index signature properties
  if (feature.properties['boundary'] === 'national_park' || feature.properties['boundary'] === 'protected_area') {
    return 'Protected Area';
  }
  
  if (feature.properties['aeroway']) {
    return 'Airport';
  }
  
  if (feature.properties['natural'] === 'water') {
    return 'Water Body';
  }

  return 'Restricted Area';
}

  private getBufferDistance(zoneType: string): number {
    switch (zoneType) {
      case 'Protected Area':
        return 2000; // 2km buffer
      case 'Airport':
        return 3000; // 3km buffer
      case 'Water Body':
        return 500;  // 500m buffer
      default:
        return 1000; // 1km buffer for other restricted areas
    }
  }

  private loadManualRestrictedZones(): void {
    // Fallback data in case GeoJSON fails to load
    this.restrictedZonesData = [
      {
        id: 'manual-1',
        name: 'Nairobi National Park',
        type: 'Protected Area',
        coordinates: [[
          [36.75, -1.40],
          [36.95, -1.40],
          [36.95, -1.20],
          [36.75, -1.20],
          [36.75, -1.40]
        ]],
        bufferDistance: 2000,
        source: 'manual'
      },
      {
        id: 'manual-2',
        name: 'Jomo Kenyatta International Airport',
        type: 'Airport',
        coordinates: [[
          [36.92, -1.33],
          [36.98, -1.33],
          [36.98, -1.30],
          [36.92, -1.30],
          [36.92, -1.33]
        ]],
        bufferDistance: 3000,
        source: 'manual'
      },
      {
        id: 'manual-3',
        name: 'Lake Naivasha',
        type: 'Water Body',
        coordinates: [[
          [36.35, -0.70],
          [36.45, -0.70],
          [36.45, -0.75],
          [36.35, -0.75],
          [36.35, -0.70]
        ]],
        bufferDistance: 500,
        source: 'manual'
      }
    ];
  }

  private initMap(): void {
    this.map = L.map('decision-map', {
      center: [-1.2921, 36.8219],
      zoom: 7,
      zoomControl: false
    });

    L.control.zoom({
      position: 'topright'
    }).addTo(this.map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(this.map);

    // Initialize layer groups
    this.restrictedZonesLayer = L.layerGroup();
    this.bufferZonesLayer = L.layerGroup();
    this.materialMarkersLayer = L.layerGroup();

    // Add overlay control
    const overlayMaps: { [key: string]: L.LayerGroup } = {
      "Restricted Zones": this.restrictedZonesLayer,
      "Buffer Zones": this.bufferZonesLayer,
      "Material Sites": this.materialMarkersLayer
    };

    L.control.layers({}, overlayMaps, {
      position: 'topright',
      collapsed: false
    }).addTo(this.map);

    // Add layers to map by default
    this.restrictedZonesLayer.addTo(this.map);
    this.bufferZonesLayer.addTo(this.map);
    this.materialMarkersLayer.addTo(this.map);

    setTimeout(() => {
      this.addRestrictedZones();
    }, 1000);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.onMapClick(e.latlng);
    });
  }

  private addRestrictedZones(): void {
    if (!this.map || this.restrictedZonesData.length === 0 || !this.restrictedZonesLayer || !this.bufferZonesLayer) return;

    // Clear existing layers
    this.restrictedZonesLayer.clearLayers();
    this.bufferZonesLayer.clearLayers();

    this.restrictedZonesData.forEach(zone => {
      try {
        // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
        const leafletCoords = zone.coordinates[0].map(coord => {
          // Handle both [lng, lat] and [lat, lng] formats
          if (coord.length === 2) {
            // Assume GeoJSON format: [lng, lat]
            return [coord[1], coord[0]] as [number, number];
          }
          return coord as [number, number];
        });
        
        // Add main restricted zone polygon
        const polygon = L.polygon(leafletCoords, {
          color: this.getZoneColor(zone.type),
          fillColor: this.getZoneColor(zone.type),
          fillOpacity: 0.3,
          weight: 2
        }).addTo(this.restrictedZonesLayer!);

        // Add buffer zone
        const zonePolygon = turf.polygon(zone.coordinates);
        const buffer = turf.buffer(zonePolygon, zone.bufferDistance / 1000, { units: 'kilometers' });
        
        if (buffer && buffer.geometry) {
          const bufferCoords = (buffer.geometry as any).coordinates[0].map((coord: number[]) => {
            // Convert from [lng, lat] to [lat, lng]
            return [coord[1], coord[0]] as [number, number];
          });
          
          L.polygon(bufferCoords, {
            color: this.getZoneColor(zone.type),
            fillColor: this.getZoneColor(zone.type),
            fillOpacity: 0.1,
            weight: 1,
            dashArray: '5,5'
          }).addTo(this.bufferZonesLayer!);
        }

        polygon.bindPopup(`
          <div>
            <h3>${zone.name}</h3>
            <p><strong>Type:</strong> ${zone.type}</p>
            <p><strong>Buffer:</strong> ${zone.bufferDistance}m</p>
            <p><strong>Source:</strong> Local GeoJSON Data</p>
            <p><em>Construction restricted in this area</em></p>
          </div>
        `);

      } catch (error) {
        console.warn('Error adding zone to map:', zone.name, error);
      }
    });
  }

  private getZoneColor(zoneType: string): string {
    switch (zoneType) {
      case 'Protected Area':
        return GovernmentColors.kenyaGreen;
      case 'Airport':
        return GovernmentColors.kenyaRed;
      case 'Water Body':
        return GovernmentColors.kbrcBlue;
      default:
        return GovernmentColors.kbrcGray;
    }
  }

  private loadMaterials(): void {
    this.isLoading.set(true);
    
    // Direct API call for faster loading
    this.http.get<any[]>('https://timbuabackend.onrender.com/api/material-sites').subscribe({
      next: (response) => {
        const materials = this.transformApiResponse(response);
        this.materials.set(materials);
        this.addMaterialMarkers();
        this.isLoading.set(false);
        console.log('Loaded materials from API:', materials.length);
      },
      error: (error) => {
        console.error('Error loading materials from API:', error);
        // Fallback to service if direct API fails
        this.materialService.getMaterials().subscribe({
          next: (materials) => {
            this.materials.set(materials);
            this.addMaterialMarkers();
            this.isLoading.set(false);
          },
          error: (serviceError) => {
            console.error('Error loading materials from service:', serviceError);
            this.materials.set([]);
            this.isLoading.set(false);
          }
        });
      }
    });
  }

private transformApiResponse(apiData: any[]): Material[] {
  return apiData.map(item => {
    // Extract material types from the response
    let materialTypes: string[] = [];
    if (item.material) {
      // Handle different material formats
      if (Array.isArray(item.material)) {
        materialTypes = item.material;
      } else if (typeof item.material === 'string') {
        // Split comma-separated materials
        materialTypes = item.material.split(',').map((m: string) => m.trim());
      } else {
        materialTypes = [String(item.material)];
      }
    } else {
      materialTypes = ['Unknown'];
    }

    // Extract location name
    const locationName = item.materialLocation || item.location?.name || 'Unknown Location';
    
    // Ensure coordinates are numbers
    const latitude = Number(item.latitude) || -1.2921;
    const longitude = Number(item.longitude) || 36.8219;

    return {
      id: item._id || item.id || `material-${item.questionnaireNo || 'unknown'}`,
      questionnaireNo: item.questionnaireNo?.toString() || 'N/A',
      researchAssistantNo: item.researchAssistantNo || 'N/A',
      name: item.material || 'Unnamed Material',
      type: materialTypes,
      location: {
        name: locationName,
        latitude: latitude,
        longitude: longitude,
        county: item.location?.county || 'Unknown',
        subCounty: item.location?.subCounty || 'Unknown',
        ward: item.location?.ward || 'Unknown'
      },
      challenges: Array.isArray(item.challenges) ? item.challenges : [],
      recommendations: Array.isArray(item.recommendations) ? item.recommendations : [],
      timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
      icon: this.getMaterialIcon(materialTypes),
      // Additional properties from the API
      additionalInfo: {
        materialUsage: item.materialUsage,
        materialUsedIn: item.materialUsedIn,
        numberOfPeopleEmployed: item.numberOfPeopleEmployed,
        ownerOfMaterial: item.ownerOfMaterial,
        periodOfManufacture: item.periodOfManufacture,
        similarLocations: item.similarLocations,
        sizeOfManufacturingIndustry: item.sizeOfManufacturingIndustry,
        volumeProducedPerDay: item.volumeProducedPerDay
      }
    };
  });
}

  private getMaterialIcon(materialTypes: string[]): string {
    const types = materialTypes.map(t => t.toLowerCase());
    
    if (types.some(t => t.includes('sand'))) return '🏖️';
    if (types.some(t => t.includes('ballast'))) return '⛰️';
    if (types.some(t => t.includes('block'))) return '🧱';
    if (types.some(t => t.includes('rock'))) return '🪨';
    if (types.some(t => t.includes('cement'))) return '🏭';
    if (types.some(t => t.includes('clay'))) return '🟫';
    if (types.some(t => t.includes('stone'))) return '🔶';
    
    return '📦';
  }

  private addMaterialMarkers(): void {
    if (!this.map || !this.materialMarkersLayer) return;

    // Clear existing markers
    this.materialMarkersLayer.clearLayers();
    this.markers = [];

    this.materials().forEach(material => {
      // Check if material and material.type exist
      if (!material || !material.type) {
        console.warn('Invalid material data:', material);
        return;
      }

      const markerColor = this.getMarkerColor(material);
      
      const marker = L.marker([material.location.latitude, material.location.longitude], {
        icon: L.divIcon({
          className: 'material-marker',
          html: this.createMarkerHtml(material.icon || '📦', markerColor),
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        })
      });

      marker.bindPopup(this.createMaterialPopup(material));
      marker.addTo(this.materialMarkersLayer!);
      this.markers.push(marker);
    });
  }

  private onMapClick(latlng: L.LatLng): void {
    if (this.siteMarker) {
      this.map!.removeLayer(this.siteMarker);
    }

    this.siteMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'site-marker',
        html: this.createSiteMarkerHtml(),
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      })
    }).addTo(this.map!);

    this.selectedSite.set({ lat: latlng.lat, lng: latlng.lng });
    this.analyzeSite(latlng);
  }

  private analyzeSite(latlng: L.LatLng): void {
    this.isAnalyzing.set(true);
    
    setTimeout(() => {
      const sitePoint = turf.point([latlng.lng, latlng.lat]);
      const restrictions: string[] = [];
      
      this.restrictedZonesData.forEach(zone => {
        try {
          const zonePolygon = turf.polygon(zone.coordinates);
          const isInZone = turf.booleanPointInPolygon(sitePoint, zonePolygon);
          
          if (isInZone) {
            restrictions.push(`🚫 Site is inside ${zone.name} (${zone.type})`);
          } else {
            const buffer = turf.buffer(zonePolygon, zone.bufferDistance / 1000, { units: 'kilometers' });
            if (buffer) {
              const isInBuffer = turf.booleanPointInPolygon(sitePoint, buffer);
              if (isInBuffer) {
                restrictions.push(`⚠️ Site is within ${zone.bufferDistance}m buffer of ${zone.name}`);
              }
            }
          }
        } catch (error) {
          console.warn('Error checking zone:', zone.name, error);
        }
      });

      const nearestMaterials = this.findNearestMaterials(latlng);
      const recommendations = this.generateRecommendations(restrictions, nearestMaterials);
      
      this.analysisResult.set({
        isValid: restrictions.length === 0,
        restrictions,
        nearestMaterials,
        recommendations
      });
      
      this.isAnalyzing.set(false);
    }, 1000);
  }

  private findNearestMaterials(site: L.LatLng): AnalysisResult['nearestMaterials'] {
    const sitePoint = turf.point([site.lng, site.lat]);
    
    return this.materials()
      .map(material => {
        const materialPoint = turf.point([material.location.longitude, material.location.latitude]);
        const distance = turf.distance(sitePoint, materialPoint, { units: 'kilometers' }) * 1000; // Convert to meters
        const travelTime = (distance / 1000) / 40 * 60; // Assuming 40 km/h average speed
        
        return {
          material,
          distance: Math.round(distance),
          travelTime: Math.round(travelTime)
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }

  private generateRecommendations(restrictions: string[], nearestMaterials: AnalysisResult['nearestMaterials']): string[] {
    const recommendations: string[] = [];

    if (restrictions.length > 0) {
      recommendations.push('❌ Site has regulatory restrictions - consider alternative location');
      recommendations.push('📋 Required: Environmental impact assessment and permits');
    } else {
      recommendations.push('✅ Site appears regulatory compliant');
      recommendations.push('📝 Proceed with standard construction approval process');
    }

    if (nearestMaterials.length > 0) {
      const closest = nearestMaterials[0];
      
      if (closest.distance < 2000) {
        recommendations.push('🚚 Excellent material accessibility (< 2km)');
      } else if (closest.distance < 5000) {
        recommendations.push('🚛 Good material availability (2-5km)');
      } else {
        recommendations.push('💰 Consider transportation costs for distant materials');
      }

      recommendations.push(`📦 Nearest source: ${closest.material.name} (${closest.distance}m)`);

      const materialTypes = new Set(nearestMaterials.flatMap(item => item.material.type));
      
      if (materialTypes.has('Sand')) {
        recommendations.push('💧 Consider water requirements for sand-based materials');
      }
      if (materialTypes.has('Blocks')) {
        recommendations.push('🏗️ Block materials suitable for foundation work');
      }
      if (materialTypes.has('Ballast')) {
        recommendations.push('🛣️ Ballast ideal for road construction and foundations');
      }
    } else {
      recommendations.push('❌ No material sources found nearby');
      recommendations.push('🔍 Expand search radius or consider alternative materials');
    }

    if (restrictions.some(r => r.includes('Water Body'))) {
      recommendations.push('💧 Water body nearby - consider flood risk and water table');
    }

    if (restrictions.some(r => r.includes('Protected Area'))) {
      recommendations.push('🌿 Near protected area - enhanced environmental compliance required');
    }

    if (restrictions.some(r => r.includes('Airport'))) {
      recommendations.push('✈️ Near airport - height restrictions and noise considerations apply');
    }

    return recommendations;
  }

  private getMarkerColor(material: Material): string {
    // Added null checks for material.type
    if (!material || !material.type) {
      return GovernmentColors.kbrcGray;
    }

    const types = material.type.map(t => t.toLowerCase());
    
    if (types.some(t => t.includes('sand'))) return GovernmentColors.kbrcBlue;
    if (types.some(t => t.includes('block'))) return GovernmentColors.kenyaGreen;
    if (types.some(t => t.includes('ballast'))) return GovernmentColors.kenyaRed;
    if (types.some(t => t.includes('rock'))) return GovernmentColors.kbrcDarkBlue;
    return GovernmentColors.kbrcGray;
  }

  private createMarkerHtml(icon: string, color: string): string {
    return `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      ">${icon}</div>
    `;
  }

  private createSiteMarkerHtml(): string {
    return `
      <div style="
        background-color: ${GovernmentColors.kenyaRed};
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: white;
      ">📍</div>
    `;
  }

  private createMaterialPopup(material: Material): string {
    return `
      <div style="min-width: 200px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 16px;">${material.icon || '📦'}</span>
          <h4 style="margin: 0; color: ${GovernmentColors.kbrcDarkBlue};">${material.name}</h4>
        </div>
        <p><strong>Location:</strong> ${material.location.name}</p>
        <p><strong>Types:</strong> ${material.type.join(', ')}</p>
        <p><strong>County:</strong> ${material.location.county}</p>
        <p><strong>Sub-County:</strong> ${material.location.subCounty}</p>
        <p><strong>Ward:</strong> ${material.location.ward}</p>
      </div>
    `;
  }

  clearSite(): void {
    if (this.siteMarker) {
      this.map!.removeLayer(this.siteMarker);
      this.siteMarker = null;
    }
    this.selectedSite.set(null);
    this.analysisResult.set(null);
  }

  toggleLayer(layer: 'restricted' | 'buffer' | 'materials', show: boolean): void {
    if (!this.map) return;

    switch (layer) {
      case 'restricted':
        if (this.restrictedZonesLayer) {
          show ? this.map.addLayer(this.restrictedZonesLayer) : this.map.removeLayer(this.restrictedZonesLayer);
        }
        break;
      case 'buffer':
        if (this.bufferZonesLayer) {
          show ? this.map.addLayer(this.bufferZonesLayer) : this.map.removeLayer(this.bufferZonesLayer);
        }
        break;
      case 'materials':
        if (this.materialMarkersLayer) {
          show ? this.map.addLayer(this.materialMarkersLayer) : this.map.removeLayer(this.materialMarkersLayer);
        }
        break;
    }
  }
}