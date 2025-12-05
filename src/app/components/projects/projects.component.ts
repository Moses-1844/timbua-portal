import { Component, OnInit, inject, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { SiteAnalysisService } from '../../services/site-analysis.service';

// Leaflet imports
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Update the SiteAnalysisResponse interface in projects.component.ts
interface SiteAnalysisResponse {
  locationAnalysis: {
    addressDetails: any;
    naturalFeatures: any[];
    restrictedAreas?: any[]; // Add this
    terrainAnalysis: string;
    accessibility: string;
    environmentalFactors: string[];
    zoningRestrictions?: string[]; // Add this
  };
  constructionAnalysis: {
    recommendations: string[];
    riskAssessment: string;
    estimatedCost: number;
    timeline: string;
    soilRecommendation: string;
    foundationType: string;
    materials: string[];
    regulatoryConsiderations: string[];
    buildingLimitations?: string[]; // Add this
  };
  aiAnalysis: {
    summary: string;
    keyInsights: string[];
    potentialChallenges: string[];
    opportunities: string[];
  };
  metadata: {
    analyzedAt: string;
    coordinates: { lat: number; lng: number };
    buildingType: string;
    isBuildable?: boolean; // Add this
    restrictionsFound?: number; // Add this
  };
}
interface ConstructionSite {
  id: number;
  name: string;
  location: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  type: string;
  estimatedCost: number;
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  progress: number;
  documents: string[];
  contractorId: number;
  contractor?: {
    id: number;
    companyName: string;
    email: string;
    contactPerson: string;
    phoneNumber: string;
    businessRegistrationNumber: string;
    physicalAddress: string;
    specialization: string;
    yearsOfExperience: number;
    licenseNumber: string;
    status: string;
    role: string;
    isVerified: boolean;
    registrationDate: string;
    verificationDate: string;
  };
}


interface ProjectFormData {
  name: string;
  location: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  type: string;
  estimatedCost: number;
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  progress: number;
  documents: string[];
}

interface CountyData {
  code: number;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  subCounties: SubCountyData[];
}

interface SubCountyData {
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.scss']
})
export class ProjectsComponent implements OnInit, AfterViewInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private siteAnalysisService = inject(SiteAnalysisService);

  projects: ConstructionSite[] = [];
  counties: CountyData[] = [];
  isLoading = true;
  isAddingProject = false;
  isEditingProject = false;
  selectedProject: ConstructionSite | null = null;
  errorMessage = '';
  successMessage = '';
  showMapModal = false;
  isGettingLocation = false;
  siteAnalysis: SiteAnalysisResponse | null = null;
  showAnalysisModal = false;
  isAnalyzingSite = false;
  analysisProgress = 0;
  currentAnalysisStep = '';

  // Leaflet map variables
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private mapInitialized = false;

  // Project types
  projectTypes = [
    'Residential Building',
    'Commercial Building',
    'Road Construction',
    'Bridge Construction',
    'Renovation',
    'Infrastructure',
    'Industrial',
    'Institutional',
    'Other'
  ];

  // Status options
  statusOptions: { value: ConstructionSite['status']; label: string }[] = [
    { value: 'PLANNING', label: 'Planning' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'ON_HOLD', label: 'On Hold' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ];

  // Available sub-counties based on selected county
  availableSubCounties: SubCountyData[] = [];

  // Form data
  projectForm: ProjectFormData = {
    name: '',
    location: '',
    coordinates: {
      lat: 0,
      lng: 0
    },
    type: '',
    estimatedCost: 0,
    status: 'PLANNING',
    startDate: '',
    endDate: '',
    progress: 0,
    documents: []
  };

  // Map coordinates
  mapCoordinates = { lat: -1.2921, lng: 36.8219 }; // Default to Nairobi
  buildingType = 'residential';

  // Date validation
  minStartDate: string = '';
  minEndDate: string = '';

  // Selected sub-county
  selectedSubCounty: string = '';

  ngOnInit() {
    this.loadCountiesData();
    this.loadProjects();
    this.setMinDates();
  }

  ngAfterViewInit() {
    // Map will be initialized when modal opens
  }

  ngOnDestroy() {
    this.destroyMap();
  }

  private loadCountiesData(): void {
    this.http.get<CountyData[]>('/counties-data.json').subscribe({
      next: (counties) => {
        this.counties = counties;
        console.log('Counties data loaded successfully:', counties.length, 'counties loaded');
      },
      error: (error) => {
        console.error('Error loading counties data:', error);
        this.errorMessage = 'Failed to load counties data. Using default data.';
        this.loadDefaultCountiesData();
        this.clearMessageAfterDelay();
      }
    });
  }

  private loadDefaultCountiesData(): void {
    this.counties = [
      {
        code: 1,
        name: 'Mombasa',
        coordinates: { lat: -4.0435, lng: 39.6682 },
        subCounties: [
          { name: 'Changamwe', coordinates: { lat: -4.0333, lng: 39.6167 } },
          { name: 'Jomvu', coordinates: { lat: -4.0667, lng: 39.6667 } },
          { name: 'Kisauni', coordinates: { lat: -4.0000, lng: 39.7000 } },
          { name: 'Nyali', coordinates: { lat: -4.0500, lng: 39.7000 } },
          { name: 'Likoni', coordinates: { lat: -4.1000, lng: 39.6500 } },
          { name: 'Mvita', coordinates: { lat: -4.0500, lng: 39.6667 } }
        ]
      },
      {
        code: 2,
        name: 'Nairobi',
        coordinates: { lat: -1.2921, lng: 36.8219 },
        subCounties: [
          { name: 'Westlands', coordinates: { lat: -1.2583, lng: 36.8061 } },
          { name: 'Dagoretti', coordinates: { lat: -1.2833, lng: 36.7167 } },
          { name: 'Langata', coordinates: { lat: -1.3633, lng: 36.7500 } },
          { name: 'Kibra', coordinates: { lat: -1.3167, lng: 36.7833 } },
          { name: 'Kasarani', coordinates: { lat: -1.2167, lng: 36.8833 } },
          { name: 'Embakasi', coordinates: { lat: -1.3167, lng: 36.9000 } }
        ]
      },
      {
        code: 3,
        name: 'Kisumu',
        coordinates: { lat: -0.1022, lng: 34.7617 },
        subCounties: [
          { name: 'Kisumu Central', coordinates: { lat: -0.1000, lng: 34.7500 } },
          { name: 'Kisumu East', coordinates: { lat: -0.1167, lng: 34.8000 } },
          { name: 'Kisumu West', coordinates: { lat: -0.1500, lng: 34.7000 } },
          { name: 'Seme', coordinates: { lat: -0.0833, lng: 34.5833 } },
          { name: 'Nyando', coordinates: { lat: -0.3333, lng: 35.0000 } },
          { name: 'Muhoroni', coordinates: { lat: -0.1667, lng: 35.2000 } }
        ]
      }
    ];
    console.log('Using default counties data:', this.counties.length, 'counties loaded');
  }

  private setMinDates(): void {
    const today = new Date();
    this.minStartDate = today.toISOString().split('T')[0];
    this.minEndDate = today.toISOString().split('T')[0];
  }

  onStartDateChange(): void {
    if (this.projectForm.startDate) {
      this.minEndDate = this.projectForm.startDate;
      
      if (this.projectForm.endDate && this.projectForm.endDate < this.projectForm.startDate) {
        this.projectForm.endDate = this.projectForm.startDate;
      }
    }
  }

  onEndDateChange(): void {
    // No specific validation needed here as min date is controlled
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getAuthToken();
    if (token) {
      return new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });
    }
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  loadProjects(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const contractorId = this.authService.getCurrentUserId();
    if (!contractorId) {
      this.errorMessage = 'Contractor ID not found. Please log in again.';
      this.isLoading = false;
      return;
    }

    if (!this.authService.isAuthenticated) {
      this.errorMessage = 'Please log in to view your projects.';
      this.isLoading = false;
      return;
    }

    const headers = this.getAuthHeaders();

    this.http.get<ConstructionSite[]>(
      `https://timbuabackend.onrender.com/api/sites/contractor/${contractorId}`,
      { headers }
    ).subscribe({
      next: (projects) => {
        console.log('Projects loaded for contractor:', projects);
        this.projects = projects;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading projects:', error);
        if (error.status === 401 || error.status === 403) {
          this.errorMessage = 'Session expired. Please log in again.';
        } else {
          this.errorMessage = 'Failed to load projects. Please try again.';
        }
        this.isLoading = false;
      }
    });
  }

  // When county changes, update available sub-counties
  onCountyChange(): void {
    if (this.projectForm.location) {
      const selectedCounty = this.counties.find(c => c.name === this.projectForm.location);
      this.availableSubCounties = selectedCounty ? selectedCounty.subCounties : [];
      
      // Reset coordinates when location changes
      this.projectForm.coordinates.lat = 0;
      this.projectForm.coordinates.lng = 0;
      this.selectedSubCounty = '';

      // Update map coordinates to county center if county is selected
      if (selectedCounty) {
        this.mapCoordinates = { ...selectedCounty.coordinates };
        
        // Update map if it's open
        if (this.map) {
          this.updateMapMarker(this.mapCoordinates.lat, this.mapCoordinates.lng);
        }
      }
    } else {
      this.availableSubCounties = [];
      this.selectedSubCounty = '';
    }
  }

  // When sub-county changes, update coordinates
  onSubCountyChange(): void {
    if (this.projectForm.location && this.selectedSubCounty) {
      const selectedCounty = this.counties.find(c => c.name === this.projectForm.location);
      if (selectedCounty) {
        const selectedSubCounty = selectedCounty.subCounties.find(sc => sc.name === this.selectedSubCounty);
        if (selectedSubCounty) {
          // Update form coordinates
          this.projectForm.coordinates.lat = selectedSubCounty.coordinates.lat;
          this.projectForm.coordinates.lng = selectedSubCounty.coordinates.lng;
          
          // Also update map coordinates
          this.mapCoordinates = { ...selectedSubCounty.coordinates };
          
          // Update map if it's open
          if (this.map) {
            this.updateMapMarker(this.mapCoordinates.lat, this.mapCoordinates.lng);
          }
        }
      }
    }
  }

  openAddProject(): void {
    this.isAddingProject = true;
    this.isEditingProject = false;
    this.selectedProject = null;
    this.resetForm();
  }

  openEditProject(project: ConstructionSite): void {
    this.isEditingProject = true;
    this.isAddingProject = false;
    this.selectedProject = project;
    
    // Populate form with project data
    this.projectForm = {
      name: project.name,
      location: project.location,
      coordinates: { ...project.coordinates },
      type: project.type,
      estimatedCost: project.estimatedCost,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      progress: project.progress,
      documents: [...project.documents]
    };

    // Update available sub-counties based on selected location
    this.onCountyChange();

    // Try to find matching sub-county based on coordinates
    if (project.coordinates.lat && project.coordinates.lng) {
      const selectedCounty = this.counties.find(c => c.name === project.location);
      if (selectedCounty) {
        const matchingSubCounty = selectedCounty.subCounties.find(sc => 
          Math.abs(sc.coordinates.lat - project.coordinates.lat) < 0.1 &&
          Math.abs(sc.coordinates.lng - project.coordinates.lng) < 0.1
        );
        if (matchingSubCounty) {
          this.selectedSubCounty = matchingSubCounty.name;
        }
      }
    }

    // Set map coordinates
    this.mapCoordinates = {
      lat: project.coordinates.lat || -1.2921,
      lng: project.coordinates.lng || 36.8219
    };
  }

  closeModal(): void {
    this.isAddingProject = false;
    this.isEditingProject = false;
    this.selectedProject = null;
    this.showMapModal = false;
    this.showAnalysisModal = false;
    this.siteAnalysis = null;
    this.destroyMap();
    this.resetForm();
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedSubCounty = '';
  }

  resetForm(): void {
    this.projectForm = {
      name: '',
      location: '',
      coordinates: {
        lat: 0,
        lng: 0
      },
      type: '',
      estimatedCost: 0,
      status: 'PLANNING',
      startDate: '',
      endDate: '',
      progress: 0,
      documents: []
    };
    this.availableSubCounties = [];
    this.mapCoordinates = { lat: -1.2921, lng: 36.8219 };
    this.selectedSubCounty = '';
    this.setMinDates();
  }

  submitProject(): void {
    if (!this.validateForm()) {
      return;
    }

    const contractorId = this.authService.getCurrentUserId();
    if (!contractorId) {
      this.errorMessage = 'Contractor ID not found. Please log in again.';
      return;
    }

    if (!this.authService.isAuthenticated) {
      this.errorMessage = 'Please log in to create or update projects.';
      return;
    }

    const projectData = {
      ...this.projectForm,
      contractorId: typeof contractorId === 'string' ? parseInt(contractorId) : contractorId
    };

    if (this.isEditingProject && this.selectedProject) {
      this.updateProject(projectData);
    } else {
      this.createProject(projectData, contractorId);
    }
  }

  createProject(projectData: any, contractorId: string | number): void {
    const headers = this.getAuthHeaders();

    this.http.post<ConstructionSite>(
      `https://timbuabackend.onrender.com/api/sites/contractor/${contractorId}`,
      projectData,
      { headers }
    ).subscribe({
      next: (newProject) => {
        this.projects.push(newProject);
        this.closeModal();
        this.successMessage = 'Project created successfully!';
        console.log('New project created:', newProject);
        this.clearMessageAfterDelay();
      },
      error: (error) => {
        console.error('Error creating project:', error);
        if (error.status === 403) {
          this.errorMessage = 'Access denied. Please check your permissions.';
        } else if (error.status === 401) {
          this.errorMessage = 'Session expired. Please log in again.';
        } else {
          this.errorMessage = 'Failed to create project. Please try again.';
        }
      }
    });
  }

  updateProject(projectData: any): void {
    if (!this.selectedProject) return;

    const headers = this.getAuthHeaders();

    this.http.put<ConstructionSite>(
      `https://timbuabackend.onrender.com/api/sites/${this.selectedProject.id}`,
      projectData,
      { headers }
    ).subscribe({
      next: (updatedProject) => {
        const index = this.projects.findIndex(p => p.id === updatedProject.id);
        if (index !== -1) {
          this.projects[index] = updatedProject;
        }
        this.closeModal();
        this.successMessage = 'Project updated successfully!';
        this.clearMessageAfterDelay();
      },
      error: (error) => {
        console.error('Error updating project:', error);
        if (error.status === 403 || error.status === 401) {
          this.errorMessage = 'Authentication error. Please log in again.';
        } else {
          this.errorMessage = 'Failed to update project. Please try again.';
        }
      }
    });
  }

  deleteProject(projectId: number): void {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    if (!this.authService.isAuthenticated) {
      this.errorMessage = 'Please log in to delete projects.';
      return;
    }

    const headers = this.getAuthHeaders();

    this.http.delete(`https://timbuabackend.onrender.com/api/sites/${projectId}`, { headers })
      .subscribe({
        next: () => {
          this.projects = this.projects.filter(project => project.id !== projectId);
          this.successMessage = 'Project deleted successfully!';
          this.clearMessageAfterDelay();
        },
        error: (error) => {
          console.error('Error deleting project:', error);
          if (error.status === 403 || error.status === 401) {
            this.errorMessage = 'Authentication error. Please log in again.';
          } else {
            this.errorMessage = 'Failed to delete project. Please try again.';
          }
        }
      });
  }

  // Map and Location Methods
  openMapModal(): void {
    this.showMapModal = true;
    setTimeout(() => {
      this.initMap();
    }, 100);
  }

  private initMap(): void {
    if (this.mapInitialized && this.map) {
      return;
    }

    // Create map
    this.map = L.map('map').setView([this.mapCoordinates.lat, this.mapCoordinates.lng], 13);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Create custom icon
    const customIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add initial marker
    this.marker = L.marker([this.mapCoordinates.lat, this.mapCoordinates.lng], { icon: customIcon })
      .addTo(this.map)
      .bindPopup('Selected Location')
      .openPopup();

    // Add click event to map
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.onMapClick(e);
    });

    this.mapInitialized = true;
  }

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.marker = null;
      this.mapInitialized = false;
    }
  }

  private updateMapMarker(lat: number, lng: number): void {
    if (this.map && this.marker) {
      this.marker.setLatLng([lat, lng]);
      this.map.setView([lat, lng], 13);
    }
  }

  onMapClick(e: L.LeafletMouseEvent): void {
    this.mapCoordinates = {
      lat: e.latlng.lat,
      lng: e.latlng.lng
    };

    if (this.marker) {
      this.marker.setLatLng([this.mapCoordinates.lat, this.mapCoordinates.lng]);
    } else if (this.map) {
      const customIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      this.marker = L.marker([this.mapCoordinates.lat, this.mapCoordinates.lng], { icon: customIcon })
        .addTo(this.map)
        .bindPopup('Selected Location')
        .openPopup();
    }

    // Clear selected sub-county when manually selecting location
    this.selectedSubCounty = '';
  }

  getCurrentLocation(): void {
    this.isGettingLocation = true;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.mapCoordinates = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          if (this.map) {
            this.updateMapMarker(this.mapCoordinates.lat, this.mapCoordinates.lng);
          }
          
          this.isGettingLocation = false;
          // Clear selected sub-county when using current location
          this.selectedSubCounty = '';
        },
        (error) => {
          console.error('Error getting location:', error);
          this.errorMessage = 'Unable to get your current location. Please enable location services.';
          this.isGettingLocation = false;
          this.clearMessageAfterDelay();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      this.errorMessage = 'Geolocation is not supported by this browser.';
      this.isGettingLocation = false;
      this.clearMessageAfterDelay();
    }
  }

  confirmLocation(): void {
    this.projectForm.coordinates.lat = this.mapCoordinates.lat;
    this.projectForm.coordinates.lng = this.mapCoordinates.lng;
    this.showMapModal = false;
    this.destroyMap();
  }

  // Site Analysis Methods
analyzeSite(): void {
  if (!this.projectForm.coordinates.lat || !this.projectForm.coordinates.lng) {
    this.errorMessage = 'Please set coordinates first to analyze the site.';
    return;
  }

  this.isAnalyzingSite = true;
  this.analysisProgress = 0;
  this.currentAnalysisStep = 'Starting analysis...';

  const analysisSubscription = this.siteAnalysisService.analyzeSite(
    this.projectForm.coordinates.lat,
    this.projectForm.coordinates.lng,
    this.projectForm.type,
    this.projectForm.estimatedCost,
    this.buildingType
  ).subscribe({
    next: (progressUpdate) => {
      this.analysisProgress = progressUpdate.progress;
      this.currentAnalysisStep = progressUpdate.step;
      
      if (progressUpdate.data) {
        // Ensure all optional fields are initialized
        this.siteAnalysis = {
          ...progressUpdate.data,
          locationAnalysis: {
            ...progressUpdate.data.locationAnalysis,
            restrictedAreas: progressUpdate.data.locationAnalysis.restrictedAreas || [],
            zoningRestrictions: progressUpdate.data.locationAnalysis.zoningRestrictions || []
          },
          constructionAnalysis: {
            ...progressUpdate.data.constructionAnalysis,
            buildingLimitations: progressUpdate.data.constructionAnalysis.buildingLimitations || []
          },
          metadata: {
            ...progressUpdate.data.metadata,
            isBuildable: progressUpdate.data.metadata.isBuildable ?? true,
            restrictionsFound: progressUpdate.data.metadata.restrictionsFound || 0
          }
        };
        this.showAnalysisModal = true;
      }
    },
    error: (error) => {
      console.error('Error during site analysis:', error);
      this.errorMessage = 'Failed to analyze site. Please try again.';
      this.isAnalyzingSite = false;
      this.clearMessageAfterDelay();
    },
    complete: () => {
      this.isAnalyzingSite = false;
      this.analysisProgress = 100;
    }
  });
}
  downloadAnalysisReport(): void {
    if (!this.siteAnalysis) return;

    const report = {
      projectName: this.projectForm.name,
      analysisDate: new Date().toISOString(),
      ...this.siteAnalysis
    };

    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `site-analysis-${this.projectForm.name || 'project'}-${new Date().getTime()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private validateForm(): boolean {
    // Clear previous errors
    this.errorMessage = '';

    if (!this.projectForm.name.trim()) {
      this.errorMessage = 'Project name is required';
      return false;
    }
    if (!this.projectForm.location.trim()) {
      this.errorMessage = 'County is required';
      return false;
    }
    if (!this.projectForm.type) {
      this.errorMessage = 'Project type is required';
      return false;
    }
    if (this.projectForm.estimatedCost <= 0) {
      this.errorMessage = 'Estimated cost must be greater than 0';
      return false;
    }
    if (!this.projectForm.startDate) {
      this.errorMessage = 'Start date is required';
      return false;
    }
    if (!this.projectForm.endDate) {
      this.errorMessage = 'End date is required';
      return false;
    }
    if (!this.projectForm.coordinates.lat || !this.projectForm.coordinates.lng) {
      this.errorMessage = 'Coordinates are required. Please set the location.';
      return false;
    }

    // Date validation
    const startDate = new Date(this.projectForm.startDate);
    const endDate = new Date(this.projectForm.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (endDate <= startDate) {
      this.errorMessage = 'End date must be after start date';
      return false;
    }

    if (endDate < today) {
      this.errorMessage = 'End date cannot be in the past';
      return false;
    }

    if (this.projectForm.progress < 0 || this.projectForm.progress > 100) {
      this.errorMessage = 'Progress must be between 0 and 100';
      return false;
    }

    return true;
  }

  private clearMessageAfterDelay(): void {
    setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
    }, 5000);
  }

  getStatusBadgeClass(status: ConstructionSite['status']): string {
    switch (status) {
      case 'PLANNING':
        return 'status-badge status-planning';
      case 'IN_PROGRESS':
        return 'status-badge status-in-progress';
      case 'ON_HOLD':
        return 'status-badge status-on-hold';
      case 'COMPLETED':
        return 'status-badge status-completed';
      case 'CANCELLED':
        return 'status-badge status-cancelled';
      default:
        return 'status-badge status-planning';
    }
  }

  getStatusLabel(status: ConstructionSite['status']): string {
    const statusOption = this.statusOptions.find(opt => opt.value === status);
    return statusOption ? statusOption.label : status;
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  }

  getProgressColor(progress: number): string {
    if (progress >= 80) return 'progress-high';
    if (progress >= 50) return 'progress-medium';
    return 'progress-low';
  }

  getDaysRemaining(endDate: string): number {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isProjectOverdue(endDate: string): boolean {
    return new Date(endDate) < new Date();
  }
}