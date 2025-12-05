import { Component, OnInit, AfterViewInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { MaterialService } from '../../services/material.service';
import { Material } from '../../models/material.model';
import { GovernmentColors } from '../../config/colors.config';
import { CohereAIService, AIRecommendation, SiteContext } from '../../services/cohere-ai.service';

interface RestrictedZone {
  id: string;
  name: string;
  type: string;
  coordinates: number[][][];
  bufferDistance: number;
  source: 'geojson' | 'manual';
  bounds?: [number, number, number, number];
}

interface TerrainAnalysis {
  slope: number;
  elevation: number;
  soilType: string;
  drainage: 'good' | 'moderate' | 'poor';
  floodRisk: 'low' | 'medium' | 'high';
  accessibility: 'easy' | 'moderate' | 'difficult';
}

interface WeatherPatterns {
  rainfall: number;
  temperature: {
    min: number;
    max: number;
    average: number;
  };
  rainySeasons: string[];
}

interface Infrastructure {
  roads: {
    distance: number;
    quality: 'paved' | 'gravel' | 'dirt';
  };
  utilities: {
    water: boolean;
    electricity: boolean;
    internet: boolean;
  };
  proximityToTown: number;
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
  terrainAnalysis: TerrainAnalysis;
  infrastructure: Infrastructure;
  riskLevel?: 'low' | 'medium' | 'high';
  costImplications?: string[];
  timelineImpact?: string;
  overallScore?: number;
}

interface EnhancedSiteContext extends SiteContext {
  terrainAnalysis: TerrainAnalysis;
  infrastructure: Infrastructure;
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

interface DownloadableReport {
  siteCoordinates: { lat: number; lng: number };
  analysisDate: string;
  overallScore: number;
  riskLevel: string;
  terrainAnalysis: TerrainAnalysis;
  infrastructure: Infrastructure;
  restrictions: string[];
  recommendations: string[];
  aiRecommendations?: AIRecommendation;
  nearestMaterials: AnalysisResult['nearestMaterials'];
  costImplications: string[];
  timelineImpact: string;
}

@Component({
  selector: 'app-decision-support',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './decision-support.html',
  styleUrls: ['./decision-support.scss']
})
export class DecisionSupport implements OnInit, AfterViewInit, OnDestroy {
  private materialService = inject(MaterialService);
  private http = inject(HttpClient);
  private cohereAIService = inject(CohereAIService);
  
  private map: L.Map | undefined;
  private markers: L.Marker[] = [];
  private siteMarker: L.Marker | null = null;
  private alternativeMarker: L.Marker | null = null;
  private restrictedZonesLayer: L.LayerGroup | undefined;
  private bufferZonesLayer: L.LayerGroup | undefined;
  private materialMarkersLayer: L.LayerGroup | undefined;
  
  materials = signal<Material[]>([]);
  selectedSite = signal<{ lat: number; lng: number } | null>(null);
  analysisResult = signal<AnalysisResult | null>(null);
  aiRecommendation = signal<AIRecommendation | null>(null);
  isLoading = signal(false);
  isAnalyzing = signal(false);
  isAIAnalyzing = signal(false);
  isLoadingRestrictions = signal(false);
  aiError = signal<string | null>(null);
  isGeneratingReport = signal(false);
  
  searchQuery = signal<string>('');
  isSearching = signal<boolean>(false);
  searchResults = signal<any[]>([]);
  coordinateInput = signal<{ lat: string; lng: string }>({ lat: '', lng: '' });

  Math = Math;
  restrictedZonesData: RestrictedZone[] = [];

  private analysisCache = new Map<string, AnalysisResult>();
  private materialCache = new Map<string, Material>();
  private lastAnalysisTime = 0;
  private readonly ANALYSIS_DEBOUNCE = 500;

  ngOnInit() {
    this.loadRestrictedZones();
    this.loadMaterials();
  }

  ngAfterViewInit() {
    console.log('🎯 ngAfterViewInit called');
    setTimeout(() => {
      this.checkMapStatus();
    }, 100);
    
    setTimeout(() => {
      this.initMap();
    }, 300);
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.map) {
      this.clearSearchMarker();
      this.map.remove();
      this.map = undefined;
    }
    
    this.analysisCache.clear();
    this.materialCache.clear();
    this.markers = [];
    this.siteMarker = null;
    this.alternativeMarker = null;
  }

  // Search and Coordinate Methods
  updateCoordinateInput(field: 'lat' | 'lng', event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const value = inputElement.value;
    
    this.coordinateInput.update(current => ({
      ...current,
      [field]: value
    }));
  }

  onSearchInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.searchQuery.set(inputElement.value);
  }

  async searchLocation(query: string): Promise<void> {
    if (!query.trim()) {
      this.searchResults.set([]);
      return;
    }

    this.isSearching.set(true);
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&viewbox=33.0,-5.0,42.0,1.0&bounded=1`
      );
      
      if (response.ok) {
        const results = await response.json();
        this.searchResults.set(results);
      } else {
        this.searchResults.set([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  zoomToLocation(result: any): void {
    if (!this.map) return;

    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    this.map.setView([lat, lng], 14);
    this.searchQuery.set(result.display_name);
    this.searchResults.set([]);
    
    this.addSearchResultMarker(lat, lng, result.display_name);
  }

  addPinByCoordinates(): void {
    const lat = parseFloat(this.coordinateInput().lat);
    const lng = parseFloat(this.coordinateInput().lng);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid coordinates');
      return;
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Please enter valid coordinates:\nLatitude: -90 to 90\nLongitude: -180 to 180');
      return;
    }
    
    const latlng = L.latLng(lat, lng);
    this.onMapClick(latlng);
    
    this.coordinateInput.set({ lat: '', lng: '' });
  }

  zoomToCurrentLocation(): void {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        if (this.map) {
          this.map.setView([lat, lng], 14);
          this.addSearchResultMarker(lat, lng, 'Your Current Location');
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to retrieve your location');
      }
    );
  }

  zoomToPredefinedLocation(location: string): void {
    const locations: { [key: string]: [number, number, number] } = {
      'nairobi': [-1.2921, 36.8219, 12],
      'mombasa': [-4.0435, 39.6682, 12],
      'kisumu': [-0.1022, 34.7617, 12],
      'nakuru': [-0.3031, 36.0800, 12],
      'eldoret': [0.5143, 35.2698, 12],
      'thika': [-1.0395, 37.0900, 12],
      'nairobi-national-park': [-1.3500, 36.8333, 11],
      'lake-naivasha': [-0.7167, 36.4333, 11],
      'mount-kenya': [-0.1523, 37.3084, 9],
      'coast-region': [-3.0000, 39.5000, 8],
      'rift-valley': [0.5000, 36.0000, 7],
      'western-kenya': [0.5000, 34.5000, 8]
    };

    if (locations[location] && this.map) {
      const [lat, lng, zoom] = locations[location];
      this.map.setView([lat, lng], zoom);
    }
  }

  private addSearchResultMarker(lat: number, lng: number, name: string): void {
    this.clearSearchMarker();
    
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'search-marker',
        html: this.createSearchMarkerHtml(),
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      })
    }).addTo(this.map!);

    marker.bindPopup(`
      <div style="min-width: 200px;">
        <h4>🔍 ${name}</h4>
        <p>Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</p>
      </div>
    `).openPopup();

    (this.map as any)._searchMarker = marker;
  }

  private clearSearchMarker(): void {
    if (this.map && (this.map as any)._searchMarker) {
      this.map.removeLayer((this.map as any)._searchMarker);
      (this.map as any)._searchMarker = null;
    }
  }

  private createSearchMarkerHtml(): string {
    return `
      <div style="
        background-color: #8B4513;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: white;
      ">📌</div>
    `;
  }

  // Map Initialization and Core Functionality
  private initMap(): void {
    setTimeout(() => {
      const mapElement = document.getElementById('decision-map');
      
      if (!mapElement) {
        console.error('Map container "decision-map" not found');
        setTimeout(() => this.initMap(), 100);
        return;
      }

      if (mapElement.offsetWidth === 0 || mapElement.offsetHeight === 0) {
        console.warn('Map container has zero dimensions, retrying...');
        setTimeout(() => this.initMap(), 100);
        return;
      }

      console.log('🗺️ Initializing map with container:', mapElement);

      try {
        this.map = L.map('decision-map', {
          center: [-1.2921, 36.8219],
          zoom: 7,
          zoomControl: false,
          preferCanvas: true
        });

        L.control.zoom({ 
          position: 'topright' 
        }).addTo(this.map);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18,
          minZoom: 6
        }).addTo(this.map);

        this.restrictedZonesLayer = L.layerGroup().addTo(this.map);
        this.bufferZonesLayer = L.layerGroup().addTo(this.map);
        this.materialMarkersLayer = L.layerGroup().addTo(this.map);

        this.map.on('click', (e: L.LeafletMouseEvent) => {
          this.onMapClick(e.latlng);
        });

        setTimeout(() => {
          this.map?.invalidateSize();
          this.addRestrictedZones();
          this.addMaterialMarkers();
        }, 500);

        console.log('✅ Map initialized successfully');

      } catch (error) {
        console.error('❌ Error initializing map:', error);
        setTimeout(() => this.initMap(), 1000);
      }
    }, 200);
  }

  private checkMapStatus(): void {
    const mapElement = document.getElementById('decision-map');
    if (mapElement) {
      console.log('Map container dimensions:', {
        width: mapElement.offsetWidth,
        height: mapElement.offsetHeight,
        clientWidth: mapElement.clientWidth,
        clientHeight: mapElement.clientHeight
      });
    } else {
      console.error('Map container not found');
    }
    
    if (this.map) {
      console.log('Map instance:', this.map);
      console.log('Map center:', this.map.getCenter());
      console.log('Map zoom:', this.map.getZoom());
    } else {
      console.error('Map instance not created');
    }
  }

  private onMapClick(latlng: L.LatLng): void {
    this.clearAlternativeMarker();
    
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
    
    const now = Date.now();
    if (now - this.lastAnalysisTime > this.ANALYSIS_DEBOUNCE) {
      this.analyzeSite(latlng);
      this.lastAnalysisTime = now;
    } else {
      setTimeout(() => this.analyzeSite(latlng), this.ANALYSIS_DEBOUNCE);
    }

    console.log(`📍 Site selected: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
  }

  private createSiteMarkerHtml(): string {
    return `
      <div style="
        background-color: #dc3545;
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

  // Enhanced Site Analysis with Terrain and Infrastructure
  private async analyzeSite(latlng: L.LatLng): Promise<void> {
    this.isAnalyzing.set(true);
    
    try {
      const sitePoint = turf.point([latlng.lng, latlng.lat]);
      
      const cacheKey = `${latlng.lat.toFixed(4)},${latlng.lng.toFixed(4)}`;
      if (this.analysisCache.has(cacheKey)) {
        const cached = this.analysisCache.get(cacheKey)!;
        this.analysisResult.set(cached);
        this.isAnalyzing.set(false);
        await this.generateAIRecommendations(cached, latlng);
        return;
      }

      const [restrictions, nearestMaterials, terrainAnalysis, infrastructure] = await Promise.all([
        this.checkRestrictionsOptimized(sitePoint),
        Promise.resolve(this.findNearestMaterialsOptimized(latlng)),
        this.analyzeTerrain(latlng),
        Promise.resolve(this.analyzeInfrastructure(latlng))
      ]);

      const recommendations = this.generateEnhancedRecommendations(
        restrictions, 
        nearestMaterials, 
        terrainAnalysis, 
        infrastructure
      );
      
      const overallScore = this.calculateOverallScore(
        restrictions, 
        terrainAnalysis, 
        infrastructure
      );
      
      const result: AnalysisResult = {
        isValid: restrictions.length === 0,
        restrictions,
        nearestMaterials,
        recommendations,
        terrainAnalysis,
        infrastructure,
        overallScore,
        riskLevel: this.calculateRiskLevel(restrictions, terrainAnalysis),
        costImplications: this.calculateCostImplications(infrastructure, terrainAnalysis),
        timelineImpact: this.assessTimelineImpact(terrainAnalysis, infrastructure)
      };
      
      this.analysisCache.set(cacheKey, result);
      this.analysisResult.set(result);
      
      await this.generateAIRecommendations(result, latlng);
      
    } catch (error) {
      console.error('Error in site analysis:', error);
      const sitePoint = turf.point([latlng.lng, latlng.lat]);
      const restrictions = this.checkRestrictionsOptimized(sitePoint);
      const nearestMaterials = this.findNearestMaterialsOptimized(latlng);
      const recommendations = this.generateRecommendations(restrictions, nearestMaterials);
      
      const result: AnalysisResult = {
        isValid: restrictions.length === 0,
        restrictions,
        nearestMaterials,
        recommendations,
        terrainAnalysis: {
          slope: 0,
          elevation: 0,
          soilType: 'unknown',
          drainage: 'moderate',
          floodRisk: 'medium',
          accessibility: 'moderate'
        },
        infrastructure: {
          roads: { distance: 0, quality: 'dirt' },
          utilities: { water: false, electricity: false, internet: false },
          proximityToTown: 0
        }
      };
      
      this.analysisResult.set(result);
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  // Terrain Analysis Methods
  private async analyzeTerrain(latlng: L.LatLng): Promise<TerrainAnalysis> {
    try {
      const response = await fetch(
        `https://api.open-elevation.com/api/v1/lookup?locations=${latlng.lat},${latlng.lng}`
      );
      
      let elevation = 1500;
      if (response.ok) {
        const data = await response.json();
        elevation = data.results[0]?.elevation || 1500;
      }

      const slope = this.calculateSlope(latlng);
      const soilType = this.determineSoilType(latlng);
      const drainage = this.assessDrainage(latlng, elevation, slope);
      const floodRisk = this.assessFloodRisk(latlng, elevation);
      const accessibility = this.assessAccessibility(latlng);

      return {
        slope,
        elevation,
        soilType,
        drainage,
        floodRisk,
        accessibility
      };
    } catch (error) {
      console.error('Error in terrain analysis:', error);
      return {
        slope: 2,
        elevation: 1500,
        soilType: 'clay-loam',
        drainage: 'moderate',
        floodRisk: 'medium',
        accessibility: 'moderate'
      };
    }
  }

  private calculateSlope(latlng: L.LatLng): number {
    const baseSlope = Math.abs(latlng.lat * 100) % 15;
    return Math.min(baseSlope, 12);
  }

  private determineSoilType(latlng: L.LatLng): string {
    const soilTypes = [
      'clay', 'clay-loam', 'sandy-loam', 'loam', 'sandy-clay-loam', 
      'volcanic', 'alluvial', 'black-cotton'
    ];
    
    const hash = Math.abs(latlng.lat * 1000 + latlng.lng * 1000) % soilTypes.length;
    return soilTypes[Math.floor(hash)];
  }

  private assessDrainage(latlng: L.LatLng, elevation: number, slope: number): 'good' | 'moderate' | 'poor' {
    const nearWater = this.isNearWaterBody(latlng);
    
    if (nearWater && elevation < 1200) {
      return 'poor';
    }
    
    if (slope > 8) {
      return 'good';
    } else if (slope > 3) {
      return 'moderate';
    } else {
      return 'poor';
    }
  }

/**
 * Check if location is near water body (fixed version)
 */
private isNearWaterBody(latlng: L.LatLng): boolean {
  const waterBodies = this.restrictedZonesData.filter(zone => 
    zone.type === 'Water Body'
  );
  
  const sitePoint = turf.point([latlng.lng, latlng.lat]);
  
  for (const waterBody of waterBodies) {
    try {
      // Get the centroid of the water body polygon for distance calculation
      const zonePolygon = turf.polygon(waterBody.coordinates);
      const centroid = turf.centroid(zonePolygon);
      const distance = turf.distance(sitePoint, centroid, { units: 'kilometers' });
      
      if (distance < 2) { // Within 2km of water body
        return true;
      }
    } catch (error) {
      continue;
    }
  }
  
  return false;
}

/**
 * Assess accessibility (fixed version)
 */
private assessAccessibility(latlng: L.LatLng): 'easy' | 'moderate' | 'difficult' {
  const roads = this.restrictedZonesData.filter(zone => 
    zone.type === 'Transportation Corridor'
  );
  
  const sitePoint = turf.point([latlng.lng, latlng.lat]);
  let minDistance = Infinity;
  
  for (const road of roads) {
    try {
      // Get the centroid of the road polygon for distance calculation
      const roadPolygon = turf.polygon(road.coordinates);
      const centroid = turf.centroid(roadPolygon);
      const distance = turf.distance(sitePoint, centroid, { units: 'kilometers' });
      minDistance = Math.min(minDistance, distance);
    } catch (error) {
      continue;
    }
  }
  
  if (minDistance < 1) {
    return 'easy';
  } else if (minDistance < 5) {
    return 'moderate';
  } else {
    return 'difficult';
  }
}

/**
 * Analyze infrastructure (fixed version)
 */
private analyzeInfrastructure(latlng: L.LatLng): Infrastructure {
  const roads = this.restrictedZonesData.filter(zone => 
    zone.type === 'Transportation Corridor'
  );
  
  const sitePoint = turf.point([latlng.lng, latlng.lat]);
  let roadDistance = Infinity;
  let roadQuality: 'paved' | 'gravel' | 'dirt' = 'dirt';
  
  for (const road of roads) {
    try {
      // Get the centroid of the road polygon for distance calculation
      const roadPolygon = turf.polygon(road.coordinates);
      const centroid = turf.centroid(roadPolygon);
      const distance = turf.distance(sitePoint, centroid, { units: 'kilometers' });
      
      if (distance < roadDistance) {
        roadDistance = distance;
        roadQuality = road.name?.toLowerCase().includes('highway') ? 'paved' : 
                     road.name?.toLowerCase().includes('road') ? 'gravel' : 'dirt';
      }
    } catch (error) {
      continue;
    }
  }
  
  const urbanDistance = this.calculateUrbanProximity(latlng);
  const hasUtilities = urbanDistance < 10;
  
  return {
    roads: {
      distance: Math.round(roadDistance * 1000),
      quality: roadQuality
    },
    utilities: {
      water: hasUtilities,
      electricity: hasUtilities,
      internet: urbanDistance < 5
    },
    proximityToTown: Math.round(urbanDistance * 1000)
  };
}

/**
 * Enhanced alternative location finder with proper distance checks
 */
private findAlternativeLocations(originalLatLng: L.LatLng, restrictions: string[]): { lat: number; lng: number; reason: string; score: number }[] {
  const alternatives: { lat: number; lng: number; reason: string; score: number }[] = [];
  const originalPoint = turf.point([originalLatLng.lng, originalLatLng.lat]);

  const directions = [
    { latOffset: 0.01, lngOffset: 0.01, reason: 'Northeast - Better terrain' },
    { latOffset: 0.01, lngOffset: -0.01, reason: 'Northwest - Avoids restrictions' },
    { latOffset: -0.01, lngOffset: 0.01, reason: 'Southeast - Improved access' },
    { latOffset: -0.01, lngOffset: -0.01, reason: 'Southwest - Better drainage' },
    { latOffset: 0.02, lngOffset: 0, reason: 'North - Higher elevation' },
    { latOffset: -0.02, lngOffset: 0, reason: 'South - Near existing infrastructure' }
  ];

  for (const direction of directions) {
    const candidateLat = originalLatLng.lat + direction.latOffset;
    const candidateLng = originalLatLng.lng + direction.lngOffset;
    const candidatePoint = turf.point([candidateLng, candidateLat]);

    let hasRestrictions = false;
    for (const zone of this.restrictedZonesData) {
      try {
        const zonePolygon = turf.polygon(zone.coordinates);
        const isInZone = turf.booleanPointInPolygon(candidatePoint, zonePolygon);
        
        if (isInZone) {
          hasRestrictions = true;
          break;
        }

        // Check buffer zones using centroid distance
        const centroid = turf.centroid(zonePolygon);
        const distanceToCentroid = turf.distance(candidatePoint, centroid, { units: 'kilometers' });
        const bufferDistanceKm = zone.bufferDistance / 1000;
        
        if (distanceToCentroid < bufferDistanceKm) {
          hasRestrictions = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!hasRestrictions) {
      const distance = turf.distance(originalPoint, candidatePoint, { units: 'kilometers' }) * 1000;
      const score = Math.max(0, 100 - (distance / 100));
      
      alternatives.push({
        lat: candidateLat,
        lng: candidateLng,
        reason: direction.reason,
        score: Math.round(score)
      });
    }
  }

  return alternatives.sort((a, b) => b.score - a.score).slice(0, 3);
}



/**
 * Simulate elevation based on Kenyan topography
 */
private simulateElevation(latlng: L.LatLng): number {
  // Kenya has varied topography:
  // - Coastal regions: 0-500m
  // - Central highlands: 1500-2500m  
  // - Rift Valley: 1000-2000m
  // - Western: 1000-1500m
  
  const baseElevation = 1500;
  
  // Adjust based on latitude (rough approximation)
  if (latlng.lat < -2.0) {
    // Southern regions (lower elevation)
    return baseElevation - 500 + (Math.random() * 300);
  } else if (latlng.lat > 1.0) {
    // Northern regions (higher elevation)
    return baseElevation + 500 + (Math.random() * 500);
  } else {
    // Central regions (variable)
    return baseElevation + (Math.random() * 1000);
  }
}






/**
 * Enhanced flood risk assessment
 */
private assessFloodRisk(latlng: L.LatLng, elevation: number): 'low' | 'medium' | 'high' {
  const nearWater = this.isNearWaterBody(latlng);
  
  let floodRiskScore = 0;
  
  if (elevation < 1000) floodRiskScore += 2;
  else if (elevation < 1200) floodRiskScore += 1;
  
  if (nearWater) floodRiskScore += 2;
  
  // Consider rainfall patterns (Kenya has varied rainfall)
  const isHighRainfallArea = this.isHighRainfallArea(latlng);
  if (isHighRainfallArea) floodRiskScore += 1;
  
  if (floodRiskScore >= 3) return 'high';
  if (floodRiskScore >= 2) return 'medium';
  return 'low';
}

private isHighRainfallArea(latlng: L.LatLng): boolean {
  // Kenyan high rainfall areas: Western, Central Highlands, Coastal regions
  return (
    latlng.lng > 34.5 || // Western Kenya
    (latlng.lat > -1.0 && latlng.lat < 0.5 && latlng.lng > 36.0) || // Central Highlands
    latlng.lat < -3.0 // Coastal region
  );
}





private determineRoadQuality(road: RestrictedZone): 'paved' | 'gravel' | 'dirt' {
  const name = road.name?.toLowerCase() || '';
  
  if (name.includes('highway') || name.includes('motorway') || name.includes('expressway')) {
    return 'paved';
  } else if (name.includes('road') || name.includes('street') || name.includes('avenue')) {
    return 'gravel';
  } else {
    return 'dirt';
  }
}

private calculateUrbanProximity(latlng: L.LatLng): number {
  // Major Kenyan urban centers with population weights
  const urbanCenters = [
    { name: 'Nairobi', lat: -1.2921, lng: 36.8219, weight: 1.0 },
    { name: 'Mombasa', lat: -4.0435, lng: 39.6682, weight: 0.8 },
    { name: 'Kisumu', lat: -0.1022, lng: 34.7617, weight: 0.6 },
    { name: 'Nakuru', lat: -0.3031, lng: 36.0800, weight: 0.5 },
    { name: 'Eldoret', lat: 0.5143, lng: 35.2698, weight: 0.4 },
    { name: 'Thika', lat: -1.0395, lng: 37.0900, weight: 0.3 },
    { name: 'Malindi', lat: -3.2176, lng: 40.1161, weight: 0.2 },
    { name: 'Kitale', lat: 1.0157, lng: 35.0062, weight: 0.2 }
  ];
  
  const sitePoint = turf.point([latlng.lng, latlng.lat]);
  let weightedDistance = 0;
  let totalWeight = 0;
  
  for (const urban of urbanCenters) {
    const urbanPoint = turf.point([urban.lng, urban.lat]);
    const distance = turf.distance(sitePoint, urbanPoint, { units: 'kilometers' });
    weightedDistance += distance * urban.weight;
    totalWeight += urban.weight;
  }
  
  return weightedDistance / totalWeight;
}


  // Scoring and Assessment Methods
  private calculateOverallScore(
    restrictions: string[], 
    terrain: TerrainAnalysis, 
    infrastructure: Infrastructure
  ): number {
    let score = 100;

    score -= restrictions.length * 15;

    if (terrain.slope > 10) score -= 20;
    else if (terrain.slope > 5) score -= 10;

    if (terrain.drainage === 'poor') score -= 15;
    if (terrain.floodRisk === 'high') score -= 20;
    if (terrain.accessibility === 'difficult') score -= 10;

    if (infrastructure.roads.distance > 5000) score -= 15;
    if (infrastructure.roads.quality === 'dirt') score -= 10;
    
    if (!infrastructure.utilities.water) score -= 10;
    if (!infrastructure.utilities.electricity) score -= 5;
    if (infrastructure.proximityToTown > 10000) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateRiskLevel(restrictions: string[], terrain: TerrainAnalysis): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    if (restrictions.length > 0) riskScore += 2;
    if (terrain.floodRisk === 'high') riskScore += 2;
    if (terrain.drainage === 'poor') riskScore += 1;
    if (terrain.slope > 8) riskScore += 1;

    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  private calculateCostImplications(
    infrastructure: Infrastructure, 
    terrain: TerrainAnalysis
  ): string[] {
    const implications: string[] = [];

    if (infrastructure.roads.distance > 2000) {
      implications.push('Higher transportation costs due to remote location');
    }

    if (terrain.slope > 5) {
      implications.push('Site grading and earthworks required');
    }

    if (terrain.drainage === 'poor') {
      implications.push('Drainage system installation needed');
    }

    if (!infrastructure.utilities.water) {
      implications.push('Water well or storage system required');
    }

    if (!infrastructure.utilities.electricity) {
      implications.push('Generator or solar power system needed');
    }

    return implications;
  }

  private assessTimelineImpact(
    terrain: TerrainAnalysis, 
    infrastructure: Infrastructure
  ): string {
    let impact = 'Standard timeline';

    if (terrain.slope > 8 || terrain.drainage === 'poor') {
      impact = 'Extended timeline (+2-4 weeks) for site preparation';
    }

    if (infrastructure.roads.quality === 'dirt' && infrastructure.roads.distance > 1000) {
      impact = 'Extended timeline (+1-2 weeks) for material delivery';
    }

    if (!infrastructure.utilities.water && !infrastructure.utilities.electricity) {
      impact = 'Significantly extended timeline (+4-6 weeks) for utility setup';
    }

    return impact;
  }

  // Enhanced Recommendations
  private generateEnhancedRecommendations(
    restrictions: string[],
    nearestMaterials: AnalysisResult['nearestMaterials'],
    terrain: TerrainAnalysis,
    infrastructure: Infrastructure
  ): string[] {
    const recommendations: string[] = [];

    if (restrictions.length > 0) {
      recommendations.push('❌ Site has regulatory restrictions - consider alternative location');
      recommendations.push('📋 Required: Environmental impact assessment and permits');
    } else {
      recommendations.push('✅ Site appears regulatory compliant');
      recommendations.push('📝 Proceed with standard construction approval process');
    }

    if (terrain.slope > 8) {
      recommendations.push('🏔️ Steep slope detected - consider terracing or specialized foundation design');
    }

    if (terrain.drainage === 'poor') {
      recommendations.push('💧 Poor drainage - install French drains or drainage system');
    }

    if (terrain.floodRisk === 'high') {
      recommendations.push('🌊 High flood risk - elevate structure or implement flood mitigation');
    }

    if (terrain.soilType === 'black-cotton' || terrain.soilType === 'clay') {
      recommendations.push('🟫 Expansive soil detected - specialized foundation design required');
    }

    if (infrastructure.roads.distance > 2000) {
      recommendations.push('🛣️ Remote location - budget for extended material transport');
    }

    if (infrastructure.roads.quality === 'dirt') {
      recommendations.push('🚜 Poor road access - consider road improvement or seasonal access planning');
    }

    if (!infrastructure.utilities.water) {
      recommendations.push('💦 No water connection - plan for borehole or water storage system');
    }

    if (!infrastructure.utilities.electricity) {
      recommendations.push('⚡ No electricity - consider solar power or generator backup');
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

      const materialTypes = new Set(nearestMaterials.flatMap(item => item.material.type));
      
      if (materialTypes.has('Sand') && terrain.drainage === 'poor') {
        recommendations.push('🏖️ Sandy soil available - can improve drainage when mixed');
      }
      
      if (materialTypes.has('Blocks')) {
        recommendations.push('🧱 Block materials suitable for foundation work');
      }
      
      if (materialTypes.has('Ballast')) {
        recommendations.push('⛰️ Ballast ideal for road construction and foundations');
      }
    }

    return recommendations;
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
      recommendations.push('🌊 Required: Water resource management plan and flood assessment');
    }

    if (restrictions.some(r => r.includes('Protected Area'))) {
      recommendations.push('🌿 Near protected area - enhanced environmental compliance required');
      recommendations.push('🦁 Required: Wildlife impact assessment and conservation plan');
    }

    if (restrictions.some(r => r.includes('Airport'))) {
      recommendations.push('✈️ Near airport - height restrictions and noise considerations apply');
      recommendations.push('📡 Required: Aviation safety assessment and height clearance');
    }

    if (restrictions.some(r => r.includes('Transportation Corridor'))) {
      recommendations.push('🛣️ Near transportation corridor - access and safety considerations');
      recommendations.push('🚧 Required: Traffic management plan and access permits');
    }

    return recommendations;
  }

  // Enhanced AI Recommendations
  private async generateAIRecommendations(analysisResult: AnalysisResult, latlng: L.LatLng): Promise<void> {
    this.isAIAnalyzing.set(true);
    this.aiError.set(null);

    try {
      const enhancedContext: EnhancedSiteContext = {
        selectedSite: { lat: latlng.lat, lng: latlng.lng },
        nearestMaterials: analysisResult.nearestMaterials,
        restrictions: analysisResult.restrictions,
        analysisResult: analysisResult,
        terrainAnalysis: analysisResult.terrainAnalysis,
        infrastructure: analysisResult.infrastructure
      };

      console.log('🤖 Generating enhanced AI recommendations...');
      const recommendation = await this.cohereAIService.generateRecommendations(enhancedContext);
      


      if (analysisResult.terrainAnalysis) {
        const terrain = analysisResult.terrainAnalysis;
        recommendation.keyFactors = [
          ...(recommendation.keyFactors || []),
          `Slope: ${terrain.slope}% - ${terrain.slope > 8 ? 'Steep terrain requires grading' : 'Moderate slope suitable for construction'}`,
          `Drainage: ${terrain.drainage} - ${terrain.drainage === 'poor' ? 'Drainage system recommended' : 'Natural drainage adequate'}`,
          `Flood Risk: ${terrain.floodRisk} - ${terrain.floodRisk === 'high' ? 'Elevated foundation recommended' : 'Standard foundation suitable'}`,
          `Soil Type: ${terrain.soilType} - ${this.getSoilRecommendation(terrain.soilType)}`
        ];
      }

      this.aiRecommendation.set(recommendation);
      
      
      console.log('✅ Enhanced AI analysis completed successfully');
    } catch (error) {
      console.error('❌ Enhanced AI recommendation failed:', error);
      this.aiError.set('AI analysis temporarily unavailable - using expert recommendations');
    } finally {
      this.isAIAnalyzing.set(false);
    }
  }

  private getSoilRecommendation(soilType: string): string {
    const recommendations: { [key: string]: string } = {
      'clay': 'Requires deep foundations, susceptible to shrinkage/swelling',
      'black-cotton': 'Highly expansive soil, specialized foundation design essential',
      'sandy-loam': 'Good bearing capacity, suitable for most foundations',
      'loam': 'Ideal soil conditions, minimal preparation needed',
      'volcanic': 'Good drainage but may require soil stabilization',
      'alluvial': 'Variable soil conditions, recommend soil testing'
    };
    
    return recommendations[soilType] || 'Standard foundation design recommended';
  }


  private addAlternativeLocationMarker(location: { lat: number; lng: number; reason: string; distance: number }): void {
    if (!this.map) return;

    this.alternativeMarker = L.marker([location.lat, location.lng], {
      icon: L.divIcon({
        className: 'alternative-marker',
        html: this.createAlternativeMarkerHtml(),
        iconSize: [35, 35],
        iconAnchor: [17, 35]
      })
    });

    this.alternativeMarker.bindPopup(`
      <div style="min-width: 250px;">
        <h3>🤖 AI Suggested Location</h3>
        <p><strong>📍:</strong> ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}</p>
        <p><strong>📝 Reason:</strong> ${location.reason}</p>
        <p><strong>📏 Distance:</strong> ${location.distance}m from original site</p>
        <button onclick="this.closest('.leaflet-popup')._source._map.panTo([${location.lat}, ${location.lng}]);">
          Focus on this location
        </button>
      </div>
    `);

    this.alternativeMarker.addTo(this.map);
  }

  private createAlternativeMarkerHtml(): string {
    return `
      <div style="
        background-color: #10B981;
        width: 35px;
        height: 35px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        color: white;
        animation: pulse 2s infinite;
      ">💡</div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      </style>
    `;
  }

  focusOnAlternative(location: { lat: number; lng: number }): void {
    if (!this.map) return;
    
    this.map.panTo([location.lat, location.lng]);
    this.map.setZoom(14);
    console.log(`🎯 Focused on alternative location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
  }

  private clearAlternativeMarker(): void {
    if (this.alternativeMarker) {
      this.map?.removeLayer(this.alternativeMarker);
      this.alternativeMarker = null;
    }
  }

  // Downloadable Report Generation
  async downloadSiteAnalysis(): Promise<void> {
    const analysis = this.analysisResult();
    const aiRecommendation = this.aiRecommendation();
    const selectedSite = this.selectedSite();

    if (!analysis || !selectedSite) {
      alert('No site analysis available to download');
      return;
    }

    this.isGeneratingReport.set(true);

    try {
      const report: DownloadableReport = {
        siteCoordinates: selectedSite,
        analysisDate: new Date().toISOString(),
        overallScore: analysis.overallScore || 0,
        riskLevel: analysis.riskLevel || 'medium',
        terrainAnalysis: analysis.terrainAnalysis,
        infrastructure: analysis.infrastructure,
        restrictions: analysis.restrictions,
        recommendations: analysis.recommendations,
        aiRecommendations: aiRecommendation || undefined,
        nearestMaterials: analysis.nearestMaterials,
        costImplications: analysis.costImplications || [],
        timelineImpact: analysis.timelineImpact || 'Standard timeline'
      };

      const reportContent = this.generateReportContent(report);
      const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fileName = `site-analysis-${selectedSite.lat.toFixed(4)}-${selectedSite.lng.toFixed(4)}-${new Date().toISOString().split('T')[0]}.txt`;
      link.download = fileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ Site analysis report downloaded successfully');
    } catch (error) {
      console.error('❌ Error downloading site analysis:', error);
      alert('Error generating report. Please try again.');
    } finally {
      this.isGeneratingReport.set(false);
    }
  }

  private generateReportContent(report: DownloadableReport): string {
    let content = 'CONSTRUCTION SITE ANALYSIS REPORT\n';
    content += '=====================================\n\n';
    
    content += `Report Date: ${new Date(report.analysisDate).toLocaleString()}\n`;
    content += `Site Coordinates: ${report.siteCoordinates.lat.toFixed(6)}, ${report.siteCoordinates.lng.toFixed(6)}\n\n`;
    
    content += 'EXECUTIVE SUMMARY\n';
    content += '=================\n';
    content += `Overall Suitability Score: ${report.overallScore}/100\n`;
    content += `Risk Level: ${report.riskLevel.toUpperCase()}\n\n`;
    
    content += 'TERRAIN ANALYSIS\n';
    content += '================\n';
    content += `Elevation: ${report.terrainAnalysis.elevation}m\n`;
    content += `Slope: ${report.terrainAnalysis.slope}%\n`;
    content += `Soil Type: ${report.terrainAnalysis.soilType}\n`;
    content += `Drainage: ${report.terrainAnalysis.drainage.toUpperCase()}\n`;
    content += `Flood Risk: ${report.terrainAnalysis.floodRisk.toUpperCase()}\n`;
    content += `Accessibility: ${report.terrainAnalysis.accessibility.toUpperCase()}\n\n`;
    
    content += 'INFRASTRUCTURE ANALYSIS\n';
    content += '=======================\n';
    content += `Road Access: ${report.infrastructure.roads.distance}m (${report.infrastructure.roads.quality})\n`;
    content += `Utilities: Water: ${report.infrastructure.utilities.water ? 'Available' : 'Not Available'}, `;
    content += `Electricity: ${report.infrastructure.utilities.electricity ? 'Available' : 'Not Available'}, `;
    content += `Internet: ${report.infrastructure.utilities.internet ? 'Available' : 'Not Available'}\n`;
    content += `Proximity to Town: ${report.infrastructure.proximityToTown}m\n\n`;
    
    content += 'RESTRICTIONS & REGULATIONS\n';
    content += '==========================\n';
    if (report.restrictions.length > 0) {
      report.restrictions.forEach(restriction => {
        content += `• ${restriction}\n`;
      });
    } else {
      content += 'No regulatory restrictions identified\n';
    }
    content += '\n';
    
    content += 'RECOMMENDATIONS\n';
    content += '===============\n';
    report.recommendations.forEach(rec => {
      content += `• ${rec}\n`;
    });
    content += '\n';
    
    content += 'COST IMPLICATIONS\n';
    content += '=================\n';
    if (report.costImplications.length > 0) {
      report.costImplications.forEach(implication => {
        content += `• ${implication}\n`;
      });
    } else {
      content += 'No significant cost implications identified\n';
    }
    content += '\n';
    
    content += 'TIMELINE IMPACT\n';
    content += '===============\n';
    content += `${report.timelineImpact}\n\n`;
    
    content += 'NEAREST MATERIAL SOURCES\n';
    content += '========================\n';
    if (report.nearestMaterials.length > 0) {
      report.nearestMaterials.forEach((material, index) => {
        content += `${index + 1}. ${material.material.name} - ${material.distance}m away\n`;
        content += `   Location: ${material.material.location.name}\n`;
        content += `   Types: ${material.material.type.join(', ')}\n`;
        content += `   Travel Time: ~${material.travelTime} minutes\n\n`;
      });
    } else {
      content += 'No material sources found within reasonable distance\n\n';
    }
    
    if (report.aiRecommendations) {
      content += 'AI RECOMMENDATIONS\n';
      content += '==================\n';
      content += `Summary: ${report.aiRecommendations.summary}\n`;
      content += `Recommendation: ${report.aiRecommendations.recommendation}\n`;
      content += `Confidence: ${((report.aiRecommendations.confidence || 0) * 100).toFixed(0)}%\n\n`;
      
      if (report.aiRecommendations.keyFactors && report.aiRecommendations.keyFactors.length > 0) {
        content += 'Key Factors:\n';
        report.aiRecommendations.keyFactors.forEach(factor => {
          content += `• ${factor}\n`;
        });
        content += '\n';
      }
      
      if (report.aiRecommendations.nextSteps && report.aiRecommendations.nextSteps.length > 0) {
        content += 'Next Steps:\n';
        report.aiRecommendations.nextSteps.forEach(step => {
          content += `• ${step}\n`;
        });
        content += '\n';
      }
    }
    
    content += 'END OF REPORT\n';
    content += '=============\n';
    
    return content;
  }

  // Helper method for score categories
  getScoreCategory(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  // Restricted Zones and Materials (existing methods)
  public async loadRestrictedZones(): Promise<void> {
    this.isLoadingRestrictions.set(true);
    
    try {
      await this.loadGeoJSONData();
      console.log('✅ Loaded restricted zones from GeoJSON:', this.restrictedZonesData.length);
    } catch (error) {
      console.error('❌ Error loading restricted zones from GeoJSON:', error);
      this.loadManualRestrictedZones();
    } finally {
      this.isLoadingRestrictions.set(false);
    }
  }

  private async loadGeoJSONData(): Promise<void> {
    const possiblePaths = [
      '/geojson.geojson',
      '/assets/geojson/restricted-areas.geojson',
      'geojson.geojson',
      './geojson.geojson'
    ];

    for (const path of possiblePaths) {
      try {
        console.log(`🔍 Trying to load from: ${path}`);
        const response = await fetch(path);
        
        if (response.ok) {
          const geojsonData: GeoJSONData = await response.json();
          
          if (geojsonData?.features && geojsonData.features.length > 0) {
            console.log(`✅ Successfully loaded from: ${path}`);
            console.log(`📊 Processing ${geojsonData.features.length} features`);
            await this.processGeoJSONFeaturesOptimized(geojsonData.features);
            return;
          }
        }
      } catch (error) {
        console.log(`❌ Failed to load from ${path}:`, error);
        continue;
      }
    }
    
    throw new Error('Could not load GeoJSON from any known path');
  }

  private async processGeoJSONFeaturesOptimized(features: GeoJSONFeature[]): Promise<void> {
    const batchSize = 50;
    const totalBatches = Math.ceil(features.length / batchSize);
    
    console.log(`🔄 Processing ${features.length} features in ${totalBatches} batches...`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, features.length);
      const batch = features.slice(startIndex, endIndex);

      const batchResults = this.processFeatureBatch(batch, startIndex);
      this.restrictedZonesData.push(...batchResults);

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
      if (!feature.properties?.name) {
        console.log('⏩ Skipping feature without name');
        continue;
      }

      try {
        const zoneType = this.determineZoneType(feature);
        const bufferDistance = this.getBufferDistance(zoneType);
        
        let coordinates: number[][][] = [];

        if (feature.geometry.type === 'Polygon') {
          coordinates = this.simplifyPolygon(feature.geometry.coordinates as number[][][]);
        } else if (feature.geometry.type === 'MultiPolygon') {
          coordinates = this.simplifyPolygon((feature.geometry.coordinates as number[][][][])[0]);
        } else if (feature.geometry.type === 'LineString') {
          coordinates = this.lineStringToPolygon(
            feature.geometry.coordinates as number[][], 
            bufferDistance / 1000
          );
        } else if (feature.geometry.type === 'Point') {
          const point = feature.geometry.coordinates as number[];
          const circle = turf.circle(point, 0.2, { units: 'kilometers', steps: 8 });
          coordinates = (circle.geometry as any).coordinates as number[][][];
        } else {
          console.log(`⏩ Skipping unsupported geometry type: ${feature.geometry.type}`);
          continue;
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
          
          zone.bounds = this.calculateBounds(coordinates[0]);
          results.push(zone);
          console.log(`✅ Created zone: ${zone.name} with ${coordinates[0].length} points`);
        } else {
          console.log(`⏩ Skipping zone with no valid coordinates: ${feature.properties.name}`);
        }
      } catch (error) {
        console.warn('❌ Error processing GeoJSON feature:', feature.properties.name, error);
      }
    }

    return results;
  }

  private lineStringToPolygon(coordinates: number[][], bufferDistance: number): number[][][] {
    try {
      const line = turf.lineString(coordinates);
      const buffered = turf.buffer(line, bufferDistance, { units: 'kilometers' });
      
      if (buffered?.geometry?.coordinates) {
        return buffered.geometry.coordinates as number[][][];
      } else {
        throw new Error('Buffer operation failed');
      }
    } catch (error) {
      console.warn('Error converting LineString to Polygon:', error);
      return this.createSimpleLineBuffer(coordinates, bufferDistance);
    }
  }

  private createSimpleLineBuffer(coordinates: number[][], bufferDistance: number): number[][][] {
    if (coordinates.length < 2) return [coordinates];
    
    const bufferCoords: number[][] = [];
    const earthRadius = 6371;
    
    coordinates.forEach((coord, index) => {
      if (index === 0 || index === coordinates.length - 1) {
        const lat = coord[1];
        const lng = coord[0];
        const latOffset = (bufferDistance / earthRadius) * (180 / Math.PI);
        const lngOffset = (bufferDistance / earthRadius) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
        
        bufferCoords.push([lng - lngOffset, lat - latOffset]);
        bufferCoords.push([lng + lngOffset, lat - latOffset]);
        bufferCoords.push([lng + lngOffset, lat + latOffset]);
        bufferCoords.push([lng - lngOffset, lat + latOffset]);
        bufferCoords.push([lng - lngOffset, lat - latOffset]);
      }
    });
    
    return [bufferCoords];
  }

  private simplifyPolygon(coordinates: number[][][]): number[][][] {
    if (!coordinates || coordinates.length === 0) return coordinates;
    
    const simplified = coordinates.map(polygon => {
      if (polygon.length > 50) {
        return polygon.filter((_, index) => index % 3 === 0);
      }
      return polygon;
    });
    
    return simplified;
  }

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
        name.includes('conservancy') || name.includes('wildlife') || name.includes('forest')) {
      return 'Protected Area';
    }
    
    if (name.includes('lake') || name.includes('river') || name.includes('water') || 
        name.includes('reservoir') || name.includes('wetland') || name.includes('swamp') ||
        name.includes('dam') || name.includes('stream') || name.includes('creek') ||
        name.includes('pond') || name.includes('lagoon') || otherProps.includes('natural=water')) {
      return 'Water Body';
    }

    if (name.includes('highway') || name.includes('road') || name.includes('street') ||
        name.includes('avenue') || name.includes('railway') || name.includes('railroad') ||
        name.includes('rail track') || name.includes('highway') || name.includes('motorway') ||
        name.includes('expressway') || name.includes('freeway') || otherProps.includes('highway') ||
        otherProps.includes('railway')) {
      return 'Transportation Corridor';
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

    if (feature.properties['highway'] || feature.properties['railway']) {
      return 'Transportation Corridor';
    }

    return 'Restricted Area';
  }

  private getBufferDistance(zoneType: string): number {
    switch (zoneType) {
      case 'Protected Area': return 2000;
      case 'Airport': return 3000;
      case 'Water Body': return 500;
      case 'Transportation Corridor': return 200;
      default: return 1000;
    }
  }

  private loadManualRestrictedZones(): void {
    console.log('🔄 Loading manual restricted zones as fallback');
    this.restrictedZonesData = [
      {
        id: 'manual-1',
        name: 'Nairobi National Park',
        type: 'Protected Area',
        coordinates: [[
          [36.75, -1.40], [36.95, -1.40], [36.95, -1.20], [36.75, -1.20], [36.75, -1.40]
        ]],
        bufferDistance: 2000,
        source: 'manual'
      },
      {
        id: 'manual-2',
        name: 'Jomo Kenyatta International Airport',
        type: 'Airport',
        coordinates: [[
          [36.92, -1.33], [36.98, -1.33], [36.98, -1.30], [36.92, -1.30], [36.92, -1.33]
        ]],
        bufferDistance: 3000,
        source: 'manual'
      },
      {
        id: 'manual-3',
        name: 'Lake Naivasha',
        type: 'Water Body',
        coordinates: [[
          [36.35, -0.70], [36.45, -0.70], [36.45, -0.75], [36.35, -0.75], [36.35, -0.70]
        ]],
        bufferDistance: 500,
        source: 'manual'
      },
      {
        id: 'manual-4',
        name: 'Nairobi-Mombasa Highway',
        type: 'Transportation Corridor',
        coordinates: [[
          [36.82, -1.30], [37.00, -1.35], [37.20, -1.40], [37.40, -1.45], [36.82, -1.30]
        ]],
        bufferDistance: 200,
        source: 'manual'
      }
    ];
  }

  private addRestrictedZones(): void {
    if (!this.map || this.restrictedZonesData.length === 0 || !this.restrictedZonesLayer || !this.bufferZonesLayer) {
      console.warn('⚠️ Cannot add restricted zones - missing dependencies');
      return;
    }

    this.restrictedZonesLayer.clearLayers();
    this.bufferZonesLayer.clearLayers();

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
      [zone.bounds[1], zone.bounds[0]],
      [zone.bounds[3], zone.bounds[2]]
    );
    
    return mapBounds.intersects(zoneBounds);
  }

  private addZoneToMap(zone: RestrictedZone): void {
    try {
      if (zone.coordinates.length === 0 || zone.coordinates[0].length < 4) {
        console.warn(`⚠️ Skipping zone ${zone.name}: Invalid coordinates`);
        return;
      }

      const firstCoord = zone.coordinates[0][0];
      const lastCoord = zone.coordinates[0][zone.coordinates[0].length - 1];
      
      if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
        console.warn(`⚠️ Auto-closing polygon for ${zone.name}`);
        zone.coordinates[0].push([firstCoord[0], firstCoord[1]]);
      }

      const leafletCoords = zone.coordinates[0].map(coord => [coord[1], coord[0]] as [number, number]);
      
      const polygon = L.polygon(leafletCoords, {
        color: this.getZoneColor(zone.type),
        fillColor: this.getZoneColor(zone.type),
        fillOpacity: 0.3,
        weight: 2,
        smoothFactor: 1
      }).addTo(this.restrictedZonesLayer!);

      try {
        const zonePolygon = turf.polygon(zone.coordinates);
        const buffer = turf.buffer(zonePolygon, zone.bufferDistance / 1000, { units: 'kilometers' });
        
        if (buffer?.geometry?.coordinates) {
          const bufferCoords = buffer.geometry.coordinates as number[][][];
          
          if (bufferCoords.length > 0 && bufferCoords[0].length > 0) {
            const leafletBufferCoords = bufferCoords[0].map(coord => [coord[1], coord[0]] as [number, number]);
            
            L.polygon(leafletBufferCoords, {
              color: this.getZoneColor(zone.type),
              fillColor: this.getZoneColor(zone.type),
              fillOpacity: 0.1,
              weight: 1,
              dashArray: '5,5',
              smoothFactor: 1
            }).addTo(this.bufferZonesLayer!);
          }
        }
      } catch (bufferError) {
        console.warn(`⚠️ Could not create buffer for ${zone.name}:`, bufferError);
      }

      polygon.bindPopup(`
        <div style="min-width: 250px;">
          <h3>${zone.name}</h3>
          <p><strong>Type:</strong> ${zone.type}</p>
          <p><strong>Buffer:</strong> ${zone.bufferDistance}m</p>
          <p><strong>Source:</strong> ${zone.source === 'geojson' ? 'Local GeoJSON Data' : 'Manual Data'}</p>
          <p><em>Construction restricted in this area</em></p>
        </div>
      `);

    } catch (error) {
      console.warn('❌ Error adding zone to map:', zone.name, error);
    }
  }

  private getZoneColor(zoneType: string): string {
    switch (zoneType) {
      case 'Protected Area': return GovernmentColors.kenyaGreen;
      case 'Airport': return GovernmentColors.kenyaRed;
      case 'Water Body': return GovernmentColors.kbrcBlue;
      case 'Transportation Corridor': return GovernmentColors.kbrcDarkBlue;
      default: return GovernmentColors.kbrcGray;
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
        console.log('✅ Loaded materials from API:', materials.length);
      },
      error: (error) => {
        console.error('❌ Error loading materials from API:', error);
        this.materialService.getMaterials().subscribe({
          next: (materials) => {
            this.materials.set(materials);
            this.addMaterialMarkers();
            this.isLoading.set(false);
            console.log('✅ Loaded materials from local service:', materials.length);
          },
          error: (serviceError) => {
            console.error('❌ Error loading materials from service:', serviceError);
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

    console.log(`📦 Added ${this.markers.length} material markers to map`);
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

  private checkRestrictionsOptimized(sitePoint: any): string[] {
    const restrictions: string[] = [];
    const siteLng = sitePoint.geometry.coordinates[0];
    const siteLat = sitePoint.geometry.coordinates[1];

    for (const zone of this.restrictedZonesData) {
      if (zone.bounds) {
        const [minLng, minLat, maxLng, maxLat] = zone.bounds;
        if (siteLng < minLng || siteLng > maxLng || siteLat < minLat || siteLat > maxLat) {
          continue;
        }
      }

      try {
        const zonePolygon = turf.polygon(zone.coordinates);
        const isInZone = turf.booleanPointInPolygon(sitePoint, zonePolygon);
        
        if (isInZone) {
          restrictions.push(`🚫 Site is inside ${zone.name} (${zone.type})`);
        } else {
          const buffer = turf.buffer(zonePolygon, zone.bufferDistance / 1000, { units: 'kilometers' });
          if (buffer?.geometry?.coordinates) {
            const isInBuffer = turf.booleanPointInPolygon(sitePoint, buffer);
            if (isInBuffer) {
              restrictions.push(`⚠️ Site is within ${zone.bufferDistance}m buffer of ${zone.name}`);
            }
          }
        }
      } catch (error) {
        console.warn('Error checking zone:', zone.name, error);
      }
    }

    return restrictions;
  }

  private findNearestMaterialsOptimized(site: L.LatLng): AnalysisResult['nearestMaterials'] {
    const sitePoint = turf.point([site.lng, site.lat]);
    const maxDistance = 50000;
    
    return this.materials()
      .map(material => {
        const materialPoint = turf.point([material.location.longitude, material.location.latitude]);
        const distance = turf.distance(sitePoint, materialPoint, { units: 'kilometers' }) * 1000;
        
        return {
          material,
          distance: Math.round(distance),
          travelTime: Math.round((distance / 1000) / 40 * 60)
        };
      })
      .filter(item => item.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }

  // Public methods
  clearSite(): void {
    if (this.siteMarker) {
      this.map!.removeLayer(this.siteMarker);
      this.siteMarker = null;
    }
    this.clearAlternativeMarker();
    this.selectedSite.set(null);
    this.analysisResult.set(null);
    this.aiRecommendation.set(null);
    this.aiError.set(null);
    console.log('🗑️ Site cleared');
  }

  toggleLayer(layer: 'restricted' | 'buffer' | 'materials', show: boolean): void {
    if (!this.map) return;

    switch (layer) {
      case 'restricted':
        if (this.restrictedZonesLayer) {
          show ? this.map.addLayer(this.restrictedZonesLayer) : this.map.removeLayer(this.restrictedZonesLayer);
          console.log(`🚫 Restricted zones ${show ? 'shown' : 'hidden'}`);
        }
        break;
      case 'buffer':
        if (this.bufferZonesLayer) {
          show ? this.map.addLayer(this.bufferZonesLayer) : this.map.removeLayer(this.bufferZonesLayer);
          console.log(`📏 Buffer zones ${show ? 'shown' : 'hidden'}`);
        }
        break;
      case 'materials':
        if (this.materialMarkersLayer) {
          show ? this.map.addLayer(this.materialMarkersLayer) : this.map.removeLayer(this.materialMarkersLayer);
          console.log(`📦 Material markers ${show ? 'shown' : 'hidden'}`);
        }
        break;
    }
  }

  isMapLoaded(): boolean {
    return !!this.map;
  }

  getAnalysisStatus(): string {
    if (this.isAnalyzing()) return 'analyzing';
    if (this.isAIAnalyzing()) return 'ai-analyzing';
    if (this.analysisResult()) return 'completed';
    return 'idle';
  }
}