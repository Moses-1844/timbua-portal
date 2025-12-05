import { Component, OnInit, ViewChild, OnDestroy, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MaterialService } from './material.service';

// Fix for Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface CountyData {
  name: string;
  coordinates: { lat: number; lng: number };
  subCounties: Array<{
    name: string;
    coordinates: { lat: number; lng: number };
  }>;
}

interface MaterialSiteForm {
  id: number;
  material: string;
  materialLocation: string;
  latitude: number;
  longitude: number;
  materialUsedIn?: string;
  sizeOfManufacturingIndustry?: string;
  periodOfManufacture?: string;
  ownerOfMaterial: string;
  materialUsage?: string;
  numberOfPeopleEmployed?: string;
  volumeProducedPerDay?: string;
  comments?: string;
  county: string;
  subCounty?: string;
  siteName: string;
  materialCategory: string;
  description?: string;
  capacity: {
    total: number;
    available: number;
    unit: string;
  };
  pricing: {
    pricePerUnit: number;
    currency: string;
    unit: string;
    minOrder: number;
  };
  contact: string;
  deliveryTime?: string;
}

@Component({
  selector: 'app-add-site',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-site.html',
  styleUrls: ['./add-site.scss']
})
export class AddMaterial implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('materialForm') materialForm!: NgForm;
  @ViewChild('mapPreviewContainer', { static: false }) mapPreviewContainer!: ElementRef;
  @ViewChild('modalMapContainer', { static: false }) modalMapContainer!: ElementRef;
  @ViewChild('locationSearch') locationSearch!: ElementRef;

  // Map variables
  private map: L.Map | null = null;
  public previewMap: L.Map | null = null;
  private marker: L.Marker | null = null;
  private previewMarker: L.Marker | null = null;
  public mapInitialized = false;
  private destroy$ = new Subject<void>();
  
  // Location search variables
  searchQuery = '';
  searchResults: any[] = [];
  showSearchResults = false;
  isSearching = false;
  currentLocationName = '';
  
  // County data
  counties: CountyData[] = [];
  filteredCounties: CountyData[] = [];
  availableSubCounties: Array<{name: string, coordinates: {lat: number, lng: number}}> = [];
  
  // Map modal
  showMapModal = false;
  mapCoordinates = { lat: -1.286389, lng: 36.817223 };

  materialSite: MaterialSiteForm = {
    id: 0,
    material: '',
    materialLocation: '',
    latitude: 0,
    longitude: 0,
    materialUsedIn: '',
    sizeOfManufacturingIndustry: '',
    periodOfManufacture: '',
    ownerOfMaterial: '',
    materialUsage: '',
    numberOfPeopleEmployed: '',
    volumeProducedPerDay: '',
    comments: '',
    county: '',
    subCounty: '',
    siteName: '',
    materialCategory: '',
    description: '',
    capacity: {
      total: 0,
      available: 0,
      unit: 'ton'
    },
    pricing: {
      pricePerUnit: 0,
      currency: 'KSH',
      unit: '',
      minOrder: 0
    },
    contact: '',
    deliveryTime: ''
  };

  kenyanCounties = [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 
    'Machakos', 'Meru', 'Kiambu', 'Kilifi', 'Garissa', 'Kakamega',
    'Kisii', 'Nyeri', 'Embu', 'Narok', 'Kericho', 'Bungoma',
    'Busia', 'Homa Bay', 'Kajiado', 'Kirinyaga', 'Kitui',
    'Laikipia', 'Lamu', 'Mandera', 'Marsabit', 'Migori', 'Muranga',
    'Nyamira', 'Nyandarua', 'Nandi', 'Samburu', 'Siaya', 'Taita Taveta',
    'Tana River', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'
  ];

  materialCategories = [
    'Cement & Concrete',
    'Steel & Metal',
    'Wood & Timber',
    'Electrical',
    'Plumbing',
    'Finishing',
    'Tools & Equipment',
    'Other'
  ];

  unitTypes = ['ton', 'm3', 'kg', 'bag', 'piece', 'roll', 'sheet', 'lorry', 'unit'];
  deliveryTimes = ['1-2 days', '2-3 days', '3-5 days', '5-7 days', 'immediate'];
  industrySizes = ['Small', 'Medium', 'Large', 'Very Large'];
  periodsOfManufacture = ['Less than 1 year', '1-5 years', '5-10 years', '10+ years'];

  showMapPreview = false;
  isSubmitting = false;
  showDebug = false;
  errorMessage: string | undefined;

  constructor(
    private materialService: MaterialService,
    private router: Router,
    private http: HttpClient // Added HttpClient
  ) {}

  ngOnInit() {
    this.initializeForm();
    this.loadSupplierData();
    this.loadCountiesData();
  }

  ngAfterViewInit() {
    if (this.materialSite.latitude !== 0 && this.materialSite.longitude !== 0) {
      setTimeout(() => {
        this.initPreviewMap();
      }, 500);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyMap();
    this.destroyPreviewMap();
  }

  initializeForm() {
    this.materialSite.pricing.currency = 'KSH';
  }

  loadSupplierData() {
    try {
      const userData = localStorage.getItem('currentUser') || localStorage.getItem('supplier');
      if (userData) {
        const user = JSON.parse(userData);
        this.materialSite.ownerOfMaterial = user.companyName || user.supplierName || '';
        this.materialSite.contact = user.phone || user.contact || '';
      }
    } catch (error) {
      console.error('Error loading supplier from storage:', error);
    }
  }

  loadCountiesData(): void {
    // First try to load from assets
    this.http.get<CountyData[]>('/counties-data.json').subscribe({
      next: (counties) => {
        this.counties = counties;
        this.filteredCounties = [...counties];
        console.log('Counties data loaded successfully:', counties.length, 'counties loaded');
      },
      error: (error) => {
        console.error('Error loading counties data:', error);
        this.errorMessage = 'Failed to load counties data. Using default data.';
        this.counties = this.getDefaultCountiesData();
        this.filteredCounties = [...this.counties];
        setTimeout(() => {
          this.errorMessage = undefined;
        }, 5000);
      }
    });
  }

  getDefaultCountiesData(): CountyData[] {
    return [
      {
        name: 'Nairobi',
        coordinates: { lat: -1.286389, lng: 36.817223 },
        subCounties: [
          { name: 'Westlands', coordinates: { lat: -1.2645, lng: 36.8036 } },
          { name: 'Langata', coordinates: { lat: -1.3616, lng: 36.7838 } },
          { name: 'Dagoretti', coordinates: { lat: -1.2847, lng: 36.7528 } },
          { name: 'Embakasi', coordinates: { lat: -1.3076, lng: 36.9012 } },
          { name: 'Kasarani', coordinates: { lat: -1.2142, lng: 36.8992 } }
        ]
      },
      {
        name: 'Mombasa',
        coordinates: { lat: -4.0435, lng: 39.6682 },
        subCounties: [
          { name: 'Mvita', coordinates: { lat: -4.0552, lng: 39.6634 } },
          { name: 'Changamwe', coordinates: { lat: -4.0332, lng: 39.6253 } },
          { name: 'Kisauni', coordinates: { lat: -4.0216, lng: 39.6951 } },
          { name: 'Likoni', coordinates: { lat: -4.0899, lng: 39.6600 } }
        ]
      },
      {
        name: 'Kisumu',
        coordinates: { lat: -0.1022, lng: 34.7617 },
        subCounties: [
          { name: 'Kisumu Central', coordinates: { lat: -0.1022, lng: 34.7617 } },
          { name: 'Kisumu East', coordinates: { lat: -0.0868, lng: 34.7825 } },
          { name: 'Kisumu West', coordinates: { lat: -0.1568, lng: 34.7466 } }
        ]
      },
      {
        name: 'Nakuru',
        coordinates: { lat: -0.3031, lng: 36.0800 },
        subCounties: [
          { name: 'Nakuru Town East', coordinates: { lat: -0.3031, lng: 36.0800 } },
          { name: 'Nakuru Town West', coordinates: { lat: -0.2960, lng: 36.0550 } },
          { name: 'Naivasha', coordinates: { lat: -0.7176, lng: 36.4310 } }
        ]
      }
    ];
  }

  onCountyChange(): void {
    if (this.materialSite.county) {
      const selectedCounty = this.counties.find(c => c.name === this.materialSite.county);
      this.availableSubCounties = selectedCounty ? selectedCounty.subCounties : [];
      
      if (selectedCounty) {
        this.mapCoordinates = { ...selectedCounty.coordinates };
        this.materialSite.latitude = this.mapCoordinates.lat;
        this.materialSite.longitude = this.mapCoordinates.lng;
        
        if (this.map) {
          this.updateMapMarker(this.mapCoordinates.lat, this.mapCoordinates.lng);
        }
        if (this.previewMap) {
          this.updatePreviewMap(this.mapCoordinates.lat, this.mapCoordinates.lng);
        }
        
        this.reverseGeocode(this.mapCoordinates.lat, this.mapCoordinates.lng);
      }
    } else {
      this.availableSubCounties = [];
    }
    this.materialSite.subCounty = '';
  }

  onSubCountyChange(): void {
    if (this.materialSite.county && this.materialSite.subCounty) {
      const selectedCounty = this.counties.find(c => c.name === this.materialSite.county);
      if (selectedCounty) {
        const selectedSubCounty = selectedCounty.subCounties.find(sc => sc.name === this.materialSite.subCounty);
        if (selectedSubCounty) {
          this.materialSite.latitude = selectedSubCounty.coordinates.lat;
          this.materialSite.longitude = selectedSubCounty.coordinates.lng;
          this.mapCoordinates = { ...selectedSubCounty.coordinates };
          
          if (this.map) {
            this.updateMapMarker(this.mapCoordinates.lat, this.mapCoordinates.lng);
          }
          if (this.previewMap) {
            this.updatePreviewMap(this.mapCoordinates.lat, this.mapCoordinates.lng);
          }
          
          this.reverseGeocode(this.mapCoordinates.lat, this.mapCoordinates.lng);
        }
      }
    }
  }

  openMapModal(): void {
    this.showMapModal = true;
    setTimeout(() => {
      this.initMap();
    }, 100);
  }

  closeMapModal(): void {
    this.showMapModal = false;
    this.destroyMap();
  }

  private initMap(): void {
    if (this.mapInitialized && this.map) {
      return;
    }

    try {
      const container = this.modalMapContainer?.nativeElement;
      if (!container) {
        console.error('Modal map container not found');
        return;
      }

      this.map = L.map(container).setView(
        [this.mapCoordinates.lat, this.mapCoordinates.lng], 
        13
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      const customIcon = L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      this.marker = L.marker([this.mapCoordinates.lat, this.mapCoordinates.lng], { 
        icon: customIcon,
        draggable: true 
      })
        .addTo(this.map)
        .bindPopup('Drag to adjust location')
        .openPopup();

      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.onMapClick(e);
      });

      this.marker.on('dragend', (e: L.LeafletEvent) => {
        const marker = e.target as L.Marker;
        const position = marker.getLatLng();
        this.updateCoordinates(position.lat, position.lng);
      });

      this.addSearchControl();
      this.mapInitialized = true;
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private initPreviewMap(): void {
    try {
      const container = this.mapPreviewContainer?.nativeElement;
      if (!container) {
        return;
      }

      if (this.previewMap) {
        this.previewMap.remove();
        this.previewMap = null;
      }

      this.previewMap = L.map(container).setView(
        [this.materialSite.latitude, this.materialSite.longitude], 
        13
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.previewMap);

      const customIcon = L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      this.previewMarker = L.marker([this.materialSite.latitude, this.materialSite.longitude], { 
        icon: customIcon
      })
        .addTo(this.previewMap)
        .bindPopup('Selected Location')
        .openPopup();

      this.previewMap.dragging.disable();
      this.previewMap.touchZoom.disable();
      this.previewMap.doubleClickZoom.disable();
      this.previewMap.scrollWheelZoom.disable();
      this.previewMap.boxZoom.disable();
      this.previewMap.keyboard.disable();
    } catch (error) {
      console.error('Error initializing preview map:', error);
    }
  }

  private addSearchControl(): void {
    if (!this.map) return;

    const searchContainer = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    searchContainer.style.cssText = 'background: white; padding: 10px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
    
    searchContainer.innerHTML = `
      <div style="display: flex; gap: 5px;">
        <input type="text" 
               id="mapSearchInput"
               placeholder="Search for location..." 
               style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
        <button id="mapSearchBtn" 
                style="padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
          <i class="fas fa-search" style="margin-right: 5px;"></i>Search
        </button>
      </div>
    `;

    const input = searchContainer.querySelector('#mapSearchInput') as HTMLInputElement;
    const button = searchContainer.querySelector('#mapSearchBtn') as HTMLButtonElement;
    
    button.onclick = () => this.searchOnMap(input.value);
    input.onkeypress = (e) => {
      if (e.key === 'Enter') this.searchOnMap(input.value);
    };

    const SearchControl = L.Control.extend({
      onAdd: () => searchContainer,
      onRemove: () => {}
    });

    this.map.addControl(new SearchControl({ position: 'topright' }));
  }

  async searchOnMap(query: string): Promise<void> {
    if (!query.trim() || !this.map) return;

    this.isSearching = true;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Kenya')}&limit=5`
      );
      const results = await response.json();
      
      if (results.length > 0) {
        const firstResult = results[0];
        const lat = parseFloat(firstResult.lat);
        const lng = parseFloat(firstResult.lon);
        
        this.updateCoordinates(lat, lng);
        this.map.setView([lat, lng], 15);
        this.materialSite.materialLocation = firstResult.display_name.split(',')[0];
        this.currentLocationName = firstResult.display_name;
        this.determineCountyFromLocation(lat, lng);
      } else {
        alert('Location not found. Please try a different search term.');
      }
    } catch (error) {
      console.error('Error searching location:', error);
      alert('Error searching location. Please try again.');
    } finally {
      this.isSearching = false;
    }
  }

  private determineCountyFromLocation(lat: number, lng: number): void {
    let nearestCounty = '';
    let minDistance = Infinity;
    
    for (const county of this.counties) {
      const distance = this.calculateDistance(
        lat, lng, 
        county.coordinates.lat, county.coordinates.lng
      );
      
      if (distance < minDistance && distance < 100) {
        minDistance = distance;
        nearestCounty = county.name;
      }
    }
    
    if (nearestCounty) {
      this.materialSite.county = nearestCounty;
      this.onCountyChange();
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI/180);
  }

  private onMapClick(e: L.LeafletMouseEvent): void {
    this.updateCoordinates(e.latlng.lat, e.latlng.lng);
  }

  private updateCoordinates(lat: number, lng: number): void {
    this.materialSite.latitude = parseFloat(lat.toFixed(6));
    this.materialSite.longitude = parseFloat(lng.toFixed(6));
    this.mapCoordinates = { lat: this.materialSite.latitude, lng: this.materialSite.longitude };
    
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
      this.marker.bindPopup(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}<br>Drag to adjust`).openPopup();
    }
    
    if (this.previewMap && this.previewMarker) {
      this.previewMap.setView([lat, lng], 13);
      this.previewMarker.setLatLng([lat, lng]);
      this.previewMarker.bindPopup(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`).openPopup();
    }
    
    this.reverseGeocode(lat, lng);
    this.showMapPreview = true;
  }

  private updateMapMarker(lat: number, lng: number): void {
    if (this.map && this.marker) {
      this.map.setView([lat, lng], 13);
      this.marker.setLatLng([lat, lng]);
      this.marker.bindPopup(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}<br>Drag to adjust`).openPopup();
    }
  }

  private updatePreviewMap(lat: number, lng: number): void {
    if (this.previewMap && this.previewMarker) {
      this.previewMap.setView([lat, lng], 13);
      this.previewMarker.setLatLng([lat, lng]);
      this.previewMarker.bindPopup(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`).openPopup();
    }
  }

  private async reverseGeocode(lat: number, lng: number): Promise<void> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      if (data.display_name) {
        this.currentLocationName = data.display_name;
        
        if (!this.materialSite.materialLocation && data.address) {
          this.materialSite.materialLocation = 
            data.address.road || 
            data.address.village || 
            data.address.town || 
            data.address.city || 
            'Unknown Location';
        }
        
        if (data.address && data.address.county) {
          const countyName = data.address.county.replace(' County', '');
          if (this.kenyanCounties.includes(countyName)) {
            this.materialSite.county = countyName;
            this.onCountyChange();
          }
        }
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  }

  useCurrentLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = parseFloat(position.coords.latitude.toFixed(6));
          const lng = parseFloat(position.coords.longitude.toFixed(6));
          
          this.updateCoordinates(lat, lng);
          
          if (!this.showMapModal) {
            this.openMapModal();
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get current location. Please enable location services or enter coordinates manually.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      alert('Geolocation is not supported by this browser. Please enter coordinates manually.');
    }
  }

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.marker = null;
      this.mapInitialized = false;
    }
  }

  private destroyPreviewMap(): void {
    if (this.previewMap) {
      this.previewMap.remove();
      this.previewMap = null;
      this.previewMarker = null;
    }
  }

  filterCounties(searchTerm: string): void {
    if (!searchTerm.trim()) {
      this.filteredCounties = [...this.counties];
      return;
    }
    
    const term = searchTerm.toLowerCase();
    this.filteredCounties = this.counties.filter(county => 
      county.name.toLowerCase().includes(term) ||
      county.subCounties.some(sub => sub.name.toLowerCase().includes(term))
    );
  }

  selectLocation(county: CountyData, subCounty?: any): void {
    if (subCounty) {
      this.materialSite.county = county.name;
      this.materialSite.subCounty = subCounty.name;
      this.onSubCountyChange();
    } else {
      this.materialSite.county = county.name;
      this.onCountyChange();
    }
    
    this.showSearchResults = false;
    this.searchQuery = '';
    this.openMapModal();
  }

  onCoordinatesChange(): void {
    if (this.materialSite.latitude !== 0 && this.materialSite.longitude !== 0) {
      this.mapCoordinates = {
        lat: this.materialSite.latitude,
        lng: this.materialSite.longitude
      };
      this.showMapPreview = true;
      
      if (this.map) {
        this.updateMapMarker(this.materialSite.latitude, this.materialSite.longitude);
      }
      
      setTimeout(() => {
        if (this.previewMap) {
          this.updatePreviewMap(this.materialSite.latitude, this.materialSite.longitude);
        } else {
          this.initPreviewMap();
        }
      }, 100);
      
      this.reverseGeocode(this.materialSite.latitude, this.materialSite.longitude);
    }
  }

  validateForm(): boolean {
    const errors: string[] = [];

    if (!this.materialSite.siteName?.trim()) {
      errors.push('Site Name is required');
    }
    if (!this.materialSite.materialCategory) {
      errors.push('Material Category is required');
    }
    if (this.materialSite.pricing.pricePerUnit <= 0 || isNaN(this.materialSite.pricing.pricePerUnit)) {
      errors.push('Valid Price per Unit is required');
    }
    if (!this.materialSite.pricing.currency) {
      errors.push('Currency is required');
    }
    if (!this.materialSite.pricing.unit) {
      errors.push('Unit is required');
    }
    if (!this.materialSite.county) {
      errors.push('County is required');
    }
    if (!this.materialSite.materialLocation?.trim()) {
      errors.push('Location is required');
    }
    if (this.materialSite.latitude === 0 || this.materialSite.longitude === 0 || 
        isNaN(this.materialSite.latitude) || isNaN(this.materialSite.longitude)) {
      errors.push('Valid coordinates are required');
    }
    if (!this.materialSite.ownerOfMaterial?.trim()) {
      errors.push('Supplier name is required');
    }
    if (!this.materialSite.contact?.trim()) {
      errors.push('Contact phone number is required');
    }
    if (this.materialSite.capacity.total <= 0) {
      errors.push('Valid total capacity is required');
    }

    if (errors.length > 0) {
      alert('Please fix the following errors:\n\n' + errors.join('\n'));
      return false;
    }

    return true;
  }

submitMaterialSite(): void {
  console.log('Submit button clicked');
  
  if (!this.validateForm()) {
    return;
  }

  this.isSubmitting = true;

  // Get supplier ID using material service
  const supplierId = this.materialService.getSupplierId();
  
  if (!supplierId) {
    this.isSubmitting = false;
    alert('Unable to identify supplier. Please login again.');
    return;
  }

  // Prepare data EXACTLY as per Swagger API schema
  const now = new Date().toISOString();
  
  // Convert to string format exactly as Swagger shows
  const deliveryTimeStr = 'string'; // Use literal string as shown in Swagger
  
  const materialData = {
    id: 0, // API will generate the actual ID
    name: this.materialSite.siteName || this.materialSite.material,
    category: this.materialSite.materialCategory,
    price: Number(this.materialSite.pricing.pricePerUnit),
    currency: this.materialSite.pricing.currency,
    unit: this.materialSite.pricing.unit,
    location: this.materialSite.materialLocation,
    rating: 0, // Default value as per schema
    contact: this.materialSite.contact,
    deliveryTime: deliveryTimeStr, // Use literal string
    minOrder: Number(this.materialSite.pricing.minOrder || 0),
    available: true,
    supplierLat: Number(this.materialSite.latitude),
    supplierLng: Number(this.materialSite.longitude),
    createdAt: now, // Required field
    updatedAt: now  // Required field
  };

  console.log('📝 Material Data Prepared:', JSON.stringify(materialData, null, 2));

  // Use MaterialService to add material
  this.materialService.addMaterial(supplierId, materialData).subscribe({
    next: (response) => {
      this.isSubmitting = false;
      console.log('✅ Material added successfully:', response);
      
      if (response && response.message) {
        alert(`Success: ${response.message}`);
      } else {
        alert('Material added successfully!');
      }
      
      this.router.navigate(['/supplier-dashboard/inventory']);
    },
    error: (error) => {
      this.isSubmitting = false;
      console.error('❌ Error adding material:', error);
      
      let errorMessage = 'Error adding material. Please check: \n' +
          '1. All fields are filled correctly\n' +
          '2. Numeric fields contain valid numbers\n' +
          '3. Date fields are in ISO format\n' +
          `\nServer responded with: ${error.status}`;
      
      // Try to get server error details
      if (error.error) {
        try {
          const errorObj = typeof error.error === 'string' ? JSON.parse(error.error) : error.error;
          console.log('🔍 Server error details:', errorObj);
          
          if (errorObj.message) {
            errorMessage += `\n\nServer message: ${errorObj.message}`;
          }
          if (errorObj.errors) {
            errorMessage += `\n\nValidation errors: ${JSON.stringify(errorObj.errors, null, 2)}`;
          }
          if (errorObj.error) {
            errorMessage += `\n\nError: ${errorObj.error}`;
          }
        } catch (e) {
          console.log('🔍 Raw error response:', error.error);
          errorMessage += `\n\nRaw error: ${JSON.stringify(error.error)}`;
        }
      }
      
      alert(errorMessage);
    }
  });
}

testApiDirectly(): void {
  const supplierId = this.materialService.getSupplierId();
  if (!supplierId) {
    alert('No supplier ID found');
    return;
  }

  const now = new Date().toISOString();
  // Exact test payload matching Swagger schema - using literal strings
  const testData = {
    id: 0,
    name: 'Test Cement',
    category: 'Cement & Concrete',
    price: 1000,
    currency: 'KSH',
    unit: 'bag',
    location: 'Nairobi Industrial Area',
    rating: 0,
    contact: '+254712345678',
    deliveryTime: 'string', // Use literal string as in Swagger
    minOrder: 1,
    available: true,
    supplierLat: 0, // Try with 0 as in Swagger
    supplierLng: 0, // Try with 0 as in Swagger
    createdAt: now,
    updatedAt: now
  };

  console.log('🧪 Testing API with exact Swagger schema:', testData);
  console.log('🧪 JSON String:', JSON.stringify(testData));

  this.materialService.addMaterial(supplierId, testData).subscribe({
    next: (response) => {
      console.log('✅ Test successful:', response);
      alert(`API test successful!\n\nMessage: ${response.message}\nMaterial ID: ${response.data?.id}`);
    },
    error: (error) => {
      console.error('❌ Test failed:', error);
      
      let errorDetails = `Status: ${error.status}\n`;
      if (error.error) {
        try {
          const errorObj = typeof error.error === 'string' ? JSON.parse(error.error) : error.error;
          errorDetails += `Error: ${JSON.stringify(errorObj, null, 2)}`;
        } catch (e) {
          errorDetails += `Error: ${error.error}`;
        }
      }
      
      alert('API test failed:\n\n' + errorDetails);
    }
  });
}

  logFormData(): void {
    console.log('📋 Current Form Data:');
    console.log('Form Valid:', this.materialForm?.valid || false);
    console.log('Form Values:', JSON.stringify(this.materialSite, null, 2));
    
    // Show in alert too
    const summary = `
Site Name: ${this.materialSite.siteName}
Category: ${this.materialSite.materialCategory}
Material: ${this.materialSite.material}
Price: ${this.materialSite.pricing.pricePerUnit} ${this.materialSite.pricing.currency}
Unit: ${this.materialSite.pricing.unit}
Location: ${this.materialSite.materialLocation}
Contact: ${this.materialSite.contact}
Coordinates: ${this.materialSite.latitude}, ${this.materialSite.longitude}
Supplier: ${this.materialSite.ownerOfMaterial}
    `.trim();
    
    alert('Current Form Data:\n\n' + summary);
  }

  cancel(): void {
    if (confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
      this.router.navigate(['/supplier-dashboard']);
    }
  }

  resetForm(): void {
    if (confirm('Reset form? All entered data will be lost.')) {
      this.materialSite = {
        id: 0,
        material: '',
        materialLocation: '',
        latitude: 0,
        longitude: 0,
        materialUsedIn: '',
        sizeOfManufacturingIndustry: '',
        periodOfManufacture: '',
        ownerOfMaterial: this.materialSite.ownerOfMaterial,
        materialUsage: '',
        numberOfPeopleEmployed: '',
        volumeProducedPerDay: '',
        comments: '',
        county: '',
        subCounty: '',
        siteName: '',
        materialCategory: '',
        description: '',
        capacity: {
          total: 0,
          available: 0,
          unit: 'ton'
        },
        pricing: {
          pricePerUnit: 0,
          currency: 'KSH',
          unit: '',
          minOrder: 0
        },
        contact: this.materialSite.contact,
        deliveryTime: ''
      };
      this.showMapPreview = false;
      this.currentLocationName = '';
      this.destroyPreviewMap();
      
      if (this.materialForm) {
        this.materialForm.resetForm();
      }
    }
  }

  onTotalCapacityChange(): void {
    if (this.materialSite.capacity!.available > this.materialSite.capacity!.total) {
      this.materialSite.capacity!.available = this.materialSite.capacity!.total;
    }
  }

  getUnitLabel(unit: string): string {
    const labels: { [key: string]: string } = {
      'ton': 'Ton',
      'm3': 'Cubic Meter',
      'kg': 'Kilogram',
      'bag': 'Bag',
      'piece': 'Piece',
      'roll': 'Roll',
      'sheet': 'Sheet',
      'lorry': 'Lorry',
      'unit': 'Unit'
    };
    return labels[unit] || unit;
  }
  testDifferentFormats(): void {
  const supplierId = this.materialService.getSupplierId();
  if (!supplierId) {
    alert('No supplier ID found');
    return;
  }

  const now = new Date().toISOString();
  
  // 10 Different test data formats
  const testCases = [
    {
      name: 'Case 1: Exact Swagger Example',
      data: {
        id: 0,
        name: "string",
        category: "string",
        price: 0,
        currency: "string",
        unit: "string",
        location: "string",
        rating: 0,
        contact: "string",
        deliveryTime: "string",
        minOrder: 0,
        available: true,
        supplierLat: 0,
        supplierLng: 0,
        createdAt: "2025-12-04T19:53:33.720Z",
        updatedAt: "2025-12-04T19:53:33.720Z"
      }
    },
    {
      name: 'Case 2: Real Values with String Dates',
      data: {
        id: 0,
        name: "Portland Cement",
        category: "Cement & Concrete",
        price: 850,
        currency: "KSH",
        unit: "bag",
        location: "Nairobi Industrial Area",
        rating: 0,
        contact: "+254712345678",
        deliveryTime: "string",
        minOrder: 10,
        available: true,
        supplierLat: -1.286389,
        supplierLng: 36.817223,
        createdAt: "2025-12-04T19:53:33.720Z",
        updatedAt: "2025-12-04T19:53:33.720Z"
      }
    },
    {
      name: 'Case 3: Real Values with Current Dates',
      data: {
        id: 0,
        name: "Steel Bars",
        category: "Steel & Metal",
        price: 15000,
        currency: "KSH",
        unit: "ton",
        location: "Mombasa Road",
        rating: 0,
        contact: "+254712345678",
        deliveryTime: "3-5 days",
        minOrder: 0.5,
        available: true,
        supplierLat: 0,
        supplierLng: 0,
        createdAt: now,
        updatedAt: now
      }
    },
    {
      name: 'Case 4: Minimal Required Fields Only',
      data: {
        id: 0,
        name: "Test Material",
        category: "Other",
        price: 1,
        currency: "KSH",
        unit: "unit",
        location: "Test",
        rating: 0,
        contact: "+254700000000",
        deliveryTime: "string",
        minOrder: 1,
        available: true,
        supplierLat: 0,
        supplierLng: 0,
        createdAt: now,
        updatedAt: now
      }
    },
    {
      name: 'Case 5: Without id field',
      data: {
        name: "Sand",
        category: "Aggregates",
        price: 2000,
        currency: "KSH",
        unit: "lorry",
        location: "Kiambu Road",
        rating: 0,
        contact: "+254712345678",
        deliveryTime: "string",
        minOrder: 1,
        available: true,
        supplierLat: -1.1734,
        supplierLng: 36.8357,
        createdAt: now,
        updatedAt: now
      }
    },
    {
      name: 'Case 6: Without createdAt/updatedAt',
      data: {
        id: 0,
        name: "Crushed Stones",
        category: "Aggregates",
        price: 1800,
        currency: "KSH",
        unit: "ton",
        location: "Thika Road",
        rating: 0,
        contact: "+254712345678",
        deliveryTime: "string",
        minOrder: 5,
        available: true,
        supplierLat: -1.0333,
        supplierLng: 37.0833
      }
    },
    {
      name: 'Case 7: Null for Optional Fields',
      data: {
        id: 0,
        name: "Electrical Wires",
        category: "Electrical",
        price: 1500,
        currency: "KSH",
        unit: "roll",
        location: "Eastleigh",
        rating: null,
        contact: "+254712345678",
        deliveryTime: null,
        minOrder: null,
        available: true,
        supplierLat: null,
        supplierLng: null,
        createdAt: now,
        updatedAt: now
      }
    },
    {
      name: 'Case 8: String Numbers',
      data: {
        id: "0",
        name: "PVC Pipes",
        category: "Plumbing",
        price: "500",
        currency: "KSH",
        unit: "piece",
        location: "Industrial Area",
        rating: "0",
        contact: "+254712345678",
        deliveryTime: "string",
        minOrder: "10",
        available: "true",
        supplierLat: "0",
        supplierLng: "0",
        createdAt: now,
        updatedAt: now
      }
    },
    {
      name: 'Case 9: Empty Strings',
      data: {
        id: 0,
        name: "",
        category: "",
        price: 0,
        currency: "",
        unit: "",
        location: "",
        rating: 0,
        contact: "",
        deliveryTime: "",
        minOrder: 0,
        available: true,
        supplierLat: 0,
        supplierLng: 0,
        createdAt: "",
        updatedAt: ""
      }
    },
    {
      name: 'Case 10: Mixed Types',
      data: {
        id: 0,
        name: "Mixed Test",
        category: "Tools & Equipment",
        price: 25000.50,
        currency: "USD",
        unit: "piece",
        location: "Upper Hill",
        rating: 4.5,
        contact: "+1-234-567-8900",
        deliveryTime: "immediate",
        minOrder: 1.5,
        available: false,
        supplierLat: -1.2921,
        supplierLng: 36.8219,
        createdAt: "2025-12-04T10:30:00.000Z",
        updatedAt: "2025-12-04T10:30:00.000Z"
      }
    }
  ];

  console.log('🧪 Testing 10 different formats...');
  
  // Test each case
  testCases.forEach((testCase, index) => {
    setTimeout(() => {
      console.log(`\n📋 Testing ${testCase.name}:`);
      console.log('📦 Data:', JSON.stringify(testCase.data, null, 2));
      
      this.materialService.addMaterial(supplierId, testCase.data).subscribe({
        next: (response) => {
          console.log(`✅ ${testCase.name}: SUCCESS`);
          console.log('Response:', response);
          alert(`${testCase.name}\n\n✅ SUCCESS!\n\nMaterial ID: ${response.data?.id}`);
        },
        error: (error) => {
          console.error(`❌ ${testCase.name}: FAILED`);
          console.error('Error:', error.message);
          
          // Try to get detailed error
          let errorMsg = error.message;
          if (error.error) {
            try {
              const errorObj = typeof error.error === 'string' ? JSON.parse(error.error) : error.error;
              errorMsg = JSON.stringify(errorObj, null, 2);
            } catch (e) {
              errorMsg = error.error;
            }
          }
          
          console.log(`📝 Error details for ${testCase.name}:`, errorMsg);
          
          // Only show alert for critical failures or successes
          if (index === testCases.length - 1) {
            alert(`All tests completed.\n\nLast test (${testCase.name}) failed:\n\n${errorMsg}`);
          }
        }
      });
    }, index * 2000); // 2 second delay between tests
  });
}
}