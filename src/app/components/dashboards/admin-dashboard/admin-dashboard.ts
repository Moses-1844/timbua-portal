import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { DashboardService, DashboardStats, Activity } from './dashboard.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.scss']
})
export class AdminDashboard implements OnInit {
  colors = {
    kbrcDarkBlue: '#003366',
    kenyaBlack: '#000000',
    kenyaRed: '#BB0000',
    kenyaGreen: '#006600',
    kbrcBlue: '#0056B3',
    background: '#F8F9FA',
    kenyaWhite: '#FFFFFF',
    textPrimary: '#333333',
    textSecondary: '#666666'
  };

  currentRoute: string = '';
  isLoading = true;
  isRefreshing = false;
  errorMessage = '';

  // Dashboard Data
  dashboardStats: DashboardStats = {
    totalUsers: 0,
    totalContractors: 0,
    totalSuppliers: 0,
    totalSites: 0,
    totalMaterialSites: 0,
    pendingVerifications: 0,
    recentActivities: []
  };

  recentActivities: Activity[] = [];
  
  // Chart Data
  chartData: any = {};
  chartOptions: any = {};

  constructor(
    public authService: AuthService,
    private dashboardService: DashboardService,
    private router: Router
  ) {
    this.currentRoute = this.router.url;

    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentRoute = e.url;
      });
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.dashboardService.getDashboardStats().subscribe({
      next: (stats) => {
        this.dashboardStats = stats;
        this.recentActivities = stats.recentActivities;
        this.prepareChartData();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
        this.errorMessage = 'Failed to load dashboard statistics. Please try again.';
        this.isLoading = false;
      }
    });
  }

  refreshDashboard(): void {
    this.isRefreshing = true;
    this.loadDashboardData();
    setTimeout(() => {
      this.isRefreshing = false;
    }, 1000);
  }

  prepareChartData(): void {
    // Prepare donut chart data
    const contractors = this.dashboardStats.totalContractors;
    const suppliers = this.dashboardStats.totalSuppliers;
    const totalUsers = this.dashboardStats.totalUsers;
    const otherUsers = Math.max(0, totalUsers - contractors - suppliers);

    this.chartData = {
      labels: ['Contractors', 'Suppliers', 'Other Users'],
      datasets: [{
        data: [contractors, suppliers, otherUsers],
        backgroundColor: [
          'rgba(0, 51, 102, 0.6)',
          'rgba(0, 102, 0, 0.6)',
          'rgba(187, 0, 0, 0.6)'
        ],
        borderColor: [
          '#003366',
          '#006600',
          '#BB0000'
        ],
        borderWidth: 1
      }]
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            boxWidth: 12,
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = contractors + suppliers + otherUsers;
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    };
  }

  formatActivityTime(timestamp: string): string {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
    
    return activityTime.toLocaleDateString();
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'USER_REGISTERED':
        return 'fas fa-user-plus';
      case 'CONTRACTOR_VERIFIED':
        return 'fas fa-user-check';
      case 'SUPPLIER_VERIFIED':
        return 'fas fa-truck-loading';
      case 'SITE_CREATED':
        return 'fas fa-hard-hat';
      case 'MATERIAL_SITE_CREATED':
        return 'fas fa-map-marker-alt';
      default:
        return 'fas fa-info-circle';
    }
  }

  getActivityColor(type: string): string {
    switch (type) {
      case 'USER_REGISTERED':
        return '#003366';
      case 'CONTRACTOR_VERIFIED':
        return '#006600';
      case 'SUPPLIER_VERIFIED':
        return '#0056B3';
      case 'SITE_CREATED':
        return '#BB0000';
      case 'MATERIAL_SITE_CREATED':
        return '#8B4513';
      default:
        return '#666666';
    }
  }

  getPendingContractorCount(): number {
    if (this.dashboardStats.pendingVerifications === 0) return 0;
    return Math.ceil(this.dashboardStats.pendingVerifications / 2);
  }

  getPendingSupplierCount(): number {
    if (this.dashboardStats.pendingVerifications === 0) return 0;
    return Math.floor(this.dashboardStats.pendingVerifications / 2);
  }

  getTotalPlatformUsers(): number {
    return this.dashboardStats.totalUsers;
  }

  getChartPercentage(value: number, total: number): number {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }

  getDonutChartGradient(): string {
    const total = this.dashboardStats.totalUsers;
    const contractors = this.dashboardStats.totalContractors;
    const suppliers = this.dashboardStats.totalSuppliers;
    const others = Math.max(0, total - contractors - suppliers);

    if (total === 0) return 'conic-gradient(#e0e0e0 0% 100%)';

    const contractorsPercent = (contractors / total) * 100;
    const suppliersPercent = (suppliers / total) * 100;
    const othersPercent = (others / total) * 100;

    return `conic-gradient(
      #003366 0% ${contractorsPercent}%,
      #006600 ${contractorsPercent}% ${contractorsPercent + suppliersPercent}%,
      #BB0000 ${contractorsPercent + suppliersPercent}% 100%
    )`;
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

  navigateToHome() {
    this.router.navigate(['/materials']);
  }

  navigateToMaterials() {
    this.router.navigate(['/materials']);
  }

  navigateToSupport() {
    this.router.navigate(['/support']);
  }

  isActiveRoute(route: string): boolean {
    return this.currentRoute === route || this.currentRoute.startsWith(route + '/');
  }

  isChildRouteActive(): boolean {
    return this.currentRoute !== '/admin-dashboard' && this.currentRoute !== '/admin-dashboard/';
  }
   
}