import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export interface Supplier {
  id: number;
  companyName: string;
  businessRegistrationNumber: string;
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  description: string;
  yearsInBusiness: number;
  logoUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  verificationDate: string;
  createdAt: string;
  updatedAt: string;
  verified: boolean;
}

export interface SupplierDocument {
  id: number;
  fileName: string;
  fileType: string;
  url: string;
  supplier: Supplier;
  uploadedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  messageCode: string;
  message: string;
}

export interface DashboardMetrics {
  activeSites: number;
  pendingQuotes: number;
  activeOrders: number;
  deliveriesToday: number;
  averageRating: number;
  totalReviews: number;
}

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private apiUrl = 'https://timbuabackend.onrender.com/api/suppliers';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // Get current logged-in supplier
  getCurrentSupplier(): Observable<ApiResponse<Supplier>> {
    const supplierId = this.getSupplierId();
    if (!supplierId) {
      return throwError(() => new Error('No supplier ID found. Please log in again.'));
    }
    return this.getSupplierById(supplierId);
  }

  // Get supplier ID from localStorage
  getSupplierId(): number | null {
    if (isPlatformBrowser(this.platformId)) {
      try {
        // Try different possible storage keys
        const possibleKeys = ['currentUser', 'user', 'authUser', 'supplier'];
        
        for (const key of possibleKeys) {
          const userData = localStorage.getItem(key);
          if (userData) {
            const user = JSON.parse(userData);
            const supplierId = user.id || user.supplierId || user.userId;
            if (supplierId) {
              console.log('Found supplier ID:', supplierId);
              return Number(supplierId);
            }
          }
        }
      } catch (error) {
        console.error('Error getting supplier ID from storage:', error);
      }
    }
    return null;
  }

  // Get supplier by ID
  getSupplierById(id: number): Observable<ApiResponse<Supplier>> {
    return this.http.get<ApiResponse<Supplier>>(`${this.apiUrl}/${id}`);
  }

  // Update supplier
  updateSupplier(id: number, supplierData: Partial<Supplier>): Observable<ApiResponse<Supplier>> {
    return this.http.put<ApiResponse<Supplier>>(`${this.apiUrl}/${id}`, supplierData);
  }

  // Verify supplier
  verifySupplier(id: number, approve: boolean = true): Observable<ApiResponse<Supplier>> {
    return this.http.put<ApiResponse<Supplier>>(`${this.apiUrl}/${id}/verify?approve=${approve}`, {});
  }

  // Get supplier documents
  getSupplierDocuments(supplierId: number): Observable<ApiResponse<SupplierDocument[]>> {
    return this.http.get<ApiResponse<SupplierDocument[]>>(`${this.apiUrl}/${supplierId}/documents`);
  }

  // Upload supplier document
  uploadDocument(supplierId: number, file: File): Observable<ApiResponse<SupplierDocument>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<SupplierDocument>>(`${this.apiUrl}/${supplierId}/documents`, formData);
  }

  // Register new supplier
  registerSupplier(supplierData: Partial<Supplier>): Observable<ApiResponse<Supplier>> {
    return this.http.post<ApiResponse<Supplier>>(`${this.apiUrl}/register`, supplierData);
  }

  // Register supplier with materials
  registerSupplierWithMaterials(supplierData: Partial<Supplier>): Observable<ApiResponse<Supplier>> {
    return this.http.post<ApiResponse<Supplier>>(`${this.apiUrl}/register-with-materials`, supplierData);
  }

  // Get all suppliers
  getAllSuppliers(): Observable<ApiResponse<Supplier[]>> {
    return this.http.get<ApiResponse<Supplier[]>>(this.apiUrl);
  }

  // Get verified suppliers
  getVerifiedSuppliers(): Observable<ApiResponse<Supplier[]>> {
    return this.http.get<ApiResponse<Supplier[]>>(`${this.apiUrl}/verified`);
  }

  // Get dashboard metrics (you might need to create this endpoint)
  getDashboardMetrics(supplierId: number): Observable<ApiResponse<DashboardMetrics>> {
    return this.http.get<ApiResponse<DashboardMetrics>>(`${this.apiUrl}/${supplierId}/dashboard-metrics`);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getSupplierId() !== null;
  }

  // Get stored user data
  getStoredUserData(): any {
    if (isPlatformBrowser(this.platformId)) {
      const possibleKeys = ['currentUser', 'user', 'authUser', 'supplier'];
      
      for (const key of possibleKeys) {
        const userData = localStorage.getItem(key);
        if (userData) {
          try {
            return JSON.parse(userData);
          } catch (error) {
            console.error('Error parsing user data:', error);
          }
        }
      }
    }
    return null;
  }
}