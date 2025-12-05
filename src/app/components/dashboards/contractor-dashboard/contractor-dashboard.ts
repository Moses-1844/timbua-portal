import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  pendingQuotations: number;
  approvedQuotations: number;
  totalMaterialRequests: number;
  upcomingDeadlines: number;
  totalBudget: number;
}

interface Project {
  id: number;
  name: string;
  status: string;
  progress: number;
  startDate: string;
  endDate: string;
  estimatedCost: number;
}

interface QuotationRequest {
  id: number;
  material: string;
  quantity: number;
  deadline: string;
  status: string;
  quotes: any[];
}

interface RecentActivity {
  type: string;
  message: string;
  timestamp: string;
  projectName?: string;
}

@Component({
  selector: 'app-contractor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './contractor-dashboard.html',
  styleUrls: ['./contractor-dashboard.scss']
})
export class ContractorDashboard implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  public authService = inject(AuthService);

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
  dashboardStats: DashboardStats = {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    pendingQuotations: 0,
    approvedQuotations: 0,
    totalMaterialRequests: 0,
    upcomingDeadlines: 0,
    totalBudget: 0
  };
  
  recentProjects: Project[] = [];
  pendingQuotations: QuotationRequest[] = [];
  recentActivities: RecentActivity[] = [];
  isLoading = true;
  hasError = false;

  constructor() {
    this.currentRoute = this.router.url;
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentRoute = e.url;
      });
  }

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading = true;
    this.hasError = false;
    
    // Load all data in parallel with proper error handling
    Promise.all([
      this.loadProjects().catch(error => {
        console.error('Error loading projects:', error);
        return null;
      }),
      this.loadQuotationRequests().catch(error => {
        console.error('Error loading quotations:', error);
        return null;
      })
    ]).then(() => {
      this.generateRecentActivities();
    }).finally(() => {
      this.isLoading = false;
    });
  }

  private loadProjects(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<any[]>('https://timbuabackend.onrender.com/api/sites')
        .subscribe({
          next: (projects) => {
            try {
              const contractorId = this.authService.getCurrentUserId();
              if (!contractorId) {
                this.recentProjects = [];
                resolve();
                return;
              }

              // Handle both string and number IDs
              const contractorProjects = projects?.filter(project => 
                project && (
                  project.contractorId === contractorId || 
                  project.contractorId === parseInt(contractorId as string) ||
                  project.contractorId?.toString() === contractorId.toString()
                )
              ) || [];

              this.dashboardStats.totalProjects = contractorProjects.length;
              this.dashboardStats.activeProjects = contractorProjects.filter(p => 
                p.status === 'IN_PROGRESS' || p.status === 'PLANNING'
              ).length;
              this.dashboardStats.completedProjects = contractorProjects.filter(p => 
                p.status === 'COMPLETED'
              ).length;
              this.dashboardStats.totalBudget = contractorProjects.reduce((sum, project) => 
                sum + (project.estimatedCost || 0), 0
              );

              // Get upcoming deadlines (projects ending in next 30 days)
              const thirtyDaysFromNow = new Date();
              thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
              this.dashboardStats.upcomingDeadlines = contractorProjects.filter(project => {
                if (!project.endDate) return false;
                const endDate = new Date(project.endDate);
                return endDate <= thirtyDaysFromNow && endDate >= new Date() && project.status !== 'COMPLETED';
              }).length;

              // Recent projects (last 5)
              this.recentProjects = contractorProjects
                .sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime())
                .slice(0, 5)
                .map(project => ({
                  id: project.id,
                  name: project.name,
                  status: project.status,
                  progress: project.progress || 0,
                  startDate: project.startDate,
                  endDate: project.endDate,
                  estimatedCost: project.estimatedCost || 0
                }));

              resolve();
            } catch (error) {
              console.error('Error processing projects:', error);
              this.recentProjects = [];
              resolve();
            }
          },
          error: (error) => {
            console.error('Error loading projects:', error);
            this.hasError = true;
            this.recentProjects = [];
            resolve(); // Still resolve to prevent infinite loading
          }
        });
    });
  }

  private loadQuotationRequests(): Promise<void> {
    return new Promise((resolve, reject) => {
      const contractorId = this.authService.getCurrentUserId();
      if (!contractorId) {
        this.pendingQuotations = [];
        resolve();
        return;
      }

      this.http.get<any>(`https://timbuabackend.onrender.com/api/contractors/${contractorId}`)
        .subscribe({
          next: (contractor) => {
            try {
              if (contractor?.quotationRequests) {
                const quotations = contractor.quotationRequests;
                
                this.dashboardStats.totalMaterialRequests = quotations.length;
                this.dashboardStats.pendingQuotations = quotations.filter((q: any) => 
                  q.status === 'PENDING'
                ).length;
                this.dashboardStats.approvedQuotations = quotations.filter((q: any) => 
                  q.status === 'APPROVED'
                ).length;

                // Recent pending quotations
                this.pendingQuotations = quotations
                  .filter((q: any) => q.status === 'PENDING')
                  .slice(0, 5)
                  .map((quote: any) => ({
                    id: quote.id,
                    material: quote.material,
                    quantity: quote.quantity,
                    deadline: quote.deadline,
                    status: quote.status,
                    quotes: quote.quotes || []
                  }));
              } else {
                this.pendingQuotations = [];
              }
              resolve();
            } catch (error) {
              console.error('Error processing quotations:', error);
              this.pendingQuotations = [];
              resolve();
            }
          },
          error: (error) => {
            console.error('Error loading contractor data:', error);
            this.hasError = true;
            this.pendingQuotations = [];
            resolve(); // Still resolve to prevent infinite loading
          }
        });
    });
  }

  private generateRecentActivities(): void {
    try {
      this.recentActivities = [];

      // Add project-related activities
      this.recentProjects.forEach(project => {
        if (project.status === 'IN_PROGRESS') {
          this.recentActivities.push({
            type: 'project',
            message: `Project "${project.name}" is ${project.progress}% complete`,
            timestamp: new Date().toISOString(),
            projectName: project.name
          });
        }
      });

      // Add quotation-related activities
      this.pendingQuotations.forEach(quote => {
        this.recentActivities.push({
          type: 'quotation',
          message: `Pending quotation for ${quote.material} (${quote.quantity} units)`,
          timestamp: quote.deadline,
          projectName: 'Material Request'
        });
      });

      // Add system activities
      this.recentActivities.push({
        type: 'system',
        message: 'Dashboard updated with latest project data',
        timestamp: new Date().toISOString()
      });

      // Sort by timestamp (newest first) and take latest 5
      this.recentActivities = this.recentActivities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
    } catch (error) {
      console.error('Error generating activities:', error);
      this.recentActivities = [{
        type: 'system',
        message: 'Welcome to your dashboard! Start by creating your first project.',
        timestamp: new Date().toISOString()
      }];
    }
  }

  getProgressColor(progress: number): string {
    if (progress >= 80) return 'progress-high';
    if (progress >= 50) return 'progress-medium';
    return 'progress-low';
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'status-badge status-completed';
      case 'IN_PROGRESS': return 'status-badge status-in-progress';
      case 'PLANNING': return 'status-badge status-planning';
      case 'ON_HOLD': return 'status-badge status-on-hold';
      case 'CANCELLED': return 'status-badge status-cancelled';
      default: return 'status-badge status-planning';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'Completed';
      case 'IN_PROGRESS': return 'In Progress';
      case 'PLANNING': return 'Planning';
      case 'ON_HOLD': return 'On Hold';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }

  getDaysUntilDeadline(deadline: string): number {
    try {
      const today = new Date();
      const deadlineDate = new Date(deadline);
      const diffTime = deadlineDate.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  }

  getPerformanceMessage(): string {
    return this.authService.getPerformanceMessage?.() || 'Monitor your projects and materials efficiently.';
  }

  isDeadlineUrgent(deadline: string): boolean {
    return this.getDaysUntilDeadline(deadline) <= 7;
  }

  navigateToProjects(): void {
    this.router.navigate(['/contractor-dashboard/projects']);
  }

  navigateToQuotations(): void {
    this.router.navigate(['/contractor-dashboard/quotations']);
  }

  retryLoadData(): void {
    this.loadDashboardData();
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

  isActiveRoute(route: string): boolean {
    return this.currentRoute === route || this.currentRoute.startsWith(route + '/');
  }

  isChildRouteActive(): boolean {
    return this.currentRoute !== '/contractor-dashboard' && 
           this.currentRoute !== '/contractor-dashboard/' &&
           !this.currentRoute.includes('contractor-dashboard?');
  }
}