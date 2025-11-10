import { Component, OnInit, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { MaterialService } from '../../services/material.service';
import { Material } from '../../models/material.model';
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
  usingMockData = signal(false);
  
  filters = signal({
    type: '',
    region: '',
    material: ''
  });

  // Material icons mapping
  private materialIcons: { [key: string]: string } = {
    'Blocks': '🧱',
    'Rocks': '🪨',
    'Sand': '🏖️',
    'Ballast': '⛰️',
    'Slabs': '🔲',
    'Tiles': '🧩',
    'Kokoto': '🌴',
    'Galana': '🪵',
    'Maram': '🎋',
    'default': '📦'
  };
  getTypeIcon(type: string): string {
  return this.materialIcons[type] || this.materialIcons['default'];
}

  ngOnInit() {
    console.log('MaterialMap Component Initialized');
    this.loadMaterialsWithFallback();
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

  private loadMaterialsWithFallback(): void {
    console.log('Loading materials with immediate fallback...');
    
    const mockData = this.getMockMaterials();
    this.materials.set(mockData);
    this.filteredMaterials.set(mockData);
    this.usingMockData.set(true);
    
    this.tryLoadFromAPI();
  }

  private tryLoadFromAPI(): void {
    console.log('Attempting to load from API...');
    this.isLoading.set(true);
    
    const timeout = setTimeout(() => {
      console.log('API timeout - using mock data');
      this.isLoading.set(false);
      this.hasError.set(true);
    }, 5000);

    this.materialService.getMaterials().subscribe({
      next: (materials) => {
        clearTimeout(timeout);
        console.log('Materials loaded from API:', materials.length);
        if (materials && materials.length > 0) {
          // Add icons to API data
          const materialsWithIcons = materials.map(material => ({
            ...material,
            icon: this.getMaterialIcon(material.type)
          }));
          this.materials.set(materialsWithIcons);
          this.filteredMaterials.set(materialsWithIcons);
          this.usingMockData.set(false);
          this.hasError.set(false);
        }
        this.isLoading.set(false);
        this.addMarkersToMap();
      },
      error: (error) => {
        clearTimeout(timeout);
        console.error('Error loading materials from API:', error);
        this.usingMockData.set(true);
        this.hasError.set(true);
        this.isLoading.set(false);
        this.addMarkersToMap();
      }
    });
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

  private getMockMaterials(): Material[] {
    const mockData = [
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
        challenges: [
          'Some activities is seasonal hence limiting production',
          'Poor roads esp during the rainy season',
          'Flooding',
          'Lack of equipment'
        ],
        recommendations: [
          'Construction of factories to benefit the locals',
          'Price regulation of the materials'
        ],
        timestamp: new Date().toISOString(),
        icon: '🧱'
      },
      {
        id: '2',
        questionnaireNo: '2',
        researchAssistantNo: '002/B1',
        name: 'Slabs - local tiles',
        type: ['Slabs', 'Tiles'],
        location: {
          name: 'Mwachanda',
          latitude: -4.231178,
          longitude: 39.117298,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mwanamwinga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🔲'
      },
      {
        id: '3',
        questionnaireNo: '3',
        researchAssistantNo: '002/B1',
        name: 'Slabs - local tiles, Hardcore blocks, Kokoto',
        type: ['Slabs', 'Tiles', 'Blocks', 'Kokoto'],
        location: {
          name: 'Gandini, South',
          latitude: -4.291798,
          longitude: 39.1483,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mwanamwinga'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🔲'
      },
      {
        id: '4',
        questionnaireNo: '4',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks',
        type: ['Blocks'],
        location: {
          name: 'Bomani, Katindani',
          latitude: -4.249098,
          longitude: 39.160978,
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
        id: '5',
        questionnaireNo: '5',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Magulani',
          latitude: -4.07713,
          longitude: 39.32258,
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
        id: '6',
        questionnaireNo: '6',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Magulani',
          latitude: -4.0968,
          longitude: 39.31684,
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
        id: '7',
        questionnaireNo: '7',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Chonyi',
          latitude: -4.108967,
          longitude: 39.292145,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Chonyi'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🧱'
      },
      {
        id: '8',
        questionnaireNo: '8',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Murungurunguni',
          latitude: -4.112138,
          longitude: 39.263447,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Chonyi'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🧱'
      },
      {
        id: '9',
        questionnaireNo: '9',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Nyambu',
          latitude: -4.111105,
          longitude: 39.257795,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Chonyi'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🧱'
      },
      {
        id: '10',
        questionnaireNo: '10',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks, Kokoto, Galana',
        type: ['Blocks', 'Rocks', 'Kokoto', 'Galana'],
        location: {
          name: 'Mwamandi',
          latitude: -4.124355,
          longitude: 39.145853,
          county: 'Kilifi',
          subCounty: 'Kaloleni',
          ward: 'Mwawesa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🧱'
      },
      {
        id: '11',
        questionnaireNo: '11',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Makuluni',
          latitude: -4.022363,
          longitude: 39.446792,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🧱'
      },
      {
        id: '12',
        questionnaireNo: '12',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Vyogato',
          latitude: -4.002562,
          longitude: 39.457288,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
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
        id: '15',
        questionnaireNo: '15',
        researchAssistantNo: '002/B1',
        name: 'River Sand, Pit Sand',
        type: ['Sand'],
        location: {
          name: 'Ngeyeni',
          latitude: -3.941273,
          longitude: 39.416759,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🏖️'
      },
      {
        id: '16',
        questionnaireNo: '16',
        researchAssistantNo: '002/B1',
        name: 'River Sand, Pit Sand',
        type: ['Sand'],
        location: {
          name: 'Maweu river',
          latitude: -3.945935,
          longitude: 39.45409,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🏖️'
      },
      {
        id: '17',
        questionnaireNo: '17',
        researchAssistantNo: '002/B1',
        name: 'Ballast, Hardcore blocks, Maram',
        type: ['Ballast', 'Blocks', 'Maram'],
        location: {
          name: 'Mdume, kafuduni',
          latitude: -3.911902,
          longitude: 39.506902,
          county: 'Mombasa',
          subCounty: 'Kisauni',
          ward: 'Mji Wa Kale'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '⛰️'
      },
      {
        id: '18',
        questionnaireNo: '18',
        researchAssistantNo: '002/B1',
        name: 'Hardcore Blocks, Hardcore rocks',
        type: ['Blocks', 'Rocks'],
        location: {
          name: 'Mlola B',
          latitude: -3.854295,
          longitude: 39.401202,
          county: 'Kilifi',
          subCounty: 'Kilifi North',
          ward: 'Tezo'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🧱'
      },
      {
        id: '19',
        questionnaireNo: '19',
        researchAssistantNo: '002/B1',
        name: 'Hardcore blocks, Small hardcore rocks, Kokoto, Galana',
        type: ['Blocks', 'Rocks', 'Kokoto', 'Galana'],
        location: {
          name: 'Julani',
          latitude: -3.834985,
          longitude: 39.374405,
          county: 'Kilifi',
          subCounty: 'Kilifi North',
          ward: 'Tezo'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🧱'
      },
      {
        id: '20',
        questionnaireNo: '20',
        researchAssistantNo: '002/B1',
        name: 'River Sand, Pit Sand, Hardcore blocks',
        type: ['Sand', 'Blocks'],
        location: {
          name: 'Lutsangami, Matumbi',
          latitude: -3.925768,
          longitude: 39.392367,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🏖️'
      },
      {
        id: '21',
        questionnaireNo: '21',
        researchAssistantNo: '002/B1',
        name: 'River Sand, Pit Sand',
        type: ['Sand'],
        location: {
          name: 'Vitsaka Viri',
          latitude: -3.930928,
          longitude: 39.417397,
          county: 'Kilifi',
          subCounty: 'Kilifi South',
          ward: 'Mtwapa'
        },
        challenges: [],
        recommendations: [],
        timestamp: new Date().toISOString(),
        icon: '🏖️'
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

    // Ensure all materials have icons
    return mockData.map(material => ({
      ...material,
      icon: material.icon || this.getMaterialIcon(material.type)
    }));
  }

  private addMarkersToMap(): void {
    if (!this.map) {
      console.log('Map not ready yet, skipping marker addition');
      return;
    }

    this.markers.forEach(marker => this.map!.removeLayer(marker));
    this.markers = [];

    const materials = this.filteredMaterials();
    
    console.log('Adding markers for materials:', materials.length);
    
    if (materials.length === 0) {
      console.log('No materials to display');
      return;
    }

    materials.forEach(material => {
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
    });

    if (this.markers.length > 0) {
      const group = new L.FeatureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.1));
      console.log('Map fitted to markers');
    }
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
        <p><strong>Types:</strong> ${material.type.join(', ')}</p>
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
    this.tryLoadFromAPI();
  }
}
/*import { Component, OnInit, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { MaterialService } from '../../services/material.service';
import { Material } from '../../models/material.model';
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
  
  // Using signals for reactive state management
  materials = signal<Material[]>([]);
  filteredMaterials = signal<Material[]>([]);
  selectedMaterial = signal<Material | null>(null);
  isLoading = signal(true);
  hasError = signal(false);
  
  filters = signal({
    type: '',
    region: '',
    quality: '',
    availability: ''
  });

  ngOnInit() {
    this.loadMaterials();
  }

  ngAfterViewInit() {
    this.initMap();
  }

  private initMap(): void {
    this.map = L.map('map', {
      center: [-1.2921, 36.8219], // Nairobi coordinates
      zoom: 6,
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
  }

  private loadMaterials(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    
    this.materialService.getMaterials().subscribe({
      next: (materials) => {
        this.materials.set(materials);
        this.filteredMaterials.set(materials);
        this.addMarkersToMap();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading materials:', error);
        this.materials.set([]);
        this.filteredMaterials.set([]);
        this.hasError.set(true);
        this.isLoading.set(false);
        // Just show the Kenyan map without any markers
      }
    });
  }

  private addMarkersToMap(): void {
    if (!this.map) return;

    // Clear existing markers
    this.markers.forEach(marker => this.map!.removeLayer(marker));
    this.markers = [];

    const materials = this.filteredMaterials();
    
    // Only add markers if we have materials
    if (materials.length === 0) {
      return;
    }

    materials.forEach(material => {
      const markerColor = this.getMarkerColor(material);
      
      const marker = L.marker([material.location.latitude, material.location.longitude], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: this.createMarkerHtml(markerColor),
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        })
      });

      marker.bindPopup(this.createPopupContent(material));
      marker.addTo(this.map!);
      
      marker.on('click', () => {
        this.selectedMaterial.set(material);
      });

      this.markers.push(marker);
    });

    // Fit map to show all markers only if we have markers
    if (this.markers.length > 0) {
      const group = new L.FeatureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  private getMarkerColor(material: Material): string {
    switch (material.specifications.quality) {
      case 'High': return GovernmentColors.kenyaGreen;
      case 'Medium': return GovernmentColors.kbrcBlue;
      case 'Low': return GovernmentColors.kenyaRed;
      default: return GovernmentColors.kbrcGray;
    }
  }

  private createMarkerHtml(color: string): string {
    return `
      <div style="
        background-color: ${color};
        width: 25px;
        height: 25px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `;
  }

  private createPopupContent(material: Material): string {
    return `
      <div style="min-width: 250px;">
        <h3 style="margin: 0 0 10px 0; color: ${GovernmentColors.kbrcDarkBlue};">${material.name}</h3>
        <p><strong>Type:</strong> ${material.type}</p>
        <p><strong>Location:</strong> ${material.location.address}, ${material.location.county}</p>
        <p><strong>Quality:</strong> <span style="color: ${this.getMarkerColor(material)}">${material.specifications.quality}</span></p>
        <p><strong>Price:</strong> ${material.pricing.currency} ${material.pricing.price} per ${material.pricing.unit}</p>
        <p><strong>Availability:</strong> ${material.availability.status}</p>
      </div>
    `;
  }

  applyFilters(): void {
    const currentFilters = this.filters();
    const allMaterials = this.materials();

    const filtered = allMaterials.filter(material => {
      return (
        (!currentFilters.type || material.type === currentFilters.type) &&
        (!currentFilters.region || material.location.region === currentFilters.region) &&
        (!currentFilters.quality || material.specifications.quality === currentFilters.quality) &&
        (!currentFilters.availability || material.availability.status === currentFilters.availability)
      );
    });

    this.filteredMaterials.set(filtered);
    this.addMarkersToMap();
  }

  clearFilters(): void {
    this.filters.set({ type: '', region: '', quality: '', availability: '' });
    this.filteredMaterials.set(this.materials());
    this.addMarkersToMap();
  }

  onFilterChange(filterType: 'type' | 'region' | 'quality' | 'availability', value: string): void {
    this.filters.update(filters => ({
      ...filters,
      [filterType]: value
    }));
  }

  retryLoadMaterials(): void {
    this.loadMaterials();
  }
}*/