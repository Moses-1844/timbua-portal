import { Component, OnInit, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { MaterialService } from '../../services/material.service';
import { Material } from '../../models/material.model';
import { GovernmentColors } from '../../config/colors.config';

// Define simple interfaces for our restricted zones
interface RestrictedZone {
  id: string;
  name: string;
  type: string;
  coordinates: number[][][]; // [[[lng, lat], [lng, lat], ...]]
  bufferDistance: number; // in meters
}

interface AnalysisResult {
  isValid: boolean;
  restrictions: string[];
  nearestMaterials: {
    material: Material;
    distance: number; // in meters
    travelTime: number; // in minutes
  }[];
  recommendations: string[];
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
  
  private map: L.Map | undefined;
  private markers: L.Marker[] = [];
  private siteMarker: L.Marker | null = null;
  private restrictedZones: L.LayerGroup | null = null;
  
  materials = signal<Material[]>([]);
  selectedSite = signal<{ lat: number; lng: number } | null>(null);
  analysisResult = signal<AnalysisResult | null>(null);
  isLoading = signal(false);
  isAnalyzing = signal(false);
  
  // Make Math available in template
  Math = Math;

  // Mock restricted zones with simple coordinates
  private restrictedZonesData: RestrictedZone[] = [
    {
      id: '1',
      name: 'Tsavo East National Park',
      type: 'Protected Area',
      coordinates: [[
        [38.5, -3.0],
        [39.5, -3.0],
        [39.5, -2.5],
        [38.5, -2.5],
        [38.5, -3.0]
      ]],
      bufferDistance: 5000 // 5km buffer
    },
    {
      id: '2',
      name: 'Mombasa Airport',
      type: 'Airport',
      coordinates: [[
        [39.60, -4.03],
        [39.65, -4.03],
        [39.65, -4.00],
        [39.60, -4.00],
        [39.60, -4.03]
      ]],
      bufferDistance: 3000 // 3km buffer
    },
    {
      id: '3',
      name: 'Mida Creek Conservation Area',
      type: 'Marine Protected Area',
      coordinates: [[
        [39.90, -3.35],
        [40.00, -3.35],
        [40.00, -3.25],
        [39.90, -3.25],
        [39.90, -3.35]
      ]],
      bufferDistance: 2000 // 2km buffer
    }
  ];

  ngOnInit() {
    this.loadMaterials();
  }

  ngAfterViewInit() {
    this.initMap();
  }

  private initMap(): void {
    this.map = L.map('decision-map', {
      center: [-4.0000, 39.3000],
      zoom: 10,
      zoomControl: false
    });

    L.control.zoom({
      position: 'topright'
    }).addTo(this.map);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(this.map);

    // Add restricted zones layer
    this.addRestrictedZones();

    // Add click event for site selection
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.onMapClick(e.latlng);
    });
  }

  private addRestrictedZones(): void {
    this.restrictedZones = L.layerGroup().addTo(this.map!);

    this.restrictedZonesData.forEach(zone => {
      // Convert coordinates to Leaflet format [lat, lng]
      const leafletCoords = zone.coordinates[0].map(coord => [coord[1], coord[0]] as [number, number]);
      
      const polygon = L.polygon(leafletCoords, {
        color: GovernmentColors.kenyaRed,
        fillColor: GovernmentColors.kenyaRed,
        fillOpacity: 0.2,
        weight: 2
      }).addTo(this.restrictedZones!);

      // Create buffer zone using Turf.js
      try {
        const zonePolygon = turf.polygon(zone.coordinates);
        const buffer = turf.buffer(zonePolygon, zone.bufferDistance / 1000, { units: 'kilometers' });
        
        if (buffer && buffer.geometry) {
          const bufferCoords = (buffer.geometry as any).coordinates[0].map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
          
          L.polygon(bufferCoords, {
            color: GovernmentColors.kenyaRed,
            fillColor: GovernmentColors.kenyaRed,
            fillOpacity: 0.1,
            weight: 1,
            dashArray: '5,5'
          }).addTo(this.restrictedZones!);
        }
      } catch (error) {
        console.warn('Could not create buffer for zone:', zone.name, error);
      }

      // Add popup with zone info
      polygon.bindPopup(`
        <div>
          <h3>${zone.name}</h3>
          <p><strong>Type:</strong> ${zone.type}</p>
          <p><strong>Buffer:</strong> ${zone.bufferDistance}m</p>
          <p><em>Construction restricted in this area</em></p>
        </div>
      `);
    });
  }

  private loadMaterials(): void {
    this.isLoading.set(true);
    
    this.materialService.getMaterials().subscribe({
      next: (materials) => {
        this.materials.set(materials);
        this.addMaterialMarkers();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading materials:', error);
        // Use mock data as fallback
        const mockData = this.getMockMaterials();
        this.materials.set(mockData);
        this.addMaterialMarkers();
        this.isLoading.set(false);
      }
    });
  }

  private getMockMaterials(): Material[] {
    // Return simplified mock materials for testing
    return [
      {
        id: '1',
        questionnaireNo: '1',
        researchAssistantNo: '002/B1',
        name: 'Local blocks, Kokoto',
        type: ['Blocks', 'Kokoto'],
        location: {
          name: 'Mwachanda',
          latitude: -4.170327,
          longitude: 39.246377,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mwanamwinga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🧱'
      },
      {
        id: '13',
        questionnaireNo: '13',
        researchAssistantNo: '002/B1',
        name: 'River Sand',
        type: ['Sand'],
        location: {
          name: 'Mwache bridge',
          latitude: -3.94485,
          longitude: 39.510227,
          county: 'Mombasa',
          subCounty: 'Kisauni',
          ward: 'Mtopanga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🏖️'
      },
      {
        id: '14',
        questionnaireNo: '14',
        researchAssistantNo: '002/B1',
        name: 'Ballast, Washed sand',
        type: ['Ballast', 'Sand'],
        location: {
          name: 'Bonje, Mwache',
          latitude: -4.002532,
          longitude: 39.536543,
          county: 'Mombasa',
          subCounty: 'Kisauni',
          ward: 'Mtopanga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '⛰️'
      },
      {
        id: '22',
        questionnaireNo: '22',
        researchAssistantNo: '002/B1',
        name: 'Ballast',
        type: ['Ballast'],
        location: {
          name: 'Mbandi',
          latitude: -4.128325,
          longitude: 39.3289,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mazeras'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '⛰️'
      }
    ];
  }

  private addMaterialMarkers(): void {
    if (!this.map) return;

    // Clear existing material markers
    this.markers.forEach(marker => this.map!.removeLayer(marker));
    this.markers = [];

    this.materials().forEach(material => {
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
      marker.addTo(this.map!);
      this.markers.push(marker);
    });
  }

  private onMapClick(latlng: L.LatLng): void {
    // Clear previous site marker
    if (this.siteMarker) {
      this.map!.removeLayer(this.siteMarker);
    }

    // Add new site marker
    this.siteMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'site-marker',
        html: this.createSiteMarkerHtml(),
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      })
    }).addTo(this.map!);

    this.selectedSite.set({ lat: latlng.lat, lng: latlng.lng });
    
    // Analyze the site
    this.analyzeSite(latlng);
  }

  private analyzeSite(latlng: L.LatLng): void {
    this.isAnalyzing.set(true);
    
    setTimeout(() => {
      const sitePoint = turf.point([latlng.lng, latlng.lat]);
      const restrictions: string[] = [];
      
      // Check if site is in restricted zones
      this.restrictedZonesData.forEach(zone => {
        try {
          const zonePolygon = turf.polygon(zone.coordinates);
          const isInZone = turf.booleanPointInPolygon(sitePoint, zonePolygon);
          
          if (isInZone) {
            restrictions.push(`🚫 Site is inside ${zone.name} (${zone.type})`);
          } else {
            // Check buffer zone
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

      // Find nearest materials
      const nearestMaterials = this.findNearestMaterials(latlng);
      
      // Generate recommendations
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
        
        // Estimate travel time (assuming 40km/h average speed)
        const travelTime = (distance / 1000) / 40 * 60; // in minutes
        
        return {
          material,
          distance,
          travelTime: Math.round(travelTime)
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5); // Top 5 nearest
  }

  private generateRecommendations(restrictions: string[], nearestMaterials: AnalysisResult['nearestMaterials']): string[] {
    const recommendations: string[] = [];

    if (restrictions.length > 0) {
      recommendations.push('❌ Consider selecting a different site location');
      recommendations.push('📋 Check with local authorities for construction permits');
    } else {
      recommendations.push('✅ Site appears suitable for construction');
    }

    if (nearestMaterials.length > 0) {
      const closest = nearestMaterials[0];
      recommendations.push(`📦 Nearest material source: ${closest.material.name} (${Math.round(closest.distance)}m away)`);
      
      // Material-specific recommendations
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
    }

    // Cost-saving recommendations
    if (nearestMaterials.length >= 3) {
      const avgDistance = nearestMaterials.reduce((sum, item) => sum + item.distance, 0) / nearestMaterials.length;
      if (avgDistance < 5000) { // 5km
        recommendations.push('💰 Good material availability - potential for bulk purchase discounts');
      }
    }

    return recommendations;
  }

  private getMarkerColor(material: Material): string {
    if (material.type.includes('Sand')) return GovernmentColors.kbrcBlue;
    if (material.type.includes('Blocks')) return GovernmentColors.kenyaGreen;
    if (material.type.includes('Ballast')) return GovernmentColors.kenyaRed;
    if (material.type.includes('Rocks')) return GovernmentColors.kbrcDarkBlue;
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

  toggleRestrictedZones(show: boolean): void {
    if (this.restrictedZones) {
      if (show) {
        this.map!.addLayer(this.restrictedZones);
      } else {
        this.map!.removeLayer(this.restrictedZones);
      }
    }
  }
}