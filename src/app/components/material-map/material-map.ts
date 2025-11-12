import { Component, OnInit, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { MaterialService } from '../../services/material.service';
import { Material } from '../../models/material.model';
import { GovernmentColors } from '../../config/colors.config';

interface SubCounty {
  name: string;
}

interface County {
  code: number;
  name: string;
  subCounties: SubCounty[];
}

interface CountyData {
  counties: County[];
}

// County boundary approximations
const COUNTY_BOUNDARIES = {
  'Mombasa': { lat: [-4.1, -3.9], lng: [39.5, 39.8] },
  'Kilifi': { lat: [-3.9, -2.5], lng: [39.5, 40.2] },
  'Kwale': { lat: [-4.5, -3.8], lng: [39.1, 39.5] },
  'Lamu': { lat: [-2.5, -1.9], lng: [40.8, 41.1] },
  'Taita Taveta': { lat: [-3.8, -2.8], lng: [38.0, 38.8] }
};

@Component({
  selector: 'app-material-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './material-map.html',
  styleUrls: ['./material-map.scss']
})
export class MaterialMap implements OnInit, AfterViewInit {
  private materialService = inject(MaterialService);
  private http = inject(HttpClient);
  
  private map: L.Map | undefined;
  private markers: L.Marker[] = [];
  
  materials = signal<Material[]>([]);
  filteredMaterials = signal<Material[]>([]);
  selectedMaterial = signal<Material | null>(null);
  isLoading = signal(false);
  hasError = signal(false);
  mapInitialized = signal(false);
  
  // County and sub-county data
  countiesData = signal<CountyData>({ counties: [] });
  availableCounties = signal<string[]>([]);
  availableSubCounties = signal<string[]>([]);
  
  filters = signal({
    type: '',
    county: '',
    subCounty: '',
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
    this.loadCountiesData();
    this.loadMaterials();
  }

  ngAfterViewInit() {
    console.log('AfterViewInit - Initializing map...');
    this.initMap();
  }

  private loadCountiesData(): void {
    this.http.get<CountyData>('/assets/counties-data.json').subscribe({
      next: (data: CountyData) => {
        console.log('Loaded counties data:', data);
        this.countiesData.set(data);
        // Extract county names
        const countyNames = data.counties.map(county => county.name).sort();
        this.availableCounties.set(countyNames);
      },
      error: (error) => {
        console.error('Error loading counties data:', error);
        // Fallback to empty data
        this.countiesData.set({ counties: [] });
        this.availableCounties.set([]);
      }
    });
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
          
          // Extract counties from materials data if JSON file failed to load
          if (this.availableCounties().length === 0) {
            this.extractCountiesFromMaterials(transformedMaterials);
          }
          
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

  private extractCountiesFromMaterials(materials: Material[]): void {
    const countiesMap: { [county: string]: string[] } = {};
    
    materials.forEach(material => {
      const county = material.location.county;
      const subCounty = material.location.subCounty;
      
      if (county && county !== 'Unknown') {
        if (!countiesMap[county]) {
          countiesMap[county] = [];
        }
        
        if (subCounty && subCounty !== 'Unknown' && !countiesMap[county].includes(subCounty)) {
          countiesMap[county].push(subCounty);
        }
      }
    });
    
    // Convert to CountyData structure
    const countyData: CountyData = {
      counties: Object.keys(countiesMap).map(countyName => ({
        code: 0, // Default code since we don't have it from materials
        name: countyName,
        subCounties: countiesMap[countyName].map(subCountyName => ({ name: subCountyName }))
      }))
    };
    
    this.countiesData.set(countyData);
    this.availableCounties.set(Object.keys(countiesMap).sort());
    console.log('Extracted counties from materials:', countyData);
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
    const locationData = this.extractLocationData(apiMaterial);
    
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
        county: locationData.county,
        subCounty: locationData.subCounty,
        ward: locationData.ward
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

  private extractLocationData(apiMaterial: any): { county: string; subCounty: string; ward: string } {
    const locationString = apiMaterial.materialLocation;
    const latitude = apiMaterial.latitude;
    const longitude = apiMaterial.longitude;

    if (!locationString || typeof locationString !== 'string') {
      return this.detectCountyFromCoordinates(latitude, longitude);
    }

    // First try to extract from location string using counties data
    const countiesData = this.countiesData();
    const locationLower = locationString.toLowerCase();
    
    for (const county of countiesData.counties) {
      // Check if location contains county name
      if (locationLower.includes(county.name.toLowerCase())) {
        // Try to find sub-county
        for (const subCounty of county.subCounties) {
          if (locationLower.includes(subCounty.name.toLowerCase())) {
            return { 
              county: county.name, 
              subCounty: subCounty.name, 
              ward: this.extractWard(locationString) 
            };
          }
        }
        // If no sub-county found, return county with unknown sub-county
        return { 
          county: county.name, 
          subCounty: 'Unknown', 
          ward: this.extractWard(locationString) 
        };
      }
    }

    // If county not found in string, try to detect from coordinates
    const coordinateBasedCounty = this.detectCountyFromCoordinates(latitude, longitude);
    
    // Try to extract sub-county from location string as fallback
    const extractedSubCounty = this.extractSubCounty(locationString);
    
    return {
      county: coordinateBasedCounty.county,
      subCounty: extractedSubCounty !== 'Unknown' ? extractedSubCounty : coordinateBasedCounty.subCounty,
      ward: this.extractWard(locationString)
    };
  }

  private detectCountyFromCoordinates(latitude: number, longitude: number): { county: string; subCounty: string; ward: string } {
    // Simple coordinate-based county detection
    for (const [countyName, bounds] of Object.entries(COUNTY_BOUNDARIES)) {
      if (latitude >= bounds.lat[0] && latitude <= bounds.lat[1] &&
          longitude >= bounds.lng[0] && longitude <= bounds.lng[1]) {
        return {
          county: countyName,
          subCounty: 'Unknown',
          ward: 'Unknown'
        };
      }
    }

    // Fallback: Use reverse geocoding API (Nominatim)
    // Note: This is a simple implementation. For production, you might want to use a proper geocoding service
    if (latitude && longitude) {
      // Simple region detection based on coordinates
      if (latitude < -3.5 && longitude > 39.0) {
        return { county: 'Kilifi', subCounty: 'Unknown', ward: 'Unknown' };
      } else if (latitude < -4.0 && longitude < 39.5) {
        return { county: 'Kwale', subCounty: 'Unknown', ward: 'Unknown' };
      } else if (latitude > -2.5) {
        return { county: 'Lamu', subCounty: 'Unknown', ward: 'Unknown' };
      }
    }

    // Final fallback
    return { county: 'Mombasa', subCounty: 'Unknown', ward: 'Unknown' };
  }

  private extractSubCounty(location: string): string {
    if (!location || typeof location !== 'string') {
      return 'Unknown';
    }
    
    // Extract sub-county from location string
    const locationLower = location.toLowerCase();
    
    // Check for common sub-counties in the coastal region
    const subCounties = [
      'Bamburi', 'Shanzu', 'Mtopanga', 'Mwakurunge', 'Junda', 'Kisauni', 'Nyali',
      'Likoni', 'Mvita', 'Changamwe', 'Jomvu', 'Kilifi', 'Malindi', 'Watamu',
      'Diani', 'Ukunda', 'Lungalunga', 'Msambweni', 'Kinango'
    ];
    
    for (const subCounty of subCounties) {
      if (locationLower.includes(subCounty.toLowerCase())) {
        return subCounty;
      }
    }
    
    return 'Unknown';
  }

  private extractWard(location: string): string {
    if (!location || typeof location !== 'string') {
      return 'Unknown';
    }
    
    // Extract ward from location string
    const parts = location.split('-');
    if (parts.length > 1) {
      return parts[1].trim();
    }
    
    // Try other common separators
    const separators = [',', ';', '|', '/'];
    for (const separator of separators) {
      if (location.includes(separator)) {
        const separatedParts = location.split(separator);
        if (separatedParts.length > 1) {
          return separatedParts[1].trim();
        }
      }
    }
    
    return location; // Return the whole location if no clear ward can be extracted
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

    // Log county distribution for debugging
    const countyCount: { [county: string]: number } = {};
    validMaterials.forEach(material => {
      countyCount[material.location.county] = (countyCount[material.location.county] || 0) + 1;
    });
    console.log('County distribution:', countyCount);

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
        <p><strong>County:</strong> ${material.location.county}</p>
        <p><strong>Sub-County:</strong> ${material.location.subCounty}</p>
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
      const countyMatch = !currentFilters.county || material.location.county === currentFilters.county;
      const subCountyMatch = !currentFilters.subCounty || material.location.subCounty === currentFilters.subCounty;
      const materialMatch = !currentFilters.material || material.name.toLowerCase().includes(currentFilters.material.toLowerCase());
      
      return typeMatch && countyMatch && subCountyMatch && materialMatch;
    });

    this.filteredMaterials.set(filtered);
    this.addMarkersToMap();
  }

  clearFilters(): void {
    this.filters.set({ type: '', county: '', subCounty: '', material: '' });
    this.availableSubCounties.set([]);
    this.filteredMaterials.set(this.materials());
    this.addMarkersToMap();
  }

  onFilterChange(filterType: 'type' | 'county' | 'subCounty' | 'material', value: string): void {
    this.filters.update(filters => {
      const newFilters = { ...filters, [filterType]: value };
      
      // If county changed, reset sub-county and update available sub-counties
      if (filterType === 'county' && value !== filters.county) {
        newFilters.subCounty = '';
        this.updateAvailableSubCounties(value);
      }
      
      return newFilters;
    });
  }

  private updateAvailableSubCounties(countyName: string): void {
    if (countyName) {
      const county = this.countiesData().counties.find(c => c.name === countyName);
      if (county) {
        const subCountyNames = county.subCounties.map(sc => sc.name).sort();
        this.availableSubCounties.set(subCountyNames);
      } else {
        this.availableSubCounties.set([]);
      }
    } else {
      this.availableSubCounties.set([]);
    }
  }

  retryLoadMaterials(): void {
    this.loadMaterials();
  }

  closeMaterialDetails(): void {
    this.selectedMaterial.set(null);
  }
}