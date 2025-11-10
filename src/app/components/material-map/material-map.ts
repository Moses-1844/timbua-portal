import { Component, OnInit, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { MaterialService } from '../../services/material.service';
import { Material, ApiMaterialSite } from '../../models/material.model';
import { GovernmentColors } from '../../config/colors.config';

@Component({
  selector: 'app-material-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './material-map.html',
  styleUrl: './material-map.scss',
})
export class MaterialMap implements OnInit, AfterViewInit {
  private materialService = inject(MaterialService);
  
  private map: L.Map | undefined;
  private markers: L.Marker[] = [];
  
  materials = signal<Material[]>([]);
  filteredMaterials = signal<Material[]>([]);
  selectedMaterial = signal<Material | null>(null);
  isLoading = signal(false);
  hasError = signal(false);
  mapInitialized = signal(false);
  
  filters = signal({
    type: '',
    region: '',
    material: ''
  });

  // Material icons mapping
  private materialIcons: { [key: string]: string } = {
    'Blocks': '🧱',
    'Bricks': '🧱',
    'Sand': '🏖️',
    'Ballast': '⛰️',
    'Stones': '🪨',
    'Limestone': '🪨',
    'Timber': '🪵',
    'Wood': '🪵',
    'Makuti': '🌴',
    'Glass': '🔲',
    'Cement': '🏗️',
    'Concrete': '🏗️',
    'Metal': '⚙️',
    'Poles': '🎋',
    'Culvert': '🔄',
    'Balcony': '🏢',
    'Balusters': '🏢',
    'Ventilation': '💨',
    'Cinder': '🧱',
    'Cabro': '🧱',
    'Coral': '🪸',
    'Other': '📦',
    'default': '📦'
  };

  getTypeIcon(type: string): string {
    return this.materialIcons[type] || this.materialIcons['default'];
  }

  ngOnInit() {
    console.log('MaterialMap Component Initialized');
    this.loadMaterials();
  }

  ngAfterViewInit() {
    console.log('AfterViewInit - Initializing map...');
    this.initMap();
  }

  public initMap(): void {
    console.log('Initializing Leaflet map...');
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Map container element not found!');
      return;
    }
    
    console.log('Map container found, creating map...');
    
    try {
      this.map = L.map('map', {
        center: [-4.0000, 39.3000],
        zoom: 10,
        zoomControl: false
      });

      console.log('Leaflet map created successfully');

      L.control.zoom({
        position: 'topright'
      }).addTo(this.map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(this.map);

      console.log('Tile layer added to map');
      this.mapInitialized.set(true);
      
    } catch (error) {
      console.error('Error creating Leaflet map:', error);
      this.hasError.set(true);
    }
  }

  private loadMaterials(): void {
    console.log('Loading materials from API...');
    this.isLoading.set(true);
    this.hasError.set(false);

    this.materialService.getMaterials().subscribe({
      next: (apiMaterials: any[]) => {
        console.log('API Response received:', apiMaterials);
        console.log('Materials loaded from API:', apiMaterials?.length);
        
        if (apiMaterials && apiMaterials.length > 0) {
          // Transform API data to match our Material interface with validation
          const transformedMaterials: Material[] = apiMaterials
            .map(apiMaterial => this.transformApiMaterial(apiMaterial))
            .filter((material): material is Material => material !== null);

          console.log('Successfully transformed materials:', transformedMaterials.length);
          this.materials.set(transformedMaterials);
          this.filteredMaterials.set(transformedMaterials);
          this.addMarkersToMap();
        } else {
          console.warn('No materials returned from API');
          this.hasError.set(true);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading materials from API:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        
        // Handle different error types
        if (error.status === 403) {
          console.error('Access forbidden - check API endpoint URL and CORS settings');
        } else if (error.status === 404) {
          console.error('Endpoint not found - check API URL');
        } else if (error.status === 0) {
          console.error('Network error - check connectivity and CORS');
        }
        
        this.hasError.set(true);
        this.isLoading.set(false);
      },
      complete: () => {
        console.log('API call completed');
      }
    });
  }

  private transformApiMaterial(apiMaterial: any): Material | null {
    // Validate required fields
    if (!apiMaterial.id || !apiMaterial.material || !apiMaterial.materialLocation) {
      console.warn('Skipping invalid material data - missing required fields:', apiMaterial);
      return null;
    }

    // Validate coordinates
    if (apiMaterial.latitude == null || apiMaterial.longitude == null || 
        isNaN(apiMaterial.latitude) || isNaN(apiMaterial.longitude)) {
      console.warn('Material has invalid coordinates:', apiMaterial.id, apiMaterial.material);
      return null;
    }

    const materialTypes = this.extractMaterialTypes(apiMaterial.material);
    
    return {
      id: apiMaterial.id.toString(),
      questionnaireNo: apiMaterial.questionnaireNo?.toString() || 'Unknown',
      researchAssistantNo: apiMaterial.researchAssistantNo || 'Unknown',
      name: apiMaterial.material,
      type: materialTypes,
      location: {
        name: apiMaterial.materialLocation,
        latitude: apiMaterial.latitude,
        longitude: apiMaterial.longitude,
        county: 'Mombasa',
        subCounty: this.extractSubCounty(apiMaterial.materialLocation),
        ward: this.extractWard(apiMaterial.materialLocation)
      },
      challenges: this.extractChallenges(apiMaterial),
      recommendations: [],
      timestamp: new Date().toISOString(),
      icon: this.getMaterialIcon(materialTypes),
      materialUsedIn: apiMaterial.materialUsedIn,
      sizeOfManufacturingIndustry: apiMaterial.sizeOfManufacturingIndustry,
      periodOfManufacture: apiMaterial.periodOfManufacture,
      ownerOfMaterial: apiMaterial.ownerOfMaterial,
      materialUsage: apiMaterial.materialUsage,
      numberOfPeopleEmployed: apiMaterial.numberOfPeopleEmployed,
      similarLocations: apiMaterial.similarLocations,
      volumeProducedPerDay: apiMaterial.volumeProducedPerDay,
      comments: apiMaterial.comments
    };
  }

  private extractMaterialTypes(materialString: string): string[] {
    if (!materialString || typeof materialString !== 'string') {
      return ['Other'];
    }

    const types: string[] = [];
    const materialLower = materialString.toLowerCase();
    
    if (materialLower.includes('block')) types.push('Blocks');
    if (materialLower.includes('brick')) types.push('Bricks');
    if (materialLower.includes('sand')) types.push('Sand');
    if (materialLower.includes('stone')) types.push('Stones');
    if (materialLower.includes('limestone')) types.push('Limestone');
    if (materialLower.includes('timber') || materialLower.includes('wood')) types.push('Wood');
    if (materialLower.includes('makuti')) types.push('Makuti');
    if (materialLower.includes('glass')) types.push('Glass');
    if (materialLower.includes('cement')) types.push('Cement');
    if (materialLower.includes('concrete')) types.push('Concrete');
    if (materialLower.includes('metal')) types.push('Metal');
    if (materialLower.includes('pole')) types.push('Poles');
    if (materialLower.includes('culvert')) types.push('Culvert');
    if (materialLower.includes('balcony') || materialLower.includes('baluster')) types.push('Balcony');
    if (materialLower.includes('ventilation')) types.push('Ventilation');
    if (materialLower.includes('cinder')) types.push('Cinder');
    if (materialLower.includes('cabro')) types.push('Cabro');
    if (materialLower.includes('coral')) types.push('Coral');
    
    return types.length > 0 ? types : ['Other'];
  }

  private extractSubCounty(location: string): string {
    if (!location || typeof location !== 'string') {
      return 'Unknown';
    }
    
    // Extract sub-county from location string
    if (location.includes('Bamburi')) return 'Bamburi';
    if (location.includes('Shanzu')) return 'Shanzu';
    if (location.includes('Mtopanga')) return 'Mtopanga';
    if (location.includes('Mwakurunge')) return 'Mwakurunge';
    if (location.includes('Junda')) return 'Junda';
    return 'Unknown';
  }

  private extractWard(location: string): string {
    if (!location || typeof location !== 'string') {
      return 'Unknown';
    }
    
    // Extract ward from location string
    const parts = location.split('-');
    return parts.length > 1 ? parts[1].trim() : location;
  }

  private extractChallenges(apiMaterial: any): string[] {
    const challenges: string[] = [];
    
    // You can extract challenges from comments or other fields
    if (apiMaterial.comments && apiMaterial.comments.includes('challenge')) {
      challenges.push(apiMaterial.comments);
    }
    
    // Add challenges based on other conditions
    if (apiMaterial.periodOfManufacture === '1 year') {
      challenges.push('New operation, limited experience');
    }
    
    return challenges;
  }

  private getMaterialIcon(types: string[]): string {
    // Return the first matching icon, or default
    for (const type of types) {
      if (this.materialIcons[type]) {
        return this.materialIcons[type];
      }
    }
    return this.materialIcons['default'];
  }

  private addMarkersToMap(): void {
    if (!this.map) {
      console.log('Map not ready yet, skipping marker addition');
      return;
    }

    // Clear existing markers
    this.markers.forEach(marker => this.map!.removeLayer(marker));
    this.markers = [];

    const materials = this.filteredMaterials();
    
    console.log('Adding markers for materials:', materials.length);
    
    if (materials.length === 0) {
      console.log('No materials to display');
      return;
    }

    // Filter out materials with invalid coordinates
    const validMaterials = materials.filter(material => {
      const isValid = material.location && 
                     material.location.latitude != null && 
                     material.location.longitude != null &&
                     !isNaN(material.location.latitude) &&
                     !isNaN(material.location.longitude) &&
                     material.location.latitude >= -90 && material.location.latitude <= 90 &&
                     material.location.longitude >= -180 && material.location.longitude <= 180;
      
      if (!isValid) {
        console.warn('Invalid coordinates for material:', material.id, material.name, material.location);
      }
      
      return isValid;
    });

    console.log('Valid materials with coordinates:', validMaterials.length);

    validMaterials.forEach(material => {
      try {
        const markerColor = this.getMarkerColor(material);
        
        const marker = L.marker([material.location.latitude, material.location.longitude], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: this.createMarkerHtml(material.icon || '📦', markerColor),
            iconSize: [40, 40],
            iconAnchor: [20, 40]
          })
        });

        marker.bindPopup(this.createPopupContent(material));
        marker.addTo(this.map!);
        
        marker.on('click', () => {
          this.selectedMaterial.set(material);
        });

        this.markers.push(marker);
      } catch (error) {
        console.error('Error creating marker for material:', material.id, material.name, error);
      }
    });

    // Fit map to show all markers
    if (this.markers.length > 0) {
      try {
        const group = new L.FeatureGroup(this.markers);
        this.map.fitBounds(group.getBounds().pad(0.1));
        console.log('Map fitted to markers');
      } catch (error) {
        console.error('Error fitting map to bounds:', error);
        // Fallback to default view
        this.map.setView([-4.0000, 39.3000], 10);
      }
    } else {
      console.log('No valid markers to display');
    }
  }

  private getMarkerColor(material: Material): string {
    // Ensure type array exists and is not empty
    if (!material.type || !Array.isArray(material.type) || material.type.length === 0) {
      return GovernmentColors.kbrcGray;
    }

    if (material.type.includes('Sand')) return GovernmentColors.kbrcBlue;
    if (material.type.includes('Blocks') || material.type.includes('Bricks')) return GovernmentColors.kenyaGreen;
    if (material.type.includes('Cement') || material.type.includes('Concrete')) return GovernmentColors.kenyaRed;
    if (material.type.includes('Stones') || material.type.includes('Limestone')) return GovernmentColors.kbrcDarkBlue;
    return GovernmentColors.kbrcGray;
  }

  private createMarkerHtml(icon: string, color: string): string {
    return `
      <div style="
        background-color: ${color};
        width: 35px;
        height: 35px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      ">${icon}</div>
    `;
  }

  private createPopupContent(material: Material): string {
    return `
      <div style="min-width: 250px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <span style="font-size: 20px;">${material.icon || '📦'}</span>
          <h3 style="margin: 0; color: ${GovernmentColors.kbrcDarkBlue};">${material.name}</h3>
        </div>
        <p><strong>Location:</strong> ${material.location.name}</p>
        <p><strong>Types:</strong> ${material.type.join(', ')}</p>
        <p><strong>Industry:</strong> ${material.sizeOfManufacturingIndustry}</p>
      </div>
    `;
  }

  applyFilters(): void {
    const currentFilters = this.filters();
    const allMaterials = this.materials();

    const filtered = allMaterials.filter(material => {
      const typeMatch = !currentFilters.type || material.type.includes(currentFilters.type);
      const regionMatch = !currentFilters.region || material.location.county === currentFilters.region;
      const materialMatch = !currentFilters.material || material.name.toLowerCase().includes(currentFilters.material.toLowerCase());
      
      return typeMatch && regionMatch && materialMatch;
    });

    this.filteredMaterials.set(filtered);
    this.addMarkersToMap();
  }

  clearFilters(): void {
    this.filters.set({ type: '', region: '', material: '' });
    this.filteredMaterials.set(this.materials());
    this.addMarkersToMap();
  }

  onFilterChange(filterType: 'type' | 'region' | 'material', value: string): void {
    this.filters.update(filters => ({
      ...filters,
      [filterType]: value
    }));
  }

  retryLoadMaterials(): void {
    this.loadMaterials();
  }
}