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
  bounds?: [number, number, number, number]; // Use tuple type instead of turf.BBox
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

  // Performance optimization
  private analysisCache = new Map<string, AnalysisResult>();
  private materialCache = new Map<string, Material>();
  private lastAnalysisTime = 0;
  private readonly ANALYSIS_DEBOUNCE = 500; // ms

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
      
      // Use fetch API for better performance with large files
      const response = await fetch('/geojson.geojson');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const geojsonData: GeoJSONData = await response.json();
      
      if (geojsonData?.features) {
        console.log(`📊 Processing ${geojsonData.features.length} features from GeoJSON`);
        await this.processGeoJSONFeaturesOptimized(geojsonData.features);
      } else {
        throw new Error('Invalid GeoJSON data structure - no features found');
      }
    } catch (error) {
      console.error('🚨 Failed to load GeoJSON file:', error);
      throw error;
    }
  }

  // Optimized GeoJSON processing with batching and simplification
  private async processGeoJSONFeaturesOptimized(features: GeoJSONFeature[]): Promise<void> {
    const batchSize = 50; // Process in smaller batches
    const totalBatches = Math.ceil(features.length / batchSize);
    
    console.log(`🔄 Processing ${features.length} features in ${totalBatches} batches...`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, features.length);
      const batch = features.slice(startIndex, endIndex);

      // Process batch
      const batchResults = this.processFeatureBatch(batch, startIndex);
      this.restrictedZonesData.push(...batchResults);

      // Yield to UI every batch
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    console.log(`✅ Finished processing ${this.restrictedZonesData.length} restricted zones`);
  }

  private processFeatureBatch(features: GeoJSONFeature[], startIndex: number): RestrictedZone[] {
    const results: RestrictedZone[] = [];

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (!feature.properties?.name) continue;

      try {
        const zoneType = this.determineZoneType(feature);
        const bufferDistance = this.getBufferDistance(zoneType);
        
        let coordinates: number[][][] = [];

        if (feature.geometry.type === 'Polygon') {
          coordinates = this.simplifyPolygon(feature.geometry.coordinates);
        } else if (feature.geometry.type === 'MultiPolygon') {
          // Use only the first polygon for performance
          coordinates = this.simplifyPolygon(feature.geometry.coordinates[0]);
        } else if (feature.geometry.type === 'Point') {
          const point = feature.geometry.coordinates;
          // Use smaller circle for points to improve performance
          const circle = turf.circle(point, 0.2, { units: 'kilometers', steps: 8 });
          coordinates = [(circle.geometry as any).coordinates];
        } else {
          continue; // Skip unsupported types
        }

        if (coordinates.length > 0 && coordinates[0].length > 0) {
          const zone: RestrictedZone = {
            id: `geojson-${feature.properties.name}-${startIndex + i}`,
            name: feature.properties.name,
            type: zoneType,
            coordinates: coordinates,
            bufferDistance: bufferDistance,
            source: 'geojson'
          };
          
          // Pre-calculate bounds for spatial filtering
          zone.bounds = this.calculateBounds(coordinates[0]);
          results.push(zone);
        }
      } catch (error) {
        console.warn('Error processing GeoJSON feature:', feature.properties.name, error);
      }
    }

    return results;
  }

  // Simplify polygons to reduce complexity
  private simplifyPolygon(coordinates: number[][][]): number[][][] {
    if (!coordinates || coordinates.length === 0) return coordinates;
    
    const simplified = coordinates.map(polygon => {
      // Reduce points for performance - keep every 3rd point for large polygons
      if (polygon.length > 50) {
        return polygon.filter((_, index) => index % 3 === 0);
      }
      return polygon;
    });
    
    return simplified;
  }

  // Calculate bounding box for spatial filtering - FIXED: Use tuple type
  private calculateBounds(coordinates: number[][]): [number, number, number, number] {
    const lngs = coordinates.map(coord => coord[0]);
    const lats = coordinates.map(coord => coord[1]);
    
    return [
      Math.min(...lngs),
      Math.min(...lats),
      Math.max(...lngs),
      Math.max(...lats)
    ];
  }

  private determineZoneType(feature: GeoJSONFeature): string {
    const name = feature.properties.name?.toLowerCase() || '';
    const otherProps = JSON.stringify(feature.properties).toLowerCase();

    if (name.includes('airport') || name.includes('aerodrome') || otherProps.includes('aeroway')) {
      return 'Airport';
    }
    
    if (name.includes('national park') || name.includes('reserve') || name.includes('protected') || 
        name.includes('conservancy') || name.includes('wildlife')) {
      return 'Protected Area';
    }
    
    if (name.includes('lake') || name.includes('river') || name.includes('water') || 
        name.includes('reservoir') || otherProps.includes('natural=water')) {
      return 'Water Body';
    }

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
        return 2000;
      case 'Airport':
        return 3000;
      case 'Water Body':
        return 500;
      default:
        return 1000;
    }
  }

  private loadManualRestrictedZones(): void {
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

    this.restrictedZonesLayer.clearLayers();
    this.bufferZonesLayer.clearLayers();

    // Only render visible areas initially
    const bounds = this.map.getBounds();
    const visibleZones = this.restrictedZonesData.filter(zone => 
      this.isZoneVisible(zone, bounds)
    );

    console.log(`🗺️ Rendering ${visibleZones.length} of ${this.restrictedZonesData.length} zones`);

    visibleZones.forEach(zone => {
      this.addZoneToMap(zone);
    });
  }

  private isZoneVisible(zone: RestrictedZone, mapBounds: L.LatLngBounds): boolean {
    if (!zone.bounds) return true;
    
    const zoneBounds = L.latLngBounds(
      [zone.bounds[1], zone.bounds[0]], // [south, west]
      [zone.bounds[3], zone.bounds[2]]  // [north, east]
    );
    
    return mapBounds.intersects(zoneBounds);
  }

  private addZoneToMap(zone: RestrictedZone): void {
    try {
      const leafletCoords = zone.coordinates[0].map(coord => [coord[1], coord[0]] as [number, number]);
      
      // Add main restricted zone polygon with simplified rendering
      const polygon = L.polygon(leafletCoords, {
        color: this.getZoneColor(zone.type),
        fillColor: this.getZoneColor(zone.type),
        fillOpacity: 0.3,
        weight: 2,
        smoothFactor: 1 // Reduce smoothing for performance
      }).addTo(this.restrictedZonesLayer!);

      // Only add buffer zones for important zones to improve performance
      if (zone.type === 'Protected Area' || zone.type === 'Airport') {
        const zonePolygon = turf.polygon(zone.coordinates);
        const buffer = turf.buffer(zonePolygon, zone.bufferDistance / 1000, { units: 'kilometers' });
        
        if (buffer && buffer.geometry) {
          const bufferCoords = (buffer.geometry as any).coordinates[0].map((coord: number[]) => 
            [coord[1], coord[0]] as [number, number]
          );
          
          L.polygon(bufferCoords, {
            color: this.getZoneColor(zone.type),
            fillColor: this.getZoneColor(zone.type),
            fillOpacity: 0.1,
            weight: 1,
            dashArray: '5,5',
            smoothFactor: 1
          }).addTo(this.bufferZonesLayer!);
        }
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
      let materialTypes: string[] = [];
      if (item.material) {
        if (Array.isArray(item.material)) {
          materialTypes = item.material;
        } else if (typeof item.material === 'string') {
          materialTypes = item.material.split(',').map((m: string) => m.trim());
        } else {
          materialTypes = [String(item.material)];
        }
      } else {
        materialTypes = ['Unknown'];
      }

      const locationName = item.materialLocation || item.location?.name || 'Unknown Location';
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

    this.materialMarkersLayer.clearLayers();
    this.markers = [];

    this.materials().forEach(material => {
      if (!material || !material.type) return;

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
    
    // Debounced analysis to prevent rapid successive calls
    const now = Date.now();
    if (now - this.lastAnalysisTime > this.ANALYSIS_DEBOUNCE) {
      this.analyzeSite(latlng);
      this.lastAnalysisTime = now;
    } else {
      setTimeout(() => this.analyzeSite(latlng), this.ANALYSIS_DEBOUNCE);
    }
  }

  private analyzeSite(latlng: L.LatLng): void {
    this.isAnalyzing.set(true);
    
    // Use setTimeout to yield to UI
    setTimeout(() => {
      // Create point using turf.point instead of turf.Point type
      const sitePoint = turf.point([latlng.lng, latlng.lat]);
      
      // Check cache first
      const cacheKey = `${latlng.lat.toFixed(4)},${latlng.lng.toFixed(4)}`;
      if (this.analysisCache.has(cacheKey)) {
        this.analysisResult.set(this.analysisCache.get(cacheKey)!);
        this.isAnalyzing.set(false);
        return;
      }

      const restrictions = this.checkRestrictionsOptimized(sitePoint);
      const nearestMaterials = this.findNearestMaterialsOptimized(latlng);
      const recommendations = this.generateRecommendations(restrictions, nearestMaterials);
      
      const result: AnalysisResult = {
        isValid: restrictions.length === 0,
        restrictions,
        nearestMaterials,
        recommendations
      };
      
      // Cache the result
      this.analysisCache.set(cacheKey, result);
      this.analysisResult.set(result);
      this.isAnalyzing.set(false);
    }, 0);
  }

  // Optimized restriction checking with spatial filtering - FIXED: Remove turf.Point type
  private checkRestrictionsOptimized(sitePoint: any): string[] {
    const restrictions: string[] = [];
    const siteLng = sitePoint.geometry.coordinates[0];
    const siteLat = sitePoint.geometry.coordinates[1];

    for (const zone of this.restrictedZonesData) {
      // Quick bounds check before expensive polygon operations
      if (zone.bounds) {
        const [minLng, minLat, maxLng, maxLat] = zone.bounds;
        if (siteLng < minLng || siteLng > maxLng || siteLat < minLat || siteLat > maxLat) {
          continue; // Skip if point is outside bounds
        }
      }

      try {
        const zonePolygon = turf.polygon(zone.coordinates);
        const isInZone = turf.booleanPointInPolygon(sitePoint, zonePolygon);
        
        if (isInZone) {
          restrictions.push(`🚫 Site is inside ${zone.name} (${zone.type})`);
        } else {
          // Only check buffer for important zones
          if (zone.type === 'Protected Area' || zone.type === 'Airport') {
            const buffer = turf.buffer(zonePolygon, zone.bufferDistance / 1000, { units: 'kilometers' });
            if (buffer) {
              const isInBuffer = turf.booleanPointInPolygon(sitePoint, buffer);
              if (isInBuffer) {
                restrictions.push(`⚠️ Site is within ${zone.bufferDistance}m buffer of ${zone.name}`);
              }
            }
          }
        }
      } catch (error) {
        console.warn('Error checking zone:', zone.name, error);
      }
    }

    return restrictions;
  }

  // Optimized nearest materials search
  private findNearestMaterialsOptimized(site: L.LatLng): AnalysisResult['nearestMaterials'] {
    const sitePoint = turf.point([site.lng, site.lat]);
    const maxDistance = 50000; // 50km maximum search radius
    
    return this.materials()
      .map(material => {
        const materialPoint = turf.point([material.location.longitude, material.location.latitude]);
        const distance = turf.distance(sitePoint, materialPoint, { units: 'kilometers' }) * 1000;
        
        return {
          material,
          distance: Math.round(distance),
          travelTime: Math.round((distance / 1000) / 40 * 60) // 40 km/h average
        };
      })
      .filter(item => item.distance <= maxDistance) // Filter distant materials
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
    const additionalInfo = (material as any).additionalInfo || {};
    
    return `
      <div style="min-width: 250px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 16px;">${material.icon || '📦'}</span>
          <h4 style="margin: 0; color: ${GovernmentColors.kbrcDarkBlue};">${material.name}</h4>
        </div>
        <p><strong>📍 Location:</strong> ${material.location.name}</p>
        <p><strong>🏷️ Types:</strong> ${material.type.join(', ')}</p>
        <p><strong>📋 Usage:</strong> ${additionalInfo.materialUsage || 'Not specified'}</p>
        <p><strong>👥 Employees:</strong> ${additionalInfo.numberOfPeopleEmployed || 'Not specified'}</p>
        <p><strong>🏭 Industry Size:</strong> ${additionalInfo.sizeOfManufacturingIndustry || 'Not specified'}</p>
        <p><strong>📊 Daily Production:</strong> ${additionalInfo.volumeProducedPerDay || 'Not specified'}</p>
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