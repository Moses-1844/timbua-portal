import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';

// Interfaces for supplier data
interface MaterialSite {
  id: number;
  questionnaireNo: number;
  researchAssistantNo: string;
  material: string;
  materialLocation: string;
  latitude: number;
  longitude: number;
  materialUsedIn: string;
  sizeOfManufacturingIndustry: string;
  periodOfManufacture: string;
  ownerOfMaterial: string;
  materialUsage: string;
  numberOfPeopleEmployed: string;
  similarLocations: string;
  volumeProducedPerDay: string;
  comments: string;
  county: string;
  subCounty: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  createdAt: string;
}

interface MaterialOrder {
  id: number;
  materialSiteId: number;
  material: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  orderDate: string;
  deliveryDate: string;
  contractorId: number;
  contractorName: string;
  contractorPhone: string;
  siteLocation: string;
  specialInstructions: string;
}

interface Quotation {
  id: number;
  materialSiteId: number;
  material: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  sentDate: string;
  expiryDate: string;
  contractorId: number;
  contractorName: string;
  contractorEmail: string;
  notes: string;
}

interface MaterialRequest {
  id: number;
  materialType: string;
  quantity: number;
  budget: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'QUOTED' | 'CLOSED' | 'CANCELLED';
  requestedDate: string;
  requiredBy: string;
  contractorId: number;
  contractorName: string;
  contractorCompany: string;
  projectLocation: string;
  projectType: string;
  specifications: string;
}

interface DashboardStats {
  totalMaterialSites: number;
  activeMaterialSites: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  openRequests: number;
  sentQuotations: number;
  acceptedQuotations: number;
}

@Component({
  selector: 'app-supplier-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './supplier-dashboard.html',
  styleUrls: ['./supplier-dashboard.scss']
})
export class SupplierDashboard implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  public authService = inject(AuthService);

  colors = {
    kbrcDarkBlue: '#1e3a8a',
    kenyaBlack: '#000000',
    kenyaRed: '#bb0000',
    kenyaGreen: '#006600',
    kbrcBlue: '#2563eb',
    kenyaWhite: '#ffffff'
  };

  currentRoute: string = '';
  
  // Dashboard data
  dashboardStats: DashboardStats = {
    totalMaterialSites: 0,
    activeMaterialSites: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    openRequests: 0,
    sentQuotations: 0,
    acceptedQuotations: 0
  };
  
  recentMaterialSites: MaterialSite[] = [];
  recentOrders: MaterialOrder[] = [];
  recentQuotations: Quotation[] = [];
  recentRequests: MaterialRequest[] = [];
  recentActivity: any[] = [];
  
  isLoading = true;
  errorMessage = '';

  constructor() {}

  ngOnInit() {
    this.currentRoute = this.router.url;
    
    // Track route changes
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute = event.url;
      });
    
    // Load dashboard data
    this.loadDashboardData();
  }

  ngOnDestroy() {
    // Clean up if needed
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    const supplierId = this.authService.getCurrentUserId();
    const companyName = this.authService.getCompanyName();
    
    if (!supplierId) {
      this.errorMessage = 'Supplier ID not found. Please log in again.';
      this.isLoading = false;
      return;
    }

    // Load material sites data
    this.loadMaterialSites(supplierId, companyName);
    
    // Load mock data for orders, quotations, and requests
    // Replace with actual API calls when endpoints are available
    this.loadMockOrders(supplierId, companyName);
    this.loadMockQuotations(supplierId, companyName);
    this.loadMockRequests(supplierId, companyName);
  }

  private loadMaterialSites(supplierId: string | number, companyName: string): void {
    this.http.get<MaterialSite[]>('https://timbuabackend.onrender.com/api/material-sites')
      .subscribe({
        next: (materialSites) => {
          console.log('All material sites loaded:', materialSites);
          
          // Filter material sites for this supplier
          // Note: Adjust filter logic based on how you identify supplier ownership
          const supplierSites = materialSites.filter(site => 
            site.ownerOfMaterial === companyName || 
            site.ownerOfMaterial === supplierId.toString() ||
            site.researchAssistantNo === supplierId.toString()
          );
          
          console.log('Supplier material sites:', supplierSites);
          
          this.recentMaterialSites = supplierSites.slice(0, 5); // Get latest 5
          this.dashboardStats.totalMaterialSites = supplierSites.length;
          this.dashboardStats.activeMaterialSites = supplierSites.filter(site => 
            site.status === 'ACTIVE'
          ).length;
          
          // Add material site activities
          supplierSites.slice(0, 3).forEach(site => {
            this.recentActivity.push({
              type: 'material',
              text: `Added ${site.material} at ${site.county}`,
              time: site.createdAt || new Date().toISOString(),
              siteId: site.id
            });
          });
          
          this.updateLoadingState();
        },
        error: (error) => {
          console.error('Error loading material sites:', error);
          this.errorMessage = 'Failed to load material sites data. Using mock data.';
          this.loadMockMaterialSites(supplierId, companyName);
          this.updateLoadingState();
        }
      });
  }

  private loadMockMaterialSites(supplierId: string | number, companyName: string): void {
    // Mock data for development
    this.recentMaterialSites = [
      {
        id: 1,
        questionnaireNo: 101,
        researchAssistantNo: supplierId.toString(),
        material: 'Concrete',
        materialLocation: 'Industrial Area',
        latitude: -1.2921,
        longitude: 36.8219,
        materialUsedIn: 'Building Construction',
        sizeOfManufacturingIndustry: 'Medium (11-50 employees)',
        periodOfManufacture: '2020-present',
        ownerOfMaterial: companyName,
        materialUsage: 'Structural elements',
        numberOfPeopleEmployed: '25',
        similarLocations: 'Nairobi, Thika',
        volumeProducedPerDay: '500 bags',
        comments: 'High quality concrete',
        county: 'Nairobi',
        subCounty: 'Industrial Area',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        questionnaireNo: 102,
        researchAssistantNo: supplierId.toString(),
        material: 'Steel Beams',
        materialLocation: 'Mombasa Road',
        latitude: -1.3028,
        longitude: 36.8364,
        materialUsedIn: 'Structural Framework',
        sizeOfManufacturingIndustry: 'Large (51-200 employees)',
        periodOfManufacture: '2018-present',
        ownerOfMaterial: companyName,
        materialUsage: 'Building frames',
        numberOfPeopleEmployed: '150',
        similarLocations: 'Mombasa, Kisumu',
        volumeProducedPerDay: '100 tons',
        comments: 'Various sizes available',
        county: 'Nairobi',
        subCounty: 'Embakasi',
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];
    
    this.dashboardStats.totalMaterialSites = 2;
    this.dashboardStats.activeMaterialSites = 2;
  }

  private loadMockOrders(supplierId: string | number, companyName: string): void {
    // Mock orders data - Replace with actual API
    this.recentOrders = [
      {
        id: 1,
        materialSiteId: 1,
        material: 'Concrete',
        quantity: 100,
        unitPrice: 1500,
        totalPrice: 150000,
        status: 'DELIVERED',
        orderDate: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        deliveryDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        contractorId: 101,
        contractorName: 'John Construction',
        contractorPhone: '+254712345678',
        siteLocation: 'Westlands, Nairobi',
        specialInstructions: 'Deliver before 10 AM'
      },
      {
        id: 2,
        materialSiteId: 2,
        material: 'Steel Beams',
        quantity: 50,
        unitPrice: 8000,
        totalPrice: 400000,
        status: 'CONFIRMED',
        orderDate: new Date().toISOString(),
        deliveryDate: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days from now
        contractorId: 102,
        contractorName: 'Bridge Builders Ltd',
        contractorPhone: '+254723456789',
        siteLocation: 'Thika Road',
        specialInstructions: 'Reinforced beams only'
      }
    ];
    
    this.dashboardStats.pendingOrders = this.recentOrders.filter(o => 
      o.status === 'PENDING' || o.status === 'CONFIRMED'
    ).length;
    
    this.dashboardStats.completedOrders = this.recentOrders.filter(o => 
      o.status === 'DELIVERED'
    ).length;
    
    this.dashboardStats.totalRevenue = this.recentOrders
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, order) => sum + order.totalPrice, 0);
    
    // Add order activities
    this.recentOrders.slice(0, 2).forEach(order => {
      this.recentActivity.push({
        type: 'order',
        text: `New ${order.material} order from ${order.contractorName}`,
        time: order.orderDate,
        orderId: order.id
      });
    });
  }

  private loadMockQuotations(supplierId: string | number, companyName: string): void {
    // Mock quotations data - Replace with actual API
    this.recentQuotations = [
      {
        id: 1,
        materialSiteId: 1,
        material: 'Concrete',
        quantity: 200,
        unitPrice: 1450,
        totalPrice: 290000,
        status: 'SENT',
        sentDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 days from now
        contractorId: 103,
        contractorName: 'Skyline Developers',
        contractorEmail: 'contact@skylinedev.com',
        notes: 'Bulk discount applied'
      },
      {
        id: 2,
        materialSiteId: 2,
        material: 'Steel Beams',
        quantity: 75,
        unitPrice: 7800,
        totalPrice: 585000,
        status: 'ACCEPTED',
        sentDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        expiryDate: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
        contractorId: 104,
        contractorName: 'Urban Builders',
        contractorEmail: 'info@urbanbuilders.co.ke',
        notes: 'Includes delivery cost'
      }
    ];
    
    this.dashboardStats.sentQuotations = this.recentQuotations.filter(q => 
      q.status === 'SENT'
    ).length;
    
    this.dashboardStats.acceptedQuotations = this.recentQuotations.filter(q => 
      q.status === 'ACCEPTED'
    ).length;
    
    // Add quotation activities
    this.recentQuotations.slice(0, 2).forEach(quotation => {
      this.recentActivity.push({
        type: 'quotation',
        text: `${quotation.status} quotation for ${quotation.material}`,
        time: quotation.sentDate,
        quotationId: quotation.id
      });
    });
  }

  private loadMockRequests(supplierId: string | number, companyName: string): void {
    // Mock requests data - Replace with actual API
    this.recentRequests = [
      {
        id: 1,
        materialType: 'Cement',
        quantity: 500,
        budget: 450000,
        urgency: 'HIGH',
        status: 'OPEN',
        requestedDate: new Date().toISOString(),
        requiredBy: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
        contractorId: 105,
        contractorName: 'Greenfield Construction',
        contractorCompany: 'Greenfield Ltd',
        projectLocation: 'Karen, Nairobi',
        projectType: 'Residential Building',
        specifications: 'Portland cement only'
      },
      {
        id: 2,
        materialType: 'Sand',
        quantity: 1000,
        budget: 150000,
        urgency: 'MEDIUM',
        status: 'QUOTED',
        requestedDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        requiredBy: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
        contractorId: 106,
        contractorName: 'Riverbank Developers',
        contractorCompany: 'Riverbank Group',
        projectLocation: 'Ruiru',
        projectType: 'Road Construction',
        specifications: 'River sand, fine grain'
      }
    ];
    
    this.dashboardStats.openRequests = this.recentRequests.filter(r => 
      r.status === 'OPEN'
    ).length;
    
    // Add request activities
    this.recentRequests.slice(0, 2).forEach(request => {
      this.recentActivity.push({
        type: 'request',
        text: `New ${request.materialType} request from ${request.contractorCompany}`,
        time: request.requestedDate,
        requestId: request.id
      });
    });
  }

  private updateLoadingState(): void {
    // This is a simple implementation - you might want to track each API call separately
    this.isLoading = false;
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatQuantity(quantity: number, material: string): string {
    switch (material.toLowerCase()) {
      case 'concrete':
      case 'cement':
        return `${quantity} bags`;
      case 'steel beams':
        return `${quantity} units`;
      case 'sand':
      case 'ballast':
        return `${quantity} tons`;
      default:
        return `${quantity} units`;
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
      case 'CONFIRMED':
      case 'ACCEPTED':
        return 'status-badge status-active';
      case 'PENDING':
      case 'DRAFT':
      case 'OPEN':
      case 'SENT':
        return 'status-badge status-pending';
      case 'DELIVERED':
      case 'COMPLETED':
        return 'status-badge status-completed';
      case 'IN_TRANSIT':
        return 'status-badge status-in-transit';
      case 'CANCELLED':
      case 'REJECTED':
      case 'EXPIRED':
      case 'INACTIVE':
        return 'status-badge status-cancelled';
      case 'QUOTED':
        return 'status-badge status-quoted';
      default:
        return 'status-badge status-pending';
    }
  }

  getUrgencyBadgeClass(urgency: string): string {
    switch (urgency) {
      case 'HIGH':
        return 'urgency-badge urgency-high';
      case 'MEDIUM':
        return 'urgency-badge urgency-medium';
      case 'LOW':
        return 'urgency-badge urgency-low';
      default:
        return 'urgency-badge urgency-medium';
    }
  }

  isActiveRoute(route: string): boolean {
    return this.currentRoute === route || this.currentRoute.startsWith(route + '/');
  }

  isChildRouteActive(): boolean {
    return this.currentRoute !== '/supplier-dashboard' && 
           this.currentRoute !== '/supplier-dashboard/';
  }

  navigateToHome() {
    this.router.navigate(['/supplier-dashboard']);
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  refreshDashboard(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.recentActivity = [];
    this.loadDashboardData();
  }

  navigateToMaterialSites(): void {
    this.router.navigate(['/supplier-dashboard/inventory']);
  }

  navigateToOrders(): void {
    this.router.navigate(['/supplier-dashboard/orders']);
  }

  navigateToQuotations(): void {
    this.router.navigate(['/supplier-dashboard/quotations']);
  }

  navigateToRequests(): void {
    this.router.navigate(['/supplier-dashboard/requests']);
  }

  navigateToAddMaterial(): void {
    this.router.navigate(['/supplier-dashboard/add-site']);
  }
}