import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DashboardStats {
  totalUsers: number;
  totalContractors: number;
  totalSuppliers: number;
  totalSites: number;
  totalMaterialSites: number;
  pendingVerifications: number;
  recentActivities: Activity[];
}

export interface Activity {
  id: number;
  type: 'USER_REGISTERED' | 'CONTRACTOR_VERIFIED' | 'SUPPLIER_VERIFIED' | 'SITE_CREATED' | 'MATERIAL_SITE_CREATED';
  description: string;
  timestamp: string;
  userId?: number;
  userName?: string;
}

interface ApiResponse<T> {
  data?: T;
  message?: string;
  messageCode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Get all dashboard data from actual APIs
  getDashboardStats(): Observable<DashboardStats> {
    return forkJoin({
      contractors: this.getAllContractors(),
      suppliers: this.getAllSuppliers(),
      sites: this.getAllSites(),
      materialSites: this.getAllMaterialSites()
    }).pipe(
      map(data => {
        const contractors = data.contractors;
        const suppliers = data.suppliers;
        const sites = data.sites;
        const materialSites = data.materialSites;

        // Calculate pending verifications
        const pendingContractors = contractors.filter((c: any) => 
          c.status === 'PENDING' || (!c.isVerified && c.status === 'PENDING')
        ).length;

        const pendingSuppliers = suppliers.filter((s: any) => 
          s.status === 'PENDING' || (!s.verified && s.status === 'PENDING')
        ).length;

        const pendingVerifications = pendingContractors + pendingSuppliers;

        // Calculate totals
        const totalUsers = contractors.length + suppliers.length;

        // Generate activities from real data
        const recentActivities = this.generateActivities({
          contractors,
          suppliers,
          materialSites
        });

        return {
          totalUsers,
          totalContractors: contractors.length,
          totalSuppliers: suppliers.length,
          totalSites: sites.length,
          totalMaterialSites: materialSites.length,
          pendingVerifications,
          recentActivities: recentActivities.slice(0, 10) // Return top 10 activities
        };
      }),
      catchError(error => {
        console.error('Error in getDashboardStats:', error);
        // Return empty stats on error
        return of({
          totalUsers: 0,
          totalContractors: 0,
          totalSuppliers: 0,
          totalSites: 0,
          totalMaterialSites: 0,
          pendingVerifications: 0,
          recentActivities: []
        });
      })
    );
  }

  // Get recent activities (generated from actual data)
  getRecentActivities(): Observable<Activity[]> {
    return forkJoin({
      contractors: this.getAllContractors(),
      suppliers: this.getAllSuppliers(),
      materialSites: this.getAllMaterialSites()
    }).pipe(
      map(data => this.generateActivities(data).slice(0, 10)),
      catchError(error => {
        console.error('Error in getRecentActivities:', error);
        return of([]);
      })
    );
  }

  // Helper methods using actual API endpoints
  private getAllContractors(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/api/contractors`).pipe(
      map(response => {
        // Handle different response formats
        if (Array.isArray(response)) {
          return response;
        } else if (response && response.data) {
          return Array.isArray(response.data) ? response.data : [];
        }
        return [];
      }),
      catchError(error => {
        console.error('Error fetching contractors:', error);
        return of([]);
      })
    );
  }

  private getAllSuppliers(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/api/suppliers`).pipe(
      map(response => {
        // Handle different response formats
        if (Array.isArray(response)) {
          return response;
        } else if (response && response.data) {
          return Array.isArray(response.data) ? response.data : [];
        }
        return [];
      }),
      catchError(error => {
        console.error('Error fetching suppliers:', error);
        return of([]);
      })
    );
  }

  private getAllSites(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/sites`).pipe(
      catchError(error => {
        console.error('Error fetching sites:', error);
        return of([]);
      })
    );
  }

  private getAllMaterialSites(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/material-sites`).pipe(
      catchError(error => {
        console.error('Error fetching material sites:', error);
        return of([]);
      })
    );
  }

  private generateActivities(data: {
    contractors: any[],
    suppliers: any[],
    materialSites: any[]
  }): Activity[] {
    const activities: Activity[] = [];
    const now = new Date();

    // Generate activities from contractors
    const contractors = data.contractors || [];
    contractors.forEach((contractor: any, index: number) => {
      const activityDate = new Date(now.getTime() - (index * 3600000)); // Stagger by hour
      activities.push({
        id: index + 1,
        type: contractor.isVerified ? 'CONTRACTOR_VERIFIED' : 'USER_REGISTERED',
        description: contractor.isVerified 
          ? `Contractor ${contractor.companyName} verified`
          : `New contractor ${contractor.companyName} registered`,
        timestamp: activityDate.toISOString(),
        userId: contractor.id,
        userName: contractor.contactPerson
      });
    });

    // Generate activities from suppliers
    const suppliers = data.suppliers || [];
    suppliers.forEach((supplier: any, index: number) => {
      const activityDate = new Date(now.getTime() - ((index + contractors.length) * 3600000));
      activities.push({
        id: contractors.length + index + 1,
        type: supplier.verified ? 'SUPPLIER_VERIFIED' : 'USER_REGISTERED',
        description: supplier.verified
          ? `Supplier ${supplier.companyName} verified`
          : `New supplier ${supplier.companyName} registered`,
        timestamp: activityDate.toISOString(),
        userId: supplier.id,
        userName: supplier.contactPerson
      });
    });

    // Generate activities from material sites
    const materialSites = data.materialSites || [];
    materialSites.forEach((site: any, index: number) => {
      const activityDate = new Date(now.getTime() - ((index + contractors.length + suppliers.length) * 1800000)); // Stagger by 30 mins
      activities.push({
        id: contractors.length + suppliers.length + index + 1,
        type: 'MATERIAL_SITE_CREATED',
        description: `Material site for ${site.material} created in ${site.county}`,
        timestamp: activityDate.toISOString()
      });
    });

    // Sort by timestamp (newest first)
    return activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
}